Talk & Task Final Execution Proposal (Complete)
Purpose
This proposal converts talkandtask_full_audit-FINAL.md into an execution‑ready roadmap for the final implementation phase, including all additional UI/UX, security, and feature requirements. The audit remains the business/security source of truth, while this document is the implementation guide that maps each recommendation to this repository's actual architecture.

Important Repository Alignment Notes
The audit uses the generic term workspaceId and paths such as workspaces/{workspaceId}. The current repository already uses organization‑scoped Firebase paths such as organizations/{orgId}/messages, organizations/{orgId}/scheduled_messages, and organizations/{orgId}/uploads/.... Final implementation should therefore treat:

workspaceId in the audit as equivalent to the repo's orgId unless a deliberate schema migration is approved.

workspaces/{workspaceId} in the audit as equivalent to organizations/{orgId} in this codebase.

workspace membership as the existing org membership model driven by user orgId, organization documents, groups, custom claims, and role/admin checks.

A full schema rename from orgId to workspaceId is not recommended as part of hardening, because it would add migration risk without improving security. The safer execution path is to harden the existing organizations/{orgId} model.

Current State Confirmed From Audit and Repo Review
The audit identifies the following launch blockers and scale gaps:

Tenant isolation and Firestore rule hardening are the highest priority.

Scheduled messages are currently delivery‑critical but should not depend on client polling.

Chat/admin listeners need pagination and indexes before scale.

Chat rendering needs virtualization for large histories.

App Check, rate limiting, abuse prevention, monitoring, and budget alerts are required before production launch.

Admin destructive actions must be routed through server‑side authorization and immutable audit logs.

Storage upload paths must match tenant‑scoped Storage rules.

Offline persistence and denormalization are required to reduce latency and recurring Firebase costs.

TIME AS IST (Indian Standard Time) for schedules, timestamps, and scheduled functions.

Repo‑specific observations that affect execution:

storage.rules permits tenant uploads only under organizations/{orgId}/uploads/..., but chat uploads currently use the root chat_uploads/... path.

src/components/ChatApp.jsx contains browser‑side scheduled‑message delivery logic that should move to Cloud Functions.

src/hooks/useChatEngine.js subscribes to broad message queries without pagination.

src/components/Chat/ChatView.jsx renders messages with a direct .map, not a virtualized list.

firebase.json does not currently reference a firestore.indexes.json file.

src/firebase.js initializes Firebase services but does not initialize App Check, Firebase Performance Monitoring, or Firestore persistent local cache.

functions/index.js already uses Firebase Functions v2, so scheduled functions and shared callable options can be added without changing the functions platform.

Execution Principles
Security before performance – complete P0 isolation and rule hardening before optimizing reads/renders.

Server authority for privileged workflows – delivery, role changes, tenant actions, abuse enforcement, and audit records should be server‑controlled.

No broad fallback writes – Firestore rules should explicitly define each sensitive collection.

Preserve current schema where possible – use orgId and organizations/{orgId} instead of introducing a parallel workspaceId tree.

Deploy incrementally – each task should be committed separately and verified before moving to the next task.

Document console‑only setup – Firebase App Check enforcement, billing budgets, uptime monitors, and Slack routing require external console work and must be documented clearly.

Final Priority Plan
P0 – Launch‑Blocking Security and Core Reliability
Task 1 – Harden Firestore security rules per collection
Goal: Make Firestore zero‑trust by default while preserving the existing organizations/{orgId} data model.

Implementation:

Refactor firestore.rules so each sensitive org subcollection has explicit read/write policies.

Replace any broad same‑org write fallback with either explicit denies or read‑only fallback behavior.

Require signed‑in users, matching org membership, active organization status, and verified email for user‑generated writes.

Keep platform‑owner support for tenant management only where required.

Make audit logs append‑only for clients, or preferably server‑only.

Restrict scheduled_messages so clients can create/update/cancel their own pending schedules but cannot mark messages as delivered/sent.

Restrict messages so users can create messages only as themselves and only inside valid groups/scopes.

Definition of done:

Rules explicitly cover messages, scheduled_messages, groups, notifications, reminders, workspace, workspace_tags, audit_logs, org details, and fallbacks.

No client can access another org's data.

No regular user can create/update privileged fields, admin fields, or delivery status fields.

Legacy root collections remain denied.

