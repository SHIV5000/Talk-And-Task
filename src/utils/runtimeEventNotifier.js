import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';

const EMAIL_TO = 'shivsuri1@gmail.com';

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toRows(entries) {
  return entries
    .map(([key, value]) => `<tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;">${escapeHtml(key)}</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">${escapeHtml(value)}</td></tr>`)
    .join('');
}

function buildHtml(eventName, details) {
  const systemRows = [
    ['Event', details.event],
    ['Status', details.status],
    ['Note', details.note],
    ['Time', details.time],
    ['Domain', details.domain],
  ];

  const versionRows = [
    ['Branch', details.branch],
    ['Commit Hash', details.commitHash],
    ['Commit Name', details.commitName],
    ['Edited At', details.editedAt],
    ['Source Repo', details.source],
  ];

  const userRows = [
    ['User Name', details.userName || 'N/A'],
    ['User Email', details.userEmail || 'N/A'],
  ];

  return `
  <div style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#f3f4f6;padding:24px;">
    <div style="max-width:760px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:linear-gradient(90deg,#4f46e5,#7c3aed);color:#fff;padding:16px 20px;">
        <h2 style="margin:0;font-size:20px;">Talk & Task Runtime Tracking Alert</h2>
        <p style="margin:6px 0 0 0;opacity:.9;">${escapeHtml(eventName)} | systematic rollback trail</p>
      </div>
      <div style="padding:20px;">
        <h3 style="margin:0 0 8px 0;color:#111827;font-size:15px;">System Status</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">${toRows(systemRows)}</table>
        <h3 style="margin:0 0 8px 0;color:#111827;font-size:15px;">Version Tracking</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">${toRows(versionRows)}</table>
        <h3 style="margin:0 0 8px 0;color:#111827;font-size:15px;">User Context</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">${toRows(userRows)}</table>
      </div>
    </div>
  </div>`;
}

export async function notifyRuntimeEvent(eventName, payload = {}) {
  const details = {
    event: eventName,
    status: payload.status || 'INFO',
    note: payload.note || 'Tracking event for rollback and commit-level audit.',
    time: new Date().toISOString(),
    domain: window.location.host || 'unknown',
    ...payload,
  };

  const html = buildHtml(eventName, details);

  await addDoc(collection(db, 'event_logs'), {
    eventName,
    details,
    createdAt: serverTimestamp(),
  });

  await addDoc(collection(db, 'mail'), {
    to: [EMAIL_TO],
    message: {
      subject: `[TRACK:${details.status}] ${eventName} | ${details.branch || 'unknown-branch'} | ${details.commitHash || 'unknown-commit'}`,
      text: Object.entries(details).map(([k, v]) => `${k}: ${v}`).join('\n'),
      html,
    },
    createdAt: serverTimestamp(),
  });
}
