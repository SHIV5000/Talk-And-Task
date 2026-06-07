# Talk & Task Manual Interventions Guide

This file consolidates every non-code / console / operational action required after the implementation batches. Treat this as the launch checklist for staging first, then production.

## 1. Firebase / GCP deployment order

Run deployments in this order so rules and backend support exist before users exercise the new UI:

1. Deploy Firestore rules and indexes.
2. Deploy Storage rules.
3. Deploy Realtime Database rules.
4. Deploy Cloud Functions.
5. Deploy the web app.
6. Run the verification checklist in this document.

Recommended commands from a configured Firebase CLI environment:

```bash
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only storage:rules
firebase deploy --only database
firebase deploy --only functions
npm run build
firebase deploy --only hosting
```

> If hosting is not configured in this repository/project, deploy the built `dist/` folder using your current hosting pipeline.

## 2. Firebase App Check setup

App Check is initialized in the web client, but console setup is mandatory.

### Production setup

1. Open Firebase Console → App Check.
2. Register the web app with **reCAPTCHA v3**.
3. Copy the site key into production environment variables as:

```bash
VITE_FIREBASE_APPCHECK_SITE_KEY=<recaptcha-v3-site-key>
```

4. Start in **Monitor mode** for Firestore, Storage, and callable Functions.
5. Review App Check metrics for blocked/invalid traffic.
6. Move to **Enforce** only after staging and production smoke checks pass.

### Local development / staging debug token

For local development, add a debug token:

```bash
VITE_FIREBASE_APPCHECK_DEBUG_TOKEN=true
```

or set a specific token value:

```bash
VITE_FIREBASE_APPCHECK_DEBUG_TOKEN=<debug-token-from-console>
```

Then register that debug token in Firebase Console → App Check → debug tokens.

## 3. Trigger Email extension setup

Secure PDF OTP emails and later support-ticket emails require an email delivery provider.

1. Open Firebase Console → Extensions.
2. Install **Trigger Email** extension.
3. Configure SMTP / email provider credentials.
4. Confirm the extension listens to the `mail` collection.
5. Send a staging OTP and verify the email body arrives.
6. Verify sender/from address branding matches the school/organization policy.

Secure PDF OTP flow writes OTP mail documents into `mail`, so without this extension OTP generation can succeed but users will not receive the OTP email.

## 4. Realtime Database typing indicators

Typing indicators were moved to Realtime Database path:

```text
typing/{orgId}/{chatId}/{uid}
```

Manual steps:

1. Confirm Realtime Database is enabled in the Firebase project.
2. Confirm the production database URL matches `databaseURL` in `src/firebase.js`.
3. Deploy `database.rules.json`:

```bash
firebase deploy --only database
```

4. In staging, sign in as two users in the same org and same chat.
5. Type from one account and verify the other sees the typing indicator.
6. Close the typing user’s browser tab and verify `onDisconnect().remove()` clears the indicator.

## 5. Firestore indexes and rules

Firestore rules and indexes must be deployed together before production verification.

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Staging checks:

1. Confirm cross-org users cannot read each other’s messages, tasks, support tickets, files, reminders, notifications, or audit logs.
2. Confirm regular users cannot write privileged fields such as delivery status, roles, admin flags, sent status, audit logs, support ticket internals, or retention cleanup logs.
3. If Firestore displays a missing-index link during staging, create the suggested index, export it into `firestore.indexes.json`, commit it, and redeploy indexes.

## 6. Storage rules and tenant upload paths

Storage upload paths now use:

```text
organizations/{orgId}/uploads/...
```

Manual checks:

1. Deploy Storage rules:

```bash
firebase deploy --only storage:rules
```

2. Upload a chat file from an org user.
3. Verify the object path starts with `organizations/<orgId>/uploads/chat/`.
4. Verify another org user cannot read that file.
5. Verify storage usage fields update after object finalize/delete functions run.

## 7. Cloud Functions and scheduler setup

The implementation uses scheduled functions, callable functions, storage triggers, and HTTPS health endpoint.

### Required APIs / services

Enable or verify:

1. Cloud Functions.
2. Cloud Scheduler.
3. Cloud Build.
4. Artifact Registry.
5. Eventarc.
6. Firebase Extensions / Trigger Email where applicable.

### Deploy functions

```bash
firebase deploy --only functions
```

### Scheduler jobs to verify

After deployment, verify Cloud Scheduler entries exist for:

1. `processScheduledMessages` — every minute, IST-aware delivery logic.
2. `sendSecurePdfDownloadSummaries` — daily 3 PM IST summary messages.
3. `deleteExpiredAuditLogs` — monthly audit-log TTL cleanup.

### Function runtime / limits

The code contains max-instance guards for high-risk functions. Confirm in Cloud Console that deployed functions reflect expected runtime settings, region, and max instances.

## 8. Secure PDF download pipeline

Secure PDF flow requires both backend functions and Trigger Email.

Staging checklist:

1. Upload a PDF.
2. Enable **Secure Download**.
3. Select at least one recipient.
4. Confirm unauthorized users see restricted state.
5. As an authorized recipient, request OTP.
6. Confirm OTP email arrives.
7. Enter OTP and confirm a short-lived download URL opens.
8. Try the same OTP again and confirm replay is blocked.
9. Try a second download for the same user/file and confirm one-time enforcement.
10. Confirm sender receives daily summary after scheduled function runs.

Important production note:

