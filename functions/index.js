const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

const PERMISSION_ACTIONS = ['read', 'create', 'update', 'delete'];
const logAuditEvent = async (type, adminId, target, details = {}) => db.collection('audit_logs').add({
  type,
  adminId,
  user: adminId,
  target,
  details,
  content: `${type}: ${target}`,
  immutableId: `${type}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  timestamp: admin.firestore.FieldValue.serverTimestamp(),
});

const getMergedPermissions = async (uid) => {
  const userSnap = await db.collection('users').doc(uid).get();
  const user = userSnap.data() || {};
  if (user.isAdmin) return { '*': { read: true, create: true, update: true, delete: true } };
  const roleNames = user.roles || [];
  const rolesSnap = await db.collection('roles').where('name', 'in', roleNames.length ? roleNames.slice(0, 10) : ['__none__']).get();
  const merged = {};
  rolesSnap.forEach((doc) => {
    const role = doc.data();
    Object.entries(role.permissions || {}).forEach(([area, actions]) => {
      merged[area] = merged[area] || {};
      PERMISSION_ACTIONS.forEach((action) => { merged[area][action] = !!merged[area][action] || !!actions[action]; });
    });
  });
  return merged;
};

const assertPermission = async (request, area, action) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  const permissions = await getMergedPermissions(request.auth.uid);
  if (permissions['*']?.[action] || permissions[area]?.[action]) return;
  throw new HttpsError('permission-denied', `Missing ${area}.${action} permission.`);
};

exports.forceLogoutSession = onCall(async (request) => {
  await assertPermission(request, 'Users', 'update');
  const { uid, sessionId } = request.data || {};
  if (!uid || !sessionId) throw new HttpsError('invalid-argument', 'uid and sessionId are required.');
  await admin.auth().revokeRefreshTokens(uid);
  await db.collection('sessions').doc(sessionId).delete();
  await logAuditEvent('FORCE_LOGOUT', request.auth.uid, sessionId, { affectedUid: uid });
  return { ok: true };
});

exports.forceLogoutAllUsers = onCall(async (request) => {
  await assertPermission(request, 'Users', 'update');
  const sessions = await db.collection('sessions').get();
  const uids = [...new Set(sessions.docs.map((doc) => doc.data().uid).filter(Boolean))];
  await Promise.all(uids.map((uid) => admin.auth().revokeRefreshTokens(uid)));
  const batch = db.batch();
  sessions.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  await logAuditEvent('FORCE_LOGOUT_ALL', request.auth.uid, 'all-sessions', { count: uids.length, affectedUsers: uids });
  return { ok: true, count: uids.length };
});

exports.retentionCleanup = onSchedule('every day 02:00', async () => {
  const policies = await db.collection('retentionPolicies').where('isActive', '==', true).get();
  for (const policyDoc of policies.docs) {
    const policy = policyDoc.data();
    if (policy.category !== 'Chat Messages') continue;
    const threshold = admin.firestore.Timestamp.fromMillis(Date.now() - Number(policy.ttlDays || 30) * 86400000);
    const oldMessages = await db.collection('messages').where('isTask', '==', false).where('timestamp', '<', threshold).limit(500).get();
    const batch = db.batch();
    oldMessages.docs.forEach((msgDoc) => {
      if (policy.action === 'archive') batch.set(db.collection('archived_messages').doc(msgDoc.id), { ...msgDoc.data(), archivedAt: admin.firestore.FieldValue.serverTimestamp() });
      batch.delete(msgDoc.ref);
    });
    await batch.commit();
    await db.collection('retention_cleanup_logs').add({ ruleId: policyDoc.id, ruleName: policy.category, affected: oldMessages.size, status: 'completed', timestamp: admin.firestore.FieldValue.serverTimestamp() });
    await logAuditEvent('RETENTION_RUN', 'scheduler', policyDoc.id, { affected: oldMessages.size });
  }
});

exports.exportDatabase = onCall(async (request) => {
  await assertPermission(request, 'Backups', 'create');
  const collections = ['users', 'groups', 'messages', 'audit_logs', 'settings'];
  const payload = { exportedAt: new Date().toISOString(), requestedBy: request.auth.uid, collections: {} };
  for (const name of collections) {
    const snap = await db.collection(name).get();
    payload.collections[name] = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }
  const file = admin.storage().bucket().file(`exports/full-export-${Date.now()}.json`);
  await file.save(JSON.stringify(payload, null, 2), { contentType: 'application/json' });
  const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 60 * 60 * 1000 });
  await db.collection('exports').add({ fileName: file.name, size: Buffer.byteLength(JSON.stringify(payload)), downloadUrl: url, status: 'ready', timestamp: admin.firestore.FieldValue.serverTimestamp() });
  await logAuditEvent('BACKUP_EXPORT', request.auth.uid, file.name, { collections });
  return { url, fileName: file.name };
});

exports.dsarGenerateReport = onCall(async (request) => {
  await assertPermission(request, 'Compliance', 'create');
  await logAuditEvent('DSAR_EXPORT', request.auth.uid, request.data?.uid || 'unknown', { dateRange: request.data?.dateRange || null });
  return { ok: true, message: 'Use the admin UI generated report or extend this callable for server-side report generation.' };
});
