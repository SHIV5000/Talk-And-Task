const webhookUrl = import.meta.env.VITE_EVENT_WEBHOOK_URL;

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toRows(data) {
  return Object.entries(data)
    .map(([key, value]) => `<tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;">${escapeHtml(key)}</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">${escapeHtml(value)}</td></tr>`)
    .join('');
}

function buildHtml(eventName, details) {
  return `
  <div style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#f3f4f6;padding:24px;">
    <div style="max-width:700px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:linear-gradient(90deg,#4f46e5,#7c3aed);color:#fff;padding:16px 20px;">
        <h2 style="margin:0;font-size:20px;">Talk & Task Event Alert</h2>
        <p style="margin:6px 0 0 0;opacity:.9;">${escapeHtml(eventName)}</p>
      </div>
      <div style="padding:20px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          ${toRows(details)}
        </table>
      </div>
    </div>
  </div>`;
}

export async function notifyRuntimeEvent(eventName, payload = {}) {
  if (!webhookUrl) return;

  const details = {
    event: eventName,
    time: new Date().toISOString(),
    domain: window.location.host || 'unknown',
    ...payload,
  };

  const body = {
    event: eventName,
    details,
    html: buildHtml(eventName, details),
  };

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
