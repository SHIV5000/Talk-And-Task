# Talk & Task Final Execution Proposal

## Purpose

This proposal converts `talkandtask_full_audit-FINAL.md` into an execution-ready roadmap for the final implementation phase. The audit should remain the business/security source of truth, while this proposal is the implementation guide that maps each recommendation to this repository's actual architecture.

## Important Repository Alignment Notes

The audit uses the generic term `workspaceId` and paths such as `workspaces/{workspaceId}`. The current repository already uses organization-scoped Firebase paths such as `organizations/{orgId}/messages`, `organizations/{orgId}/scheduled_messages`, and `organizations/{orgId}/uploads/...`. Final implementation should therefore treat:

- `workspaceId` in the audit as equivalent to the repo's `orgId` unless a deliberate schema migration is approved.
- `workspaces/{workspaceId}` in the audit as equivalent to `organizations/{orgId}` in this codebase.
- `workspace membership` as the existing org membership model driven by user `orgId`, organization documents, groups, custom claims, and role/admin checks.

A full schema rename from `orgId` to `workspaceId` is **not recommended** as part of hardening, because it would add migration risk without improving security. The safer execution path is to harden the existing `organizations/{orgId}` model.

## Current State Confirmed From Audit and Repo Review

The audit identifies the following launch blockers and scale gaps:

1. Tenant isolation and Firestore rule hardening are the highest priority.
2. Scheduled messages are currently delivery-critical but should not depend on client polling.
3. Chat/admin listeners need pagination and indexes before scale.
4. Chat rendering needs virtualization for large histories.
5. App Check, rate limiting, abuse prevention, monitoring, and budget alerts are required before production launch.
6. Admin destructive actions must be routed through server-side authorization and immutable audit logs.
7. Storage upload paths must match tenant-scoped Storage rules.
8. Offline persistence and denormalization are required to reduce latency and recurring Firebase costs.
9. TIME AS IST(INDIAN STANDARD TIME FOR SCHEDULES,ETC) 

Repo-specific observations that affect execution:

- `storage.rules` permits tenant uploads only under `organizations/{orgId}/uploads/...`, but chat uploads currently use the root `chat_uploads/...` path.
- `src/components/ChatApp.jsx` contains browser-side scheduled-message delivery logic that should move to Cloud Functions.
- `src/hooks/useChatEngine.js` subscribes to broad message queries without pagination.
- `src/components/Chat/ChatView.jsx` renders messages with a direct `.map`, not a virtualized list.
- `firebase.json` does not currently reference a `firestore.indexes.json` file.
- `src/firebase.js` initializes Firebase services but does not initialize App Check, Firebase Performance Monitoring, or Firestore persistent local cache.
- `functions/index.js` already uses Firebase Functions v2, so scheduled functions and shared callable options can be added without changing the functions platform.

## Execution Principles

1. **Security before performance**: complete P0 isolation and rule hardening before optimizing reads/renders.
2. **Server authority for privileged workflows**: delivery, role changes, tenant actions, abuse enforcement, and audit records should be server-controlled.
3. **No broad fallback writes**: Firestore rules should explicitly define each sensitive collection.
4. **Preserve current schema where possible**: use `orgId` and `organizations/{orgId}` instead of introducing a parallel `workspaceId` tree.
5. **Deploy incrementally**: each task should be committed separately and verified before moving to the next task.
6. **Document console-only setup**: Firebase App Check enforcement, billing budgets, uptime monitors, and Slack routing require external console work and must be documented clearly.

## Final Priority Plan

### P0 — Launch-Blocking Security and Core Reliability

#### Task 1 — Harden Firestore security rules per collection

**Goal:** Make Firestore zero-trust by default while preserving the existing `organizations/{orgId}` data model.

**Implementation proposal:**