Task 2 – Add org/workspace guards to all Firestore listeners and writes
Goal: Prevent queries and writes from running before the active tenant is known.

Implementation:

Audit all onSnapshot, getDocs, addDoc, setDoc, updateDoc, and deleteDoc calls.

Ensure every org‑scoped operation validates orgId first.

Ensure all message/task/admin queries include tenant scope through the existing organizations/{orgId} path.

Where collection‑group or root user queries are necessary, add strict orgId filters and role checks.

Definition of done:

No listener starts without orgId.

No write to tenant data occurs outside organizations/{orgId}/... except intentional platform collections.

User/task assignment lists are tenant‑scoped.

Task 3 – Fix task assignment and member visibility boundaries
Goal: Prevent cross‑tenant user leakage in task assignment, mentions, admin lists, and member dropdowns.

Implementation:

Replace any global user list used for assignment with an org‑scoped member query.

If using root users, always query by where('orgId', '==', orgId) and apply archived/approved filters.

Ensure UI components receive only tenant‑safe dbUsers.

Add server‑side validation in message/task creation paths so task assignees must belong to the same org.

Definition of done:

Users can assign tasks only to current org members.

Mentions, task delegates, admin edit lists, and group membership modals never expose another org's users.

Task 4 – Move scheduled message delivery to Cloud Functions
Goal: Deliver scheduled messages reliably and exactly once without browser polling.

Implementation:

Add processScheduledMessages in functions/index.js using onSchedule, running every minute.

Query due pending schedules under organizations.

Use transactions or status locks to prevent duplicate delivery.

Write final message documents server‑side.

Update status from pending to processing to sent or failed.

Store retry counts and error messages for observability.

Remove the client‑side scheduled delivery interval from src/components/ChatApp.jsx.

Keep frontend schedule creation/edit/cancel UX, but do not let the frontend deliver or mark records as sent.

Definition of done:

Scheduled messages send even when the sender is offline.

Multiple browser tabs cannot duplicate scheduled sends.

Clients cannot forge sent status.

Task 5 – Align Storage upload paths with tenant rules
Goal: Make uploads work under the allowed tenant‑scoped Storage path and prevent cross‑tenant file access.

Implementation:

Change chat upload paths from root chat_uploads/... to organizations/${orgId}/uploads/chat/${groupId}/....

Store storagePath with message metadata.

Keep Storage reads/writes restricted to same‑org users.

Move authoritative quota updates/deletes to Cloud Functions.

Definition of done:

Chat uploads succeed under deployed Storage rules.

Files are isolated by org.

Message records contain enough metadata to clean up files later.

Task 6 – Initialize and enforce Firebase App Check
Goal: Reduce automated abuse against Firestore, Storage, and Functions.

Implementation:

Add App Check initialization in src/firebase.js using reCAPTCHA v3 and a VITE_FIREBASE_APPCHECK_SITE_KEY env variable.

Add local debug‑token documentation for development.

Add Firebase Console rollout steps.

Add App Check enforcement to callable functions where safe.

Definition of done:

Production builds request valid App Check tokens.

Firestore, Storage, and Functions enforcement steps are documented.

Local development still works with debug tokens.

Task 7 – Harden Task Card edit and file‑attachment permissions
Goal: Extend edit and file‑attachment rights to Admin/Creator roles until task status is “Completed”, while respecting org boundaries.

Implementation:

Modify Firestore rules and/or client logic so that only the task creator or admins can edit/attach files when status != "completed".

Ensure completed tasks are read‑only (no edit/attachment) even for those roles.

Enforce server‑side (rules) and reflect in UI.

Definition of done:

Non‑privileged users cannot edit or attach files to tasks that are not theirs; completed tasks are locked for all.

P1 – Scalability, Cost, Performance, and Critical UX Fixes
Task 8 – Add Firestore composite indexes
Goal: Prevent missing‑index errors and support efficient paginated queries.

Implementation:

Create firestore.indexes.json.

Update firebase.json to reference the indexes file.

Add indexes for messages, scheduled messages, notifications, reminders, audit logs, package/tenant lookup queries, and any task dashboard queries.

Definition of done:

All planned where + orderBy queries have committed index definitions.

Firebase deploy can apply indexes from repo config.

Task 9 – Implement paginated Firestore data loading
Goal: Stop loading entire tenant histories into every client.

Implementation:

