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

const transporter = createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
});

await transporter.sendMail({ from, to, subject, text });
console.log(`[git-event-email] Email sent for event: ${event}`);