- Refactor `firestore.rules` so each sensitive org subcollection has explicit read/write policies.
- Replace any broad same-org write fallback with either explicit denies or read-only fallback behavior.
- Require signed-in users, matching org membership, active organization status, and verified email for user-generated writes.
- Keep platform-owner support for tenant management only where required.
- Make audit logs append-only for clients, or preferably server-only.
- Restrict `scheduled_messages` so clients can create/update/cancel their own pending schedules but cannot mark messages as delivered/sent.
- Restrict `messages` so users can create messages only as themselves and only inside valid groups/scopes.

**Definition of done:**

- Rules explicitly cover `messages`, `scheduled_messages`, `groups`, `notifications`, `reminders`, `workspace`, `workspace_tags`, `audit_logs`, org details, and fallbacks.
- No client can access another org's data.
- No regular user can create/update privileged fields, admin fields, or delivery status fields.
- Legacy root collections remain denied.

#### Task 2 — Add org/workspace guards to all Firestore listeners and writes

**Goal:** Prevent queries and writes from running before the active tenant is known.

**Implementation proposal:**

- Audit all `onSnapshot`, `getDocs`, `addDoc`, `setDoc`, `updateDoc`, and `deleteDoc` calls.
- Ensure every org-scoped operation validates `orgId` first.
- Ensure all message/task/admin queries include tenant scope through the existing `organizations/{orgId}` path.
- Where collection-group or root user queries are necessary, add strict `orgId` filters and role checks.

**Definition of done:**

- No listener starts without `orgId`.
- No write to tenant data occurs outside `organizations/{orgId}/...` except intentional platform collections.
- User/task assignment lists are tenant-scoped.

#### Task 3 — Fix task assignment and member visibility boundaries

**Goal:** Prevent cross-tenant user leakage in task assignment, mentions, admin lists, and member dropdowns.

**Implementation proposal:**

- Replace any global user list used for assignment with an org-scoped member query.
- If using root `users`, always query by `where('orgId', '==', orgId)` and apply archived/approved filters.
- Ensure UI components receive only tenant-safe `dbUsers`.
- Add server-side validation in message/task creation paths so task assignees must belong to the same org.

**Definition of done:**

- Users can assign tasks only to current org members.
- Mentions, task delegates, admin edit lists, and group membership modals never expose another org's users.

#### Task 4 — Move scheduled message delivery to Cloud Functions

**Goal:** Deliver scheduled messages reliably and exactly once without browser polling.

**Implementation proposal:**

- Add `processScheduledMessages` in `functions/index.js` using `onSchedule`, running every minute.
- Query due pending schedules under organizations.
- Use transactions or status locks to prevent duplicate delivery.
- Write final message documents server-side.
- Update status from `pending` to `processing` to `sent` or `failed`.
- Store retry counts and error messages for observability.
- Remove the client-side scheduled delivery interval from `src/components/ChatApp.jsx`.
- Keep frontend schedule creation/edit/cancel UX, but do not let the frontend deliver or mark records as sent.

**Definition of done:**

- Scheduled messages send even when the sender is offline.
- Multiple browser tabs cannot duplicate scheduled sends.
- Clients cannot forge `sent` status.

#### Task 5 — Align Storage upload paths with tenant rules

**Goal:** Make uploads work under the allowed tenant-scoped Storage path and prevent cross-tenant file access.

**Implementation proposal:**

- Change chat upload paths from root `chat_uploads/...` to `organizations/${orgId}/uploads/chat/${groupId}/...`.
- Store `storagePath` with message metadata.
- Keep Storage reads/writes restricted to same-org users.
- Move authoritative quota updates/deletes to Cloud Functions.

**Definition of done:**

- Chat uploads succeed under deployed Storage rules.
- Files are isolated by org.
- Message records contain enough metadata to clean up files later.

#### Task 6 — Initialize and enforce Firebase App Check

**Goal:** Reduce automated abuse against Firestore, Storage, and Functions.

**Implementation proposal:**

- Add App Check initialization in `src/firebase.js` using reCAPTCHA v3 and a `VITE_FIREBASE_APPCHECK_SITE_KEY` env variable.
- Add local debug-token documentation for development.
- Add Firebase Console rollout steps.
- Add App Check enforcement to callable functions where safe.