Create a reusable hook for paginated Firestore queries.

Refactor chat messages to load the latest page first and older pages on demand.

Add limits to admin views such as audit logs, reminders, notifications, user lists, and task dashboards.

Preserve real‑time updates for the latest page only.

Definition of done:

Initial chat load fetches a bounded number of messages, such as 25–50.

Older messages load through cursor pagination.

Admin panels no longer subscribe to unbounded high‑volume collections.

Task 10 – Virtualize the chat message list
Goal: Keep rendering smooth even with thousands of messages.

Implementation:

Add a virtualization dependency such as react-window or @tanstack/react-virtual.

Replace direct message .map rendering in ChatView.jsx with virtualized rows.

Preserve pinned banners, day separators, thread replies, unread highlights, scroll‑to‑message, and bottom‑scroll behavior.

Prefer a variable‑height capable implementation because message bubbles can contain text, images, files, task controls, replies, and comments.

Definition of done:

Only visible message rows are mounted.

Large chats remain responsive.

Existing chat interactions still work.

Task 11 – Enable Firestore offline persistence
Goal: Improve offline UX and reduce repeated reads.

Implementation:

Update src/firebase.js to initialize Firestore with persistent local cache support.

Configure multi‑tab behavior intentionally.

Keep existing IndexedDB draft support for unsent drafts.

Document fallback behavior for unsupported browsers/private mode.

Definition of done:

Recently loaded data is available offline.

Pending writes resume after reconnect.

No duplicate messages are created after reconnect.

Task 12 – Add denormalized schema strategy and backfill plan
Goal: Reduce N+1 reads and make message/task rendering cheaper.

Implementation:

Document canonical schemas for messages, scheduled messages, tasks, notifications, reminders, audit logs, users, groups, and orgs.

Ensure new message documents include stable display fields such as senderName, senderAvatar, groupName, taskAssignees, and task visibility fields.

Add server‑side or shared payload builders so client and function writes match.

Add one‑time backfill scripts for existing records if required.

Definition of done:

Chat rendering does not need extra reads for common sender/group display details.

Scheduled Cloud Function creates messages with the same schema as live sends.

Documentation defines required and optional fields.

Task 13 – Fix Task Card formatting bug (raw HTML tags visible)
Goal: Resolve the formatting issue where raw HTML tags are visible during text styling in the Task Card input and ensure formatted text renders correctly upon submission/posting.

Implementation:

Sanitize/parse rich‑text input so that tags are not displayed as plain text.

Ensure preview and posted card show the same styled output.

Definition of done:

No raw HTML tags visible in task cards; formatting (bold, italic, colours) renders correctly.

Task 14 – Fix message reply input responsiveness
Goal: The reply input box must wrap text to the next line within the container and utilize the full width of the text box area, rather than expanding horizontally beyond the message bubble.

Implementation:

Adjust CSS so the reply text area does not overflow the message bubble.

Set overflow-wrap: break-word and constrain max‑width.

Definition of done:

Long unbroken text wraps correctly; input remains within message bubble bounds.

Task 15 – Implement persistent formatting toolbar for reply text box
Goal: The Rich‑Text formatting toolbar (Bold, Italic, Underline, Bullet Points, 4 colour options) remains persistently visible rather than hidden or context‑dependent.

Implementation:

Make the toolbar fixed (not hidden/context‑dependent) and ensure it does not interfere with other UI elements.

Definition of done:

Toolbar visible whenever the reply input is active.

Task 16 – Fix Z‑index/layering issues
Goal: Implement strict Z‑index management for Menus, Task Cards, and Message Bubbles to prevent them from being obscured by other UI elements, such as top navigation bars or other message bubbles.

Implementation:

Audit and assign appropriate z-index values across all floating/overlay components.

Use a layered system (e.g., base, dropdown, modal).

Definition of done:

No UI element is hidden behind another when opened.

Task 17 – Fix scroll arrow visibility
Goal: Adjust the positioning of the chat area scroll arrows to ensure they are never obscured by the main chat input box, regardless of screen resolution or aspect ratio.

Implementation:

Adjust arrow positioning or margin so that they remain visible regardless of viewport size.

Definition of done:

Arrows fully visible and clickable on all supported screen resolutions.

Task 18 – Implement task completion state restrictions
Goal: Disable the edit functionality (e.g., remove/disable the pencil icon) for the task title once the status is updated to “Completed”.

