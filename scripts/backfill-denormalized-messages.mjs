#!/usr/bin/env node
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let admin;
try {
  admin = require('firebase-admin');
} catch (error) {
  admin = require('../functions/node_modules/firebase-admin');
}

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const orgFilter = process.argv.find((arg) => arg.startsWith('--org='))?.split('=')[1] || null;
const pageSize = Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 300);

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const clean = (value) => String(value || '').trim();
const nameFromEmail = (email) => clean(email).split('@')[0] || 'Unknown';

const loadOrgUserMap = async (orgId) => {
  const snap = await db.collection('users').where('orgId', '==', orgId).get();
  return new Map(snap.docs.map((docSnap) => {
    const data = docSnap.data() || {};
    return [clean(data.email).toLowerCase(), { uid: docSnap.id, ...data }];
  }));
};

const loadGroupMap = async (orgRef) => {
  const snap = await orgRef.collection('groups').get();
  return new Map(snap.docs.map((docSnap) => [docSnap.id, { id: docSnap.id, ...docSnap.data() }]));
};

const buildPatch = (message, usersByEmail, groupsById) => {
  const senderEmail = clean(message.senderEmail || message.sender).toLowerCase();
  const sender = usersByEmail.get(senderEmail) || {};
  const group = groupsById.get(message.groupId) || {};
  const taskData = message.taskData || {};
  const patch = {};

  if (!message.senderName) patch.senderName = sender.name || nameFromEmail(senderEmail);
  if (!message.senderAvatar && sender.profilePicUrl) patch.senderAvatar = sender.profilePicUrl;
  if (!message.groupName) patch.groupName = group.name || message.groupId || 'Unknown group';
  if (!message.groupAvatar && group.profilePicUrl) patch.groupAvatar = group.profilePicUrl;

  if (message.isTask === true) {
    if (!message.taskTitle) patch.taskTitle = taskData.title || message.text || 'Task';
    if (!message.taskStatus) patch.taskStatus = taskData.status || 'Pending';
    if (!message.taskPriority) patch.taskPriority = taskData.priority || 'Medium';
    if (!message.taskDeadline && taskData.deadline) patch.taskDeadline = taskData.deadline;
    const assignees = Array.isArray(taskData.assignees) ? taskData.assignees : [];
    if (!Array.isArray(message.taskAssigneeEmails)) patch.taskAssigneeEmails = [...new Set(assignees)];
    if (!Array.isArray(message.taskAssigneeNames)) patch.taskAssigneeNames = assignees.map((email) => usersByEmail.get(clean(email).toLowerCase())?.name || nameFromEmail(email));
    if (message.taskAssigneeCount === undefined) patch.taskAssigneeCount = assignees.length;
    if (!message.taskMasterReviewerEmail) patch.taskMasterReviewerEmail = taskData.masterReviewerEmail || message.senderEmail || null;
  }

  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
};

const processOrg = async (orgSnap) => {
  const orgRef = orgSnap.ref;
  const usersByEmail = await loadOrgUserMap(orgSnap.id);
  const groupsById = await loadGroupMap(orgRef);
  let scanned = 0;
  let patched = 0;
  let cursor = null;

  while (true) {
    let query = orgRef.collection('messages').orderBy('timestamp').limit(pageSize);
    if (cursor) query = query.startAfter(cursor);
    const snap = await query.get();
    if (snap.empty) break;
    const batch = db.batch();
    let batchCount = 0;
    snap.docs.forEach((docSnap) => {
      scanned += 1;
      const patch = buildPatch(docSnap.data() || {}, usersByEmail, groupsById);
      if (Object.keys(patch).length === 0) return;
      patched += 1;
      if (apply) {
        batch.set(docSnap.ref, { ...patch, denormalizedBackfilledAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        batchCount += 1;
      }
    });
    if (apply && batchCount > 0) await batch.commit();
    cursor = snap.docs[snap.docs.length - 1];
  }

  return { orgId: orgSnap.id, scanned, patched, applied: apply };
};

const orgQuery = orgFilter ? [await db.collection('organizations').doc(orgFilter).get()] : (await db.collection('organizations').get()).docs;
const results = [];
for (const orgSnap of orgQuery) {
  if (!orgSnap.exists) continue;
  results.push(await processOrg(orgSnap));
}
console.table(results);
if (!apply) console.log('Dry run only. Re-run with --apply to write denormalized fields.');