**Definition of done:**

- Production builds request valid App Check tokens.
- Firestore, Storage, and Functions enforcement steps are documented.
- Local development still works with debug tokens.

### P1 — Scalability, Cost, and Performance

#### Task 7 — Add Firestore composite indexes

**Goal:** Prevent missing-index errors and support efficient paginated queries.

**Implementation proposal:**

- Create `firestore.indexes.json`.
- Update `firebase.json` to reference the indexes file.
- Add indexes for messages, scheduled messages, notifications, reminders, audit logs, package/tenant lookup queries, and any task dashboard queries.

**Definition of done:**

- All planned `where + orderBy` queries have committed index definitions.
- Firebase deploy can apply indexes from repo config.

#### Task 8 — Implement paginated Firestore data loading

**Goal:** Stop loading entire tenant histories into every client.

**Implementation proposal:**

- Create a reusable hook for paginated Firestore queries.
- Refactor chat messages to load the latest page first and older pages on demand.
- Add limits to admin views such as audit logs, reminders, notifications, user lists, and task dashboards.
- Preserve real-time updates for the latest page only.

**Definition of done:**

- Initial chat load fetches a bounded number of messages, such as 25–50.
- Older messages load through cursor pagination.
- Admin panels no longer subscribe to unbounded high-volume collections.

#### Task 9 — Virtualize the chat message list

**Goal:** Keep rendering smooth even with thousands of messages.

**Implementation proposal:**

- Add a virtualization dependency such as `react-window` or `@tanstack/react-virtual`.
- Replace direct message `.map` rendering in `ChatView.jsx` with virtualized rows.
- Preserve pinned banners, day separators, thread replies, unread highlights, scroll-to-message, and bottom-scroll behavior.
- Prefer a variable-height capable implementation because message bubbles can contain text, images, files, task controls, replies, and comments.

**Definition of done:**

- Only visible message rows are mounted.
- Large chats remain responsive.
- Existing chat interactions still work.

#### Task 10 — Enable Firestore offline persistence

**Goal:** Improve offline UX and reduce repeated reads.

**Implementation proposal:**

- Update `src/firebase.js` to initialize Firestore with persistent local cache support.
- Configure multi-tab behavior intentionally.
- Keep existing IndexedDB draft support for unsent drafts.
- Document fallback behavior for unsupported browsers/private mode.

**Definition of done:**

- Recently loaded data is available offline.
- Pending writes resume after reconnect.
- No duplicate messages are created after reconnect.

#### Task 11 — Add denormalized schema strategy and backfill plan

**Goal:** Reduce N+1 reads and make message/task rendering cheaper.

**Implementation proposal:**

- Document canonical schemas for messages, scheduled messages, tasks, notifications, reminders, audit logs, users, groups, and orgs.
- Ensure new message documents include stable display fields such as `senderName`, `senderAvatar`, `groupName`, `taskAssignees`, and task visibility fields.
- Add server-side or shared payload builders so client and function writes match.
- Add one-time backfill scripts for existing records if required.

**Definition of done:**

- Chat rendering does not need extra reads for common sender/group display details.
- Scheduled Cloud Function creates messages with the same schema as live sends.
- Documentation defines required and optional fields.

### P2 — Monitoring, Abuse Prevention, Admin Hardening, and Cost Controls

#### Task 12 — Add production monitoring and alerting

**Goal:** Make production errors, downtime, latency, and spend visible immediately.

**Implementation proposal:**

- Add Sentry React integration with source maps and user/org context.
- Add Firebase Performance Monitoring.
- Create a health endpoint or health page suitable for UptimeRobot/Better Uptime/Pingdom.
- Document Google Cloud Monitoring alerts for Function errors, Firestore usage, latency, and billing.
- Define Slack/email/SMS routing and incident severity levels.

**Definition of done:**