Implementation:

Remove or disable the pencil icon when status == "completed".

Enforce at the server level (Firestore rules).

Definition of done:

Completed tasks cannot be edited.

Task 19 – Fix “Typing…” indicator bug on Clear
Goal: Debug the “Clear” function in the main input text box. Currently, clicking “Clear” incorrectly triggers the “Typing…” presence indicator status; this must be suppressed.

Implementation:

Ensure typing indicator only activates on actual text entry, not on clear/delete actions.

Definition of done:

Typing status stays false after clearing the input.

Task 20 – Optimise login flow
Goal: Replace the current initialisation screen with a 4‑second branded loading animation. All background assets (user data, profile photos) must be fully loaded within this timeframe. Resolve the bug causing intermittent “User ID does not exist” flash errors.

Implementation:

Implement a splash screen that persists for exactly 4 seconds while data loads.

Pre‑fetch and cache required data; handle race conditions that cause the flash error.

Definition of done:

No flash of error message; branded loading animation shown; data ready on transition.

Task 21 – Update authentication failure message
Goal: Update the authentication failure message to: “Invalid email or password. Contact Your School Admin For This App.”

Implementation:

Replace the default Firebase error with the custom string in the login UI.

Definition of done:

Users see the school‑admin‑oriented message on invalid credentials.

Task 22 – Restore session state on re‑login
Goal: Ensure the app restores the previous session state (scrolling position, open menus, etc.) upon user re‑login.

Implementation:

Persist UI state (scrolling position, active tab, open panels) in local/session storage or IndexedDB, and reapply after authentication.

Definition of done:

Returning user sees the same chat context and UI state as when they left.

Task 23 – Improve profile photo upload workflow
Goal: Update the profile photo upload process to include an inline progress bar for file transfer, a mandatory “Preview” stage, and explicit “Save” and “Cancel” buttons post‑preview.

Implementation:

Implement a multi‑step upload: select file → show preview → user confirms (Save) or Cancels.

Show upload progress during transfer.

Definition of done:

Profile photo changes are deliberate and confirmed; progress is visible.

Task 24 – Secure PDF Download Pipeline with OTP, Audit Stamping, Daily Limits, One‑time Download, Sender Summary DM, and Secure Upload UI
Goal: Implement a full secure PDF access control system that ensures only authorized users can download stamped, audited PDFs, with daily limits and sender notification.

Implementation:

Secure upload toggle & recipient selection:

When attaching a PDF, show an “🔒 Secure Download” toggle (default OFF).

While ON, display daily remaining secure sends (e.g., “Today’s secure sends: 3/5”) and a recipient selector.

In a 1‑to‑1 personal chat, the recipient is auto‑selected and locked.

In a group chat, a multi‑select dropdown from group members appears; at least one recipient must be chosen.

After send, the message bubble displays a lock badge and label “Secure PDF”. For unauthorized users, download is disabled.

requestPdfOtp callable function:

Checks daily OTP request limit (5 per user, resets daily).

Validates that requesting user is in the file’s allowed list.

Generates a cryptographically secure 6‑digit OTP; stores in Firestore with expiry (5 minutes) and attempt counter.

Writes a formatted email document for the Trigger Email Firebase Extension, including organization name, sender, timestamp, receiver, file name, page count, download count, OTP, and expiry.

Returns { success: true }; client opens OTP modal.

verifyPdfOtpAndDownload callable function:

Validates OTP (exists, not expired, matches; increments attempts, blocks after threshold).

On success, deletes OTP token immediately to prevent replay.

Checks daily download limit (5 per user).

Records download in userDownloads/{userId}_{fileId} to enforce one‑time download.

Retrieves original PDF, stamps an audit page (user name, server timestamp, download count), and injects footer “DIGITALLY TRAILED DOCUMENT” + “Page X of Y” on every page.

Streams stamped PDF back as downloadable blob.

Writes a pending summary entry to downloadSummaries/{senderId}/pending/....

Client UI for recipients:

Allowed users see “Download (Secure)” button; unauthorized see “🔒 Not authorized to download” (disabled).

After first download, button changes to “✅ Downloaded” (disabled).

Scheduled function (daily at 3 PM IST):

Aggregates all pending download summaries per sender.

Sends a direct message from a system bot user: “Your File <file_name> has been Downloaded by <user> at <timestamp>”.