- The current function records secure audit metadata and returns a short-lived signed URL.
- If your launch requirement is **visual PDF page stamping** on every page, add and deploy a server-side PDF stamping implementation/library before marking that sub-feature production-complete.

## 9. Monitoring and alerting

### Firebase Performance Monitoring

1. Open Firebase Console → Performance.
2. Confirm web app traffic appears after deployment.
3. Watch page load, network traces, and slow route metrics for 24 hours after launch.

### Health endpoint uptime check

1. Deploy functions.
2. Locate the `health` HTTPS endpoint URL.
3. Create a GCP uptime check against that URL.
4. Alert if two consecutive checks fail.

Manual verification:

```bash
curl <health-function-url>
```

Expected response includes:

```json
{ "ok": true }
```

### Error monitoring / Sentry

Sentry was documented but the dependency install previously failed due to registry access restrictions. Complete manually when npm registry access is available:

```bash
npm install @sentry/react
```

Then:

1. Create a Sentry React project.
2. Add `VITE_SENTRY_DSN=<dsn>` to environment variables.
3. Initialize Sentry in the app entrypoint.
4. Configure alerts for unhandled frontend errors.

## 10. Billing budget and cost safeguards

Create GCP Billing budget alerts:

1. 50% threshold.
2. 80% threshold.
3. 90% threshold.

Recipients:

1. Project owner email.
2. School/admin billing contact.
3. Slack/email incident channel if available.

Monitor dashboards:

1. Firestore reads/writes/deletes.
2. Firestore index storage.
3. Cloud Functions invocations/errors/latency.
4. Storage bytes and egress.
5. Per-organization `storageUsedBytes` vs. package limits.

## 11. Support ticket system setup

Support tickets are stored under each organization and use callable functions.

Staging checks:

1. Regular user can create only one ticket per week.
2. Regular user sees only their own tickets.
3. Admin sees all tickets in their org.
4. Admin can pause/resume ticket intake.
5. Users see paused support messaging when intake is disabled.
6. Admin can set statuses: open → in-progress → resolved / closed.
7. Admin internal notes are not exposed as client-writable data.
8. Developer unavailable dates recalculate estimated resolution dates.

If staging shows a Firestore missing-index prompt for support ticket queries, create and commit the generated index.

## 12. Denormalized message backfill

A backfill script was added for old messages.

### Dry run first

```bash
node scripts/backfill-denormalized-messages.mjs
```

Optional single-org dry run:

```bash
node scripts/backfill-denormalized-messages.mjs --org=<orgId>
```

### Apply after reviewing counts

```bash
node scripts/backfill-denormalized-messages.mjs --apply
```

Optional single-org apply:

```bash
node scripts/backfill-denormalized-messages.mjs --org=<orgId> --apply
```

Post-check:

1. Open old chat messages.
2. Confirm sender name/avatar and group name render without extra lookup failures.
3. Open old task cards.
4. Confirm task title/status/priority/assignee fields display correctly.

## 13. Backup restore dry-run

Follow `BACKUP_RESTORE_TEST.md` before launch and quarterly after launch.

Minimum acceptance criteria:

1. Firestore export imports into isolated staging without manual edits.
2. Staging app can read restored tenant data with expected RBAC.
3. No staging function sends production user emails or notifications.
4. Index/rule/function mismatches are documented and fixed.

## 14. Final staging smoke-test matrix

Run this matrix before enabling production enforcement:

1. Login with valid user.
2. Login with invalid password and confirm custom school-admin error.
3. Confirm 4-second launch splash behavior.
4. Send normal message.
5. Send rich-text message.
6. Attach external named link and confirm raw URL is hidden.
7. Upload regular file and image.
8. Upload secure PDF and complete OTP download.
9. Create, edit, cancel scheduled message.
10. Confirm scheduled function sends due message when browser is offline.
11. Create task card.
12. Verify assignee/creator labels.
13. Confirm completed task cannot be edited/attached by unauthorized user.
14. Confirm typing indicator appears and clears using RTDB.
15. Create support ticket.
16. Admin replies and resolves support ticket.
17. Verify universal notification opens target message/ticket.
18. Verify reaction summary view opens from reaction chip.
19. Confirm Firestore offline cache behavior in a supported browser.
20. Confirm cross-org read/write attempts fail.

## 15. Production cutover checklist

Before production launch:

- [ ] Firestore rules deployed.
- [ ] Firestore indexes deployed.
- [ ] Storage rules deployed.
- [ ] Realtime Database rules deployed.
- [ ] Cloud Functions deployed.
- [ ] Web app deployed.
- [ ] App Check monitor mode verified.
- [ ] Trigger Email extension verified.
- [ ] Budget alerts configured at 50/80/90%.
- [ ] Health endpoint uptime check configured.
- [ ] Performance Monitoring receiving traffic.
- [ ] Support ticket flow tested.
- [ ] Secure PDF OTP flow tested.
- [ ] Scheduled delivery tested with sender offline.
- [ ] Denormalization backfill dry-run reviewed.
- [ ] Backup restore dry-run completed or scheduled with owner/date.
- [ ] App Check enforcement date approved.

## 16. Recommended rollout sequence

1. Deploy to staging.
2. Run full smoke matrix.
3. Fix any missing indexes or environment values.
4. Run backfill dry-run.
5. Deploy to production with App Check in monitor mode.
6. Watch health, functions, Firestore, Storage, and billing dashboards for 24–48 hours.
7. Enable App Check enforcement gradually.
8. Run production backfill with `--apply` during a low-traffic window.
9. Schedule quarterly backup restore test.