- Production errors appear in Sentry.
- Uptime loss creates an alert.
- Budget/usage alerts go to the configured channels.

#### Task 13 — Implement rate limiting and abuse prevention

**Goal:** Limit spam, bot writes, surprise bills, and compromised-user blast radius.

**Implementation proposal:**

- Require verified email for high-risk writes.
- Add callable-function rate limits for admin/destructive flows.
- Add write-rate monitoring per user/org/time bucket.
- Auto-restrict or disable suspicious users after threshold breaches.
- Add signup/onboarding rate controls by IP where server-side IP metadata is available.
- Log abuse events for admin review.

**Definition of done:**

- Excessive writes are blocked or throttled.
- Suspicious accounts can be automatically restricted.
- Admins can review abuse events.

#### Task 14 — Move admin destructive actions behind callable functions

**Goal:** Ensure admin operations are authorized server-side and auditable.

**Implementation proposal:**

- Identify direct admin/developer console writes for role changes, user deletion, tenant suspension, tenant deletion, package edits, exports, and DSAR actions.
- Move privileged operations to callables in `functions/index.js`.
- Add shared function options: region, timeout, memory, max instances, and App Check enforcement.
- Add immutable audit logs for every privileged change.
- Tighten Firestore rules to prevent clients from bypassing callables.

**Definition of done:**

- No destructive admin action relies only on client-side checks.
- Every privileged action records actor, target, org, timestamp, and details.

#### Task 15 — Document cost and surprise-bill safeguards

**Goal:** Keep the ₹200–300/user pricing model profitable and predictable.

**Implementation proposal:**

- Create a cost-control document covering budget alerts at 50%, 80%, and 90%.
- Add Cloud Functions `maxInstances` limits where applicable.
- Document Firestore read/write/storage assumptions and INR conversion.
- Document optional Cloud Armor guidance for exposed HTTP endpoints.
- Add launch checklist items for monitoring Firebase quotas daily.

**Definition of done:**

- Cost controls are documented in repo.
- Function scaling limits are configured in code.
- Budget alerts and incident routing are clearly described for operators.

## P3 — Future Enhancements (Not Blocking Launch)

These improvements are recommended for long‑term scalability, UX polish, and cost optimisation. They can be scheduled after the app is live and stable.

#### Task 16 — Move typing indicators from Firestore to Realtime Database

**Why:** Firestore is not designed for high‑frequency ephemeral writes. Typing indicators generate excessive write operations and never get cleaned up.

**Implementation proposal:**
- Use Firebase Realtime Database (RTDB) with path: `typing/{orgId}/{chatId}/{userId}`.
- Set value to `true` while typing, use `onDisconnect().remove()` to auto‑clean.
- Listen to RTDB and display “User is typing…” in the chat UI.
- Keep Firestore for all persistent data.

**Definition of done:** Typing indicators work but do not appear in Firestore usage or billing.

#### Task 17 — Partition PWA cache by `orgId`

**Why:** The current service worker caches Firestore responses keyed only by URL. When a user switches organizations offline, stale data from the previous organization may appear.

**Implementation proposal:**
- In the service worker (`sw.js`), prepend `orgId` to the cache key: `${orgId}:${request.url}`.
- When the user switches organizations, clear the active cache or re‑fetch data.
- Ensure the service worker can access the current `orgId` (e.g., from a custom claim or IndexedDB).

**Definition of done:** Offline data is correctly isolated per organization.

#### Task 18 — Add scheduled message cancellation from client

**Why:** Users should be able to cancel a pending scheduled message without developer intervention.

**Implementation proposal:**
- Extend the frontend UI to list pending scheduled messages for the current user.
- Add a “Cancel” button that updates the Firestore document: `cancelled: true`.
- Modify the scheduled‑message Cloud Function to skip delivery if `cancelled == true`.
- Keep the original document for audit purposes (do not delete).

**Definition of done:** Users can cancel any future message they scheduled.