Marks summaries as sent.

Cost & limits:

5 OTP requests/day/user, 5 downloads/day/user, one download per file per user.

Uses Trigger Email Extension for branded OTP emails.

Definition of done:

End‑to‑end flow works: upload with toggle, recipient selection, OTP email, verification, stamped download, one‑time enforcement, and 3 PM summary DM.

P2 – Monitoring, Abuse Prevention, Admin Hardening, Cost Controls, UI Polish, and Link Embedding
Task 25 – Add production monitoring and alerting
Goal: Make production errors, downtime, latency, and spend visible immediately.

Implementation:

Add Sentry React integration with source maps and user/org context.

Add Firebase Performance Monitoring.

Create a health endpoint or health page suitable for UptimeRobot/Better Uptime/Pingdom.

Document Google Cloud Monitoring alerts for Function errors, Firestore usage, latency, and billing.

Define Slack/email/SMS routing and incident severity levels.

Definition of done:

Production errors appear in Sentry.

Uptime loss creates an alert.

Budget/usage alerts go to the configured channels.

Task 26 – Implement rate limiting and abuse prevention
Goal: Limit spam, bot writes, surprise bills, and compromised‑user blast radius.

Implementation:

Require verified email for high‑risk writes.

Add callable‑function rate limits for admin/destructive flows.

Add write‑rate monitoring per user/org/time bucket.

Auto‑restrict or disable suspicious users after threshold breaches.

Add signup/onboarding rate controls by IP where server‑side IP metadata is available.

Log abuse events for admin review.

Definition of done:

Excessive writes are blocked or throttled.

Suspicious accounts can be automatically restricted.

Admins can review abuse events.

Task 27 – Move admin destructive actions behind callable functions
Goal: Ensure admin operations are authorized server‑side and auditable.

Implementation:

Identify direct admin/developer console writes for role changes, user deletion, tenant suspension, tenant deletion, package edits, exports, and DSAR actions.

Move privileged operations to callables in functions/index.js.

Add shared function options: region, timeout, memory, max instances, and App Check enforcement.

Add immutable audit logs for every privileged change.

Tighten Firestore rules to prevent clients from bypassing callables.

Definition of done:

No destructive admin action relies only on client‑side checks.

Every privileged action records actor, target, org, timestamp, and details.

Task 28 – Document cost and surprise‑bill safeguards
Goal: Keep the ₹200–300/user pricing model profitable and predictable.

Implementation:

Create a cost‑control document covering budget alerts at 50%, 80%, and 90%.

Add Cloud Functions maxInstances limits where applicable.

Document Firestore read/write/storage assumptions and INR conversion.

Document optional Cloud Armor guidance for exposed HTTP endpoints.

Add launch checklist items for monitoring Firebase quotas daily.

Definition of done:

Cost controls are documented in repo.

Function scaling limits are configured in code.

Budget alerts and incident routing are clearly described for operators.

Task 29 – Add assignee role labelling in Task Cards
Goal: In the Task Card assignee profile view, add explicit labels to the pills identifying roles (e.g., “Assignee” vs. “Creator”) to provide clear visual distinction.

Implementation:

Add textual labels or badges next to each avatar to distinguish roles.

Definition of done:

Users can instantly see who created the task and who is assigned.

Task 30 – Group avatar state indicators (unread messages)
Goal: Implement conditional styling for Group avatars to indicate unread message status: Green outline for unread messages, Red outline for no unread messages.

Implementation:

Apply conditional CSS classes to group avatars based on unread status.

Definition of done:

Visual cue clearly indicates whether a group has new messages.

Task 31 – Organisation branding in right sidebar
Goal: Add the organisation name to the Right Sidebar UI, positioned directly above the user's name.

Implementation:

Fetch and render the current org’s display name.

Definition of done:

Org name visible at all times in the sidebar.

Task 32 – Layout whitespace and alignment fixes
Goal: Reduce padding/gap whitespace between sidebar elements and message bubbles. Align message bubbles and task cards to the left (received) and right (sent) respectively, rather than the current center‑weighted alignment.

Implementation:

Adjust CSS for tighter spacing; use flex-start / flex-end alignment based on sender.

Definition of done:

More compact layout; messages clearly left/right aligned.

