#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { createTransport } from 'nodemailer';

const event = process.argv[2] || 'manual';

function run(cmd, fallback = 'unknown') {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || fallback;
  } catch {
    return fallback;
  }
}

const host = process.env.GIT_EVENT_SMTP_HOST;
const port = Number(process.env.GIT_EVENT_SMTP_PORT || 587);
const user = process.env.GIT_EVENT_SMTP_USER;
const pass = process.env.GIT_EVENT_SMTP_PASS;
const from = process.env.GIT_EVENT_FROM;
const to = process.env.GIT_EVENT_TO;

if (!host || !user || !pass || !from || !to) {
  console.warn('[git-event-email] Missing env vars; skipping email.');
  process.exit(0);
}

const branch = run('git rev-parse --abbrev-ref HEAD');
const commitHash = run('git rev-parse --short HEAD');
const commitMessage = run('git log -1 --pretty=%s');
const editedAt = run('git log -1 --date=format-local:%d-%b-%y %H:%M --pretty=%cd');
const repo = run('git config --get remote.origin.url');
const author = run('git log -1 --pretty=%an');

const subject = `[Talk-And-Task] ${event} on ${branch} (${commitHash})`;
const text = [
  `Event: ${event}`,
  `Branch: ${branch}`,
  `Commit: ${commitHash}`,
  `Commit Name: ${commitMessage}`,
  `Edited: ${editedAt}`,
  `Author: ${author}`,
  `Source: ${repo}`,
].join('\n');

const html = `
<div style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#f3f4f6;padding:24px;">
  <div style="max-width:700px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:linear-gradient(90deg,#4f46e5,#7c3aed);color:#fff;padding:16px 20px;">
      <h2 style="margin:0;font-size:20px;">Talk & Task Git Event</h2>
      <p style="margin:6px 0 0 0;opacity:.9;">${event}</p>
    </div>
    <div style="padding:20px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;">Branch</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">${branch}</td></tr>
        <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;">Commit</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">${commitHash}</td></tr>
        <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;">Commit Name</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">${commitMessage}</td></tr>
        <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;">Edited</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">${editedAt}</td></tr>
        <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;">Author</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">${author}</td></tr>
        <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;">Source</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">${repo}</td></tr>
      </table>
    </div>
  </div>
</div>`;

const transporter = createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
});

await transporter.sendMail({ from, to, subject, text, html });
console.log(`[git-event-email] Email sent for event: ${event}`);