#### Task 19 — Automatic audit log deletion (TTL)

**Why:** Audit logs grow indefinitely, increasing storage costs and query time.

**Implementation proposal:**
- Add a Cloud Function that runs monthly (e.g., on the 1st day).
- Delete audit log documents older than 90 days (or a configurable retention period).
- Optionally write a summary record of deleted counts to a separate “audit_log_archive” collection.

**Definition of done:** Audit logs never exceed 90 days of history unless explicitly configured.

#### Task 20 — Implement full denormalization backfill script

**Why:** New messages will include denormalised fields (`senderName`, `senderAvatar`, etc.), but old messages lack them, causing inconsistent UI.

**Implementation proposal:**
- Write a one‑time Node.js script (or Cloud Function) that iterates over all `messages` collections.
- For each message, look up the sender’s current name/avatar from the `users` collection (or a snapshot at that time).
- Update the message document with the denormalised fields.
- Run the script during a maintenance window.

**Definition of done:** All existing messages have the same shape as new messages, eliminating extra reads.

#### Task 21 — Document and automate Firestore backup restoration test

**Why:** Backups exist (PITR, scheduled backups) but have never been tested for restore.

**Implementation proposal:**
- Write a runbook describing how to restore a Firestore database from a backup to a new project.
- Perform a quarterly dry‑run restore to verify RTO (recovery time objective) and data integrity.

**Definition of done:** Restore procedure is documented and has been tested successfully at least once.

## Recommended Commit Sequence For Final Execution

1. `[P0-task1] harden firestore rules`
2. `[P0-task2] enforce org guards on data access`
3. `[P0-task3] scope member and task assignment data`
4. `[P0-task4] deliver scheduled messages server-side`
5. `[P0-task5] align storage upload paths`
6. `[P0-task6] initialize app check`
7. `[P1-task7] add firestore indexes`
8. `[P1-task8] paginate chat and admin data`
9. `[P1-task9] virtualize chat rendering`
10. `[P1-task10] enable firestore offline cache`
11. `[P1-task11] document denormalized schemas`
12. `[P2-task12] add monitoring and alerting`
13. `[P2-task13] add abuse prevention controls`
14. `[P2-task14] secure admin actions with callables`
15. `[P2-task15] document cost guardrails`

## Verification Matrix

| Area | Verification |
| --- | --- |
| Tenant isolation | Test two orgs with separate users; verify each user sees only own messages, tasks, groups, files, reminders, notifications, and members. |
| Rules | Run Firebase Emulator rules tests or manual emulator scripts for allow/deny cases. |
| Scheduled messages | Schedule a message, close all browser sessions, and verify Cloud Function delivers exactly once. |
| Storage | Upload a file as one org and verify another org cannot read it. |
| Pagination | Confirm initial chat/admin loads have bounded document reads. |
| Virtualization | Load a large seeded chat and confirm DOM node count stays bounded. |
| Offline | Load app, disconnect network, confirm cached data/drafts work, reconnect, and confirm no duplicates. |
| Monitoring | Trigger a controlled frontend error and Function error; verify alerts arrive. |
| Abuse controls | Simulate high write rates and confirm throttling/restriction. |
| Cost controls | Verify budgets, max instances, and quota dashboards are documented and configured. |

## Final Execution Readiness Checklist

Before implementation starts, confirm:

- Firebase project and environments are known.
- App Check reCAPTCHA v3 site key is available.
- Sentry DSN and alert channels are available.
- Billing budget amount and Slack/email/SMS recipients are approved.
- Production domain or health endpoint URL is known.
- Any schema migration from `orgId` to `workspaceId` is explicitly rejected or separately approved.

## Proposed First Implementation Sprint

To reduce risk, execute the first sprint as:

1. Storage upload path fix.
2. Firestore rules hardening.
3. Org guard audit.
4. Scheduled-message Cloud Function.
5. Firestore indexes for the changed queries.

This sequence closes the largest security/reliability gaps before larger UI/performance refactors.