Task 33 – External link embedding with display name and new‑tab open
Goal: Allow users to attach external links (e.g., Google Docs) to messages and tasks, showing only a custom display name, with the link opening in a new tab.

Implementation:

In the message/task composer, add an “Attach Link” option. A small modal collects display name (required) and URL (validated).

Store the link as { displayName, url } in the message/task document.

Render a styled chip/button with the display name; on click, open URL with target="_blank" rel="noopener noreferrer". The raw URL is never shown.

No server‑side changes required initially; client‑side validation ensures correct format.

Definition of done:

Links appear as named chips; clicking opens URL in a new tab; raw URL never exposed to user.

P3 – Future Enhancements (Not Blocking Launch)
Task 34 – Move typing indicators from Firestore to Realtime Database
Why: Firestore is not designed for high‑frequency ephemeral writes. Typing indicators generate excessive write operations and never get cleaned up.

Implementation:

Use Firebase Realtime Database (RTDB) with path: typing/{orgId}/{chatId}/{userId}.

Set value to true while typing, use onDisconnect().remove() to auto‑clean.

Listen to RTDB and display “User is typing…” in the chat UI.

Keep Firestore for all persistent data.

Definition of done:

Typing indicators work but do not appear in Firestore usage or billing.

Task 35 – Partition PWA cache by orgId
Why: The current service worker caches Firestore responses keyed only by URL. When a user switches organizations offline, stale data from the previous organization may appear.

Implementation:

In the service worker, prepend orgId to the cache key.

When the user switches organizations, clear the active cache or re‑fetch data.

Definition of done:

Offline data is correctly isolated per organization.

Task 36 – Scheduled message cancellation from client
Why: Users should be able to cancel a pending scheduled message without developer intervention.

Implementation:

Extend the frontend UI to list pending scheduled messages for the current user.

Add a “Cancel” button that sets cancelled: true on the Firestore document.

Modify the scheduled‑message Cloud Function to skip delivery if cancelled == true.

Keep the original document for audit purposes.

Definition of done:

Users can cancel any future message they scheduled.

Task 37 – Automatic audit log deletion (TTL)
Why: Audit logs grow indefinitely, increasing storage costs and query time.

Implementation:

Add a Cloud Function that runs monthly, deleting audit log documents older than 90 days.

Optionally write a summary of deleted counts to a separate collection.

Definition of done:

Audit logs never exceed 90 days of history unless explicitly configured.

Task 38 – Full denormalization backfill script
Why: New messages will include denormalised fields (senderName, senderAvatar, etc.), but old messages lack them, causing inconsistent UI.

Implementation:

Write a one‑time Node.js script (or Cloud Function) that iterates over all messages collections, looks up sender details, and updates the documents.

Run during a maintenance window.

Definition of done:

All existing messages have the same shape as new messages, eliminating extra reads.

Task 39 – Document and automate Firestore backup restoration test
Why: Backups exist (PITR, scheduled backups) but have never been tested for restore.

Implementation:

Write a runbook describing how to restore a Firestore database from a backup to a new project.

Perform a quarterly dry‑run restore to verify RTO and data integrity.

Definition of done:

Restore procedure documented and tested successfully at least once.

Task 40 – Reaction Summary View
Goal: Implement a “Reactions Summary” feature in the message bubble menu. Upon click, this should display a breakdown of users who have acknowledged or tagged the message (via emoji or text tag).

Implementation:

Click on a reaction chip opens a modal or popover listing users.

Definition of done:

Users can see who reacted with which emoji/tag.

Task 41 – Universal Notification Bell
Goal: Refactor the notification system to be universal across all user roles. Clicking a notification (for new messages, reactions, or replies, in both Groups and DMs) must trigger an automatic scroll to the specific item and highlight it for 3 seconds.

Implementation:

Build a unified notification system; implement deep‑link navigation with highlight animation.

Definition of done:

All users receive consistent notifications; click navigates and highlights the target.

