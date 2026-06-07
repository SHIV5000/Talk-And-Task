# Firestore Backup Restore Test Runbook

## Goal
Run a quarterly dry-run restore so backups are proven usable before an incident.

## Frequency
- Quarterly for production.
- After any major schema/rules migration.
- Before enabling irreversible retention/TTL policies.

## Dry-run restore steps
1. Create or select an isolated staging Firebase/GCP project.
2. Export production Firestore to a dated Cloud Storage folder.
3. Import the export into staging only.
4. Deploy matching `firestore.rules`, `firestore.indexes.json`, and Cloud Functions to staging.
5. Run smoke checks:
   - Sign in as admin and regular user.
   - Open chat, tasks, notifications, support tickets, scheduled messages, and files.
   - Confirm cross-org reads remain denied.
   - Confirm scheduled processors do not send production messages from staging.
6. Record restore duration, data size, errors, and remediation steps.

## Acceptance criteria
- Restore completes without manual data edits.
- Staging app can read restored tenant data with expected RBAC.
- No production users are emailed/notified by staging.
- Any index/rule/function mismatch is documented and fixed.

## Evidence to retain
- Export path.
- Import command output.
- Smoke-test notes.
- Date, operator, and next scheduled restore test.