Verification Matrix (Final)
Area	Verification
Tenant isolation	Test two orgs with separate users; verify each user sees only own messages, tasks, groups, files, reminders, notifications, and members.
Firestore rules	Run Firebase Emulator rules tests or manual emulator scripts for allow/deny cases.
Scheduled messages	Schedule a message, close all browser sessions, and verify Cloud Function delivers exactly once.
Storage	Upload a file as one org and verify another org cannot read it.
Pagination	Confirm initial chat/admin loads have bounded document reads.
Virtualization	Load a large seeded chat and confirm DOM node count stays bounded.
Offline	Load app, disconnect network, confirm cached data/drafts work, reconnect, and confirm no duplicates.
Monitoring	Trigger a controlled frontend error and Function error; verify alerts arrive.
Abuse controls	Simulate high write rates and confirm throttling/restriction.
Cost controls	Verify budgets, max instances, and quota dashboards are documented and configured.
Task card permissions	Non‑creator/non‑admin cannot edit/attach; completed tasks locked.
Task card formatting	Rich text renders correctly; no raw HTML visible.
Reply input layout	Text wraps inside bubble; no horizontal overflow.
Formatting toolbar	Toolbar always visible when replying.
Z‑index	All dropdowns, modals, cards stay on top.
Scroll arrows	Arrows not hidden by input box on any resolution.
Task completion	Edit icon disappears on completed tasks; server rejects edits.
Typing indicator	“Clear” does not trigger typing; typing only on actual input.
Login flow	Branded 4‑s loading; no flash “User ID does not exist” error.
Error message	Custom “Contact Your School Admin” shown on invalid credentials.
Session restoration	Scroll position, menus restored after re‑login.
Profile upload	Progress bar, preview, explicit Save/Cancel.
Secure PDF pipeline	Upload with toggle, recipient selection; only allowed users can download; daily limits enforced; OTP modal; stamped PDF contains audit page; 3 PM summary DM.
Assignee labels	Pills show “Assignee” / “Creator” labels.
Group unread status	Green/red outline on group avatars.
Org branding	Org name visible above user name in right sidebar.
Layout alignment	Messages left/right aligned; reduced whitespace.
External link embedding	Add link with display name; renders as named chip; opens in new tab; raw URL never visible.
Reaction summary	Click reaction chip shows user list.
Universal notifications	All users get unified notifications; click scrolls to and highlights target message.
Recommended Commit Sequence
[P0-task1] harden firestore rules

[P0-task2] enforce org guards on data access

[P0-task3] scope member and task assignment data

[P0-task7] harden task card edit and file-attachment permissions

[P0-task4] deliver scheduled messages server-side

[P0-task5] align storage upload paths

[P0-task6] initialize app check

[P1-task8] add firestore indexes

[P1-task9] paginate chat and admin data

[P1-task10] virtualize chat rendering

[P1-task11] enable firestore offline cache

[P1-task12] document denormalized schemas

[P1-task13] fix task card formatting bug

[P1-task14] fix message reply input responsiveness

[P1-task15] persistent formatting toolbar

[P1-task16] fix z-index layering

[P1-task17] fix scroll arrow visibility

[P1-task18] task completion state restrictions

[P1-task19] fix typing indicator on clear

[P1-task20] optimize login flow

[P1-task21] update auth error message

[P1-task22] restore session state on re-login

[P1-task23] improve profile upload workflow

[P1-task24] secure pdf pipeline – upload, otp, audit stamp, limits, summary dm

[P2-task25] add monitoring and alerting

[P2-task26] add abuse prevention controls

[P2-task27] secure admin actions with callables

[P2-task28] document cost guardrails

[P2-task29] assignee role labelling

[P2-task30] group avatar state indicators

[P2-task31] organization branding in sidebar

[P2-task32] layout whitespace and alignment fixes

[P2-task33] external link embedding with display name and new-tab open
34–41 future enhancements (P3)

Final Execution Readiness Checklist
Before implementation starts, confirm:

Firebase project and environments are known.

App Check reCAPTCHA v3 site key is available.

Sentry DSN and alert channels are available.

Billing budget amount and Slack/email/SMS recipients are approved.

Production domain or health endpoint URL is known.

Any schema migration from orgId to workspaceId is explicitly rejected or separately approved.

IST timezone handling confirmed for scheduled functions, timestamp display, and secure download summary DM.

Trigger Email Firebase Extension selected and SMTP provider (e.g., SendGrid) configured for OTP emails.

Proposed First Implementation Sprint
To reduce risk, execute the first sprint as:

Storage upload path fix (Task 5)

Firestore rules hardening (Task 1)

Org guard audit (Task 2)

Scheduled‑message Cloud Function (Task 4)

Firestore indexes for the changed queries (Task 8)

This sequence closes the largest security/reliability gaps before larger UI/performance refactors.

