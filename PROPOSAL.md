Talk & Task Final Execution Proposal (Complete – Updated with All Features)
This document is the execution‑ready roadmap derived from talkandtask_full_audit-FINAL.md and all subsequent feature additions. It contains every agreed task, including the Secure PDF pipeline, external link embedding, and the hybrid Support ticket system with broadcast mode, weekly limits, auto‑resolution dates, and developer pause. The audit remains the source of truth for business/security requirements.

Important Repository Alignment Notes
workspaceId in the audit equals the repo’s existing orgId.

Paths like workspaces/{workspaceId} are implemented as organizations/{orgId}.

Workspace membership is the existing org‑based model (org documents, groups, custom claims, role/admin checks).

No schema rename from orgId to workspaceId – it adds migration risk without security benefit.

Current State (Confirmed from Audit & Repo)
Tenant isolation & Firestore rules are the top priority.

Scheduled messages depend on client polling – must move to server.

Chat/admin listeners lack pagination and indexes.

Chat rendering not virtualized – won’t scale.

App Check, rate limiting, abuse prevention, monitoring, budget alerts needed for production.

Admin destructive actions must be server‑side with immutable audit logs.

Storage upload paths don’t match tenant‑scoped rules.

Offline persistence & denormalization needed.

All user‑visible times & scheduled functions use IST (Indian Standard Time).

Repo specifics:

storage.rules expects organizations/{orgId}/uploads/..., but uploads go to chat_uploads/....

ChatApp.jsx contains browser‑side scheduled‑delivery logic.

useChatEngine.js subscribes without pagination.

ChatView.jsx uses direct .map (no virtualization).

No firestore.indexes.json referenced.

firebase.js does not initialise App Check, Performance Monitoring, or Firestore offline cache.

functions/index.js is already v2 – can add scheduled functions.

Execution Principles
Security before performance – P0 first.

Server authority for privileged workflows.

No broad fallback writes – explicit rules for every collection.

Keep orgId and organizations/{orgId} schema.

Incremental commits – each task separate & verified.

Document console‑only setup (App Check enforcement, budgets, etc.).

Final Priority Plan
P0 – Launch‑Blocking Security & Core Reliability
Task 1 – Harden Firestore security rules per collection
Goal: Zero‑trust on organizations/{orgId} data model.

Explicit read/write policies for messages, scheduled_messages, groups, notifications, reminders, workspace, workspace_tags, audit_logs, org details.

Require signed‑in user, same org, active org status, verified email for writes.

Platform‑owner support only where needed.

Audit logs append‑only for clients, preferably server‑only.

scheduled_messages: clients can create/update/cancel their own, cannot set sent/delivery fields.

messages: users create only as themselves, only in valid groups/scopes.

Definition of done: No cross‑tenant access; no user can modify privileged/delivery fields; legacy root collections denied.

Task 2 – Add org/workspace guards to all Firestore listeners & writes
Goal: Prevent operations before active tenant known.

Audit all Firestore operations; validate orgId first.

All message/task/admin queries include organizations/{orgId} scope.

Where collection‑group or root user queries needed, add strict orgId filter + role checks.

Definition of done: No listener starts without orgId; no tenant write outside organizations/{orgId}/....

Task 3 – Fix task assignment & member visibility boundaries
Goal: Prevent cross‑tenant user leakage in assignments, mentions, admin lists, member dropdowns.

Replace any global user list with org‑scoped queries.

If root users used, always where('orgId', '==', orgId) + archived/approved filters.

UI components receive only tenant‑safe dbUsers.

Server‑side validation: task assignees must belong to same org.

Definition of done: Users can assign tasks only to own org members; mentions, admin lists never expose other orgs’ users.

Task 4 – Move scheduled message delivery to Cloud Functions
Goal: Reliable, exactly‑once delivery independent of browser.

Add processScheduledMessages with onSchedule (every minute) in functions/index.js.

Query due pending schedules; use transaction/lock: pending → processing → sent/failed.

Write final messages server‑side.

Remove browser‑side delivery interval from ChatApp.jsx.

Keep client create/edit/cancel UX, but disallow “sent” status updates in rules.

Definition of done: Scheduled messages send even when sender offline; no duplicate sends; no client‑forged sent status.

Task 5 – Align Storage upload paths with tenant rules
Goal: Uploads work under organizations/{orgId}/uploads/..., no cross‑tenant access.

Change chat uploads from chat_uploads/... to organizations/${orgId}/uploads/chat/${groupId}/....

Store storagePath in message metadata.

Storage reads/writes restricted to same‑org users.

Authoritative quota updates via Cloud Functions.

Definition of done: Uploads succeed under deployed rules; files isolated by org.

Task 6 – Initialize & enforce Firebase App Check
Goal: Reduce automated abuse against Firestore, Storage, Functions.

Init App Check in firebase.js (reCAPTCHA v3, env var VITE_FIREBASE_APPCHECK_SITE_KEY).

Document debug‑token usage for development.

Console rollout steps; enforce on callable functions where safe.

Definition of done: Production builds use valid App Check tokens; local dev works with debug tokens.

Task 7 – Harden Task Card edit & file‑attachment permissions
Goal: Extend edit/attach rights to Admin/Creator until status “Completed”.

Modify Firestore rules + client logic so only creator/admin can edit/attach if status != "completed".

Completed tasks are read‑only for all.

Enforce server‑side (rules) and reflect in UI.

Definition of done: Non‑privileged users cannot edit/attach; completed tasks locked.

P1 – Scalability, Cost, Performance & Critical UX Fixes
Task 8 – Add Firestore composite indexes
Goal: Prevent missing‑index errors, support paginated queries.

Create firestore.indexes.json; reference from firebase.json.

Indexes for messages, scheduled messages, notifications, reminders, audit logs, package/tenant lookups, task dashboard queries.

Definition of done: All where + orderBy queries have committed index definitions.

Task 9 – Implement paginated Firestore data loading
Goal: Stop loading entire histories into clients.

Reusable hook for paginated Firestore queries.

Chat messages load latest 25–50 first, older via cursor.

Limits for admin views (audit logs, reminders, notifications, user lists).

Real‑time updates only for latest page.

Definition of done: Initial loads bounded; admin panels no longer unbounded.

Task 10 – Virtualize the chat message list
Goal: Smooth rendering with thousands of messages.

Add @tanstack/react-virtual (variable‑height capable).

Replace .map in ChatView.jsx with virtualized rows.

Preserve pinned banners, day separators, unread highlights, scroll‑to‑bottom, etc.

Definition of done: Only visible rows mounted; large chats responsive.

Task 11 – Enable Firestore offline persistence
Goal: Improve offline UX, reduce repeated reads.

Initialize Firestore with persistent local cache in firebase.js.

Configure multi‑tab behaviour; keep IndexedDB draft support.

Document fallback for unsupported browsers/private mode.

Definition of done: Data available offline; pending writes resume without duplicates.

Task 12 – Add denormalized schema strategy & backfill plan
Goal: Reduce N+1 reads; cheaper message/task rendering.

Document canonical schemas (messages, tasks, etc.).

New messages include senderName, senderAvatar, groupName, task display fields.

Shared payload builders for client & functions.

Plan one‑time backfill script (executed later).

Definition of done: No extra reads for sender/group details; scheduled function uses same schema.

Task 13 – Fix Task Card formatting bug (raw HTML tags visible)
Goal: Rich‑text in task cards renders correctly.

Sanitize/parse rich‑text input; ensure preview and posted card match.

Definition of done: No raw HTML visible; formatting works.

Task 14 – Fix message reply input responsiveness
Goal: Reply input wraps text within bubble, uses full width.

CSS: overflow-wrap: break-word, constrained max‑width.

Definition of done: Long text wraps; input stays inside bubble.

Task 15 – Implement persistent formatting toolbar for reply
Goal: Rich‑text toolbar always visible when replying.

Toolbar fixed (not context‑dependent), no interference with other UI.

Definition of done: Toolbar visible whenever reply input active.

Task 16 – Fix Z‑index/layering issues
Goal: Menus, Task Cards, Message Bubbles never obscured.

Audit & assign z-index values (base, dropdown, modal).

Definition of done: All overlays stay on top.

Task 17 – Fix scroll arrow visibility
Goal: Scroll arrows never hidden by input box.

Adjust positioning/margin to stay visible across resolutions.

Definition of done: Arrows fully visible & clickable.

Task 18 – Implement task completion state restrictions
Goal: Disable edit (pencil icon) for completed tasks.

UI removes/disables edit when status == "completed"; server rules enforce.

Definition of done: Completed tasks cannot be edited.

Task 19 – Fix “Typing…” indicator bug on Clear
Goal: Clear button must not trigger typing indicator.

Indicator only activates on actual text input, not clear actions.

Definition of done: Typing status stays false after clearing.

Task 20 – Optimise login flow
Goal: 4‑second branded loading animation; eliminate “User ID does not exist” flash.

Splash screen with 4‑second minimum; pre‑fetch data; handle race condition.

Definition of done: No error flash; branded loading; data ready.

Task 21 – Update authentication failure message
Goal: Show “Invalid email or password. Contact Your School Admin For This App.”

Replace default Firebase error with custom string.

Definition of done: Users see school‑admin‑oriented message.

Task 22 – Restore session state on re‑login
Goal: Previous scroll position, menus restored after re‑login.

Persist UI state in localStorage/IndexedDB; reapply after auth.

Definition of done: Returning user sees same context.

Task 23 – Improve profile photo upload workflow
Goal: Multi‑step upload: progress bar, preview, explicit Save/Cancel.

File select → preview → user confirms (Save) or cancels; show transfer progress.

Definition of done: Profile photo changes are deliberate & visible.

Task 24 – Secure PDF Download Pipeline with OTP, Audit Stamping, Daily Limits, One‑time Download, Sender Summary DM, and Secure Upload UI
Goal: Only authorized users can download stamped, audited PDFs; daily limits enforced; sender notified.

Implementation:

Secure upload toggle & recipient selection:

When attaching a PDF, show “🔒 Secure Download” toggle (default OFF).

While ON, display daily remaining secure sends (e.g., “Today’s secure sends: 3/5”) and a recipient selector.

In 1‑to‑1 DM, recipient auto‑selected & locked.

In group chat, multi‑select from group members; at least one required.

Message bubble shows lock badge & “Secure PDF”; unauthorized users see disabled state.

requestPdfOtp callable function:

Check daily OTP request limit (5/user, resets daily).

Validate requesting user is in file’s allowed list.

Generate 6‑digit secure OTP; store in Firestore with 5‑min expiry & attempt counter.

Write branded email to mail collection (Trigger Email Extension) with org name, sender, timestamp, receiver, file name, page count, download count, OTP, expiry.

Return { success: true }; client opens OTP modal.

verifyPdfOtpAndDownload callable function:

Validate OTP (exists, not expired, matches; increments attempts, block after threshold).

On success, delete OTP token immediately (prevents replay).

Check daily download limit (5/user).

Record download in userDownloads/{userId}_{fileId} to enforce one‑time download per file.

Retrieve original PDF; stamp audit page (user name, server timestamp, download count); add footer “DIGITALLY TRAILED DOCUMENT” + “Page X of Y” on every page.

Stream stamped PDF as downloadable blob.

Write pending summary entry to downloadSummaries/{senderId}/pending/....

Client UI for recipients:

Allowed users see “Download (Secure)” button; unauthorized see “🔒 Not authorized to download” (disabled).

After first successful download, button becomes “✅ Downloaded” (disabled).

Scheduled function (daily at 3 PM IST):

Aggregates pending download summaries per sender.

Sends DM from system bot: “Your File <file_name> has been Downloaded by <user> at <timestamp>”.

Marks summaries as sent.

Cost & Limits:

5 OTP requests/day/user, 5 downloads/day/user, one download per file per user.

Uses Trigger Email Extension for OTP emails.

Definition of done: End‑to‑end flow works: secure upload, recipient selection, OTP, stamped download, one‑time enforcement, 3 PM summary DM.

P2 – Monitoring, Abuse Prevention, Admin Hardening, Cost Controls, UI Polish, Link Embedding, and Support Ticket System
Task 25 – Add production monitoring and alerting
Sentry React, Firebase Performance Monitoring, health endpoint, GCP alerts, incident routing.

Task 26 – Implement rate limiting & abuse prevention
Verified email for high‑risk writes; callable rate limits; write‑rate monitoring; auto‑restrict; abuse logs.

Task 27 – Move admin destructive actions behind callable functions
Privileged ops (role changes, deletion, suspension, etc.) via callables with claims check & immutable audit logs.

Firestore rules deny direct client writes to protected fields.

Task 28 – Document cost & surprise‑bill safeguards
Budget alerts at 50/80/90%; Cloud Functions max instances; Firestore cost assumptions in INR; quota dashboards.

Task 29 – Add assignee role labelling in Task Cards
Pills show “Assignee” vs. “Creator” labels.

Task 30 – Group avatar state indicators (unread messages)
Green outline for unread, red for no unread.

Task 31 – Organisation branding in right sidebar
Org name above user name.

Task 32 – Layout whitespace & alignment fixes
Reduced padding; messages left/right aligned, not centre‑weighted.

Task 33 – External link embedding with display name & new‑tab open
Goal: Attach external links (Google Docs etc.) to messages/tasks; display only custom name; open in new tab.

In composer, “Attach Link” modal: display name (required) + URL (validated).

Store { displayName, url } in message/task document.

Render as styled chip/button; click opens target="_blank" rel="noopener noreferrer". Raw URL never shown.

No server‑side changes needed initially.

Definition of done: Links appear as named chips; open in new tab; raw URL hidden.

Task 34 – Hybrid Support Ticket System (replaces universal Support group) with Broadcast, Weekly Limit, Auto‑Resolution Dates, and Developer Pause
Goal: Provide structured support with 1 ticket/week per user, private task‑card‑based tickets, automatic tentative resolution dates, developer pause/unavailability, and a broadcast‑only announcement channel.

Implementation:

Support Group – Broadcast Mode Only

Existing Support group (groupId: "support") becomes read‑only for regular users – they can only view messages.

Only users with admin / developer claims can post.

Messages are plain text (no emojis, no reactions) and used solely for announcements, maintenance notices, guides.

Firestore rules: disallow writes to this group by non‑admins. UI hides input box for regular users.

Ticket Creation (Task‑Card)

New “Help / Support” menu item opens ticket creation form: Subject, Description (rich text, optional screenshot), Category (bug, feature, account, other).

Upon submission, a Task Card is written to organizations/{orgId}/messages with:

type: "support_ticket"

createdBy: userId

status: "open"

visibleTo: [userId, ...adminUids] – only the ticket creator and developer(s) can see it.

createdAt: timestamp

This ticket does not appear in the broadcast group; it’s listed in a private “My Tickets” view for the user, and a developer dashboard for admins.

One Ticket Per Week Per User Limit

Document usageCounters/{userId} with fields lastTicketWeek (ISO week string) and ticketsThisWeek.

On ticket creation attempt:

Get current ISO week. If different from stored, reset count to 0 and update week.

If ticketsThisWeek >= 1, deny with error: “You have already created a ticket this week. Please try again next Monday.”

Else, increment and proceed.

Weekly reset via ISO week comparison – no scheduled function needed.

Auto‑Calculated Tentative Resolution Date

A Cloud Function trigger (on ticket creation and status changes) calculates an estimatedResolution date.

Queue Formula:

Count all tickets with status != "resolved" and status != "closed" across all orgs → queueLength.

New ticket’s position = queueLength + 1.

Developer resolves 10 tickets per day (configurable constant TICKETS_PER_DAY).

Offset working days = ceil(position / TICKETS_PER_DAY).

Working days exclude Saturdays, Sundays, and any developer‑declared unavailable dates (see point 6).

estimatedResolution = today + offset working days.

When a ticket is resolved/closed, recalculation is triggered for remaining open tickets (via Firestore trigger or scheduled function).

The date is displayed on user’s ticket as “Tentative resolution by: DD‑MMM‑YYYY”.

Ticket Workflow & Comment Trail

Developer dashboard lists all tickets across orgs, filterable by status, priority, category.

Developer can:

Add public replies (visible to user) or internal notes (visible only to admins).

Change status: open → in-progress → resolved (or directly closed).

Click “Resolve” to set status: "resolved" and resolvedAt timestamp; user notified.

Both user & developer can add comments in a thread (e.g., replies subcollection). Full audit trail: timestamps, actor IDs for status changes and replies.

Developer Pause & Unavailability Management

Admin toggle in developer dashboard: “Accepting new tickets” (ON/OFF).

Stored in systemSettings/supportStatus: isAcceptingTickets, pausedAt, pausedReason (optional).

When OFF, users see “Support tickets are temporarily paused. Please check back later.” and “Create Ticket” button is disabled.

Existing tickets remain accessible; developer can still work on them.

Developer unavailability calendar:

Document systemSettings/developerUnavailability with unavailableDates: array of ISO date strings.

Admin can add/remove dates via a calendar picker.

The queue formula skips unavailable dates when calculating working days.

When unavailability dates are changed, all open tickets’ estimatedResolution are automatically recalculated (via Cloud Function trigger or manual “Recalculate” button).

Users see a notice: “Estimated resolution times may be extended due to developer unavailability.”

Notifications

Ticket created → developer in‑app + email.

Developer replies/status change → user in‑app + email.

Ticket resolved → user in‑app + email.

Emails via Trigger Email Extension (or direct admin SDK mail if configured).

UI Integration

User: “My Tickets” list with status badges, tentative dates; “Create Ticket” button; inside ticket – chat‑like reply thread.

Developer: “All Tickets” dashboard with filters; reply panel; status/pause/unavailability controls; broadcast message composer for the Support group.

Definition of done:

Support group is broadcast‑only.

Users can create 1 ticket/week; see only their own tickets.

Tentative resolution dates auto‑calculated and updated with unavailability.

Developer can pause intake, set unavailable days, and manage tickets with full trail.

Notifications work end‑to‑end.

P3 – Future Enhancements (Not Blocking Launch)
Task 35 – Move typing indicators from Firestore to Realtime Database
Use RTDB path typing/{orgId}/{chatId}/{userId}; onDisconnect().remove().

Task 36 – Partition PWA cache by orgId
Prepended orgId in cache keys; clear cache on org switch.

Task 37 – Scheduled message cancellation from client
Add Cancel button for pending scheduled messages; function skips if cancelled == true.

Task 38 – Automatic audit log deletion (TTL)
Monthly function deletes audit logs older than 90 days.

Task 39 – Full denormalization backfill script
One‑time script updates old messages with senderName, senderAvatar, etc.

Task 40 – Document & automate Firestore backup restoration test
Runbook + quarterly dry‑run restore.

Task 41 – Reaction Summary View
Click reaction chip shows list of users who reacted.

Task 42 – Universal Notification Bell
Unified notifications across roles; click scrolls to & highlights target.

Verification Matrix (Final)
Area	Verification
Tenant isolation	Two orgs – no cross‑visibility of messages, tasks, files, tickets.
Firestore rules	Emulator tests for all allow/deny cases.
Scheduled messages	Exactly‑once delivery via Cloud Function.
Storage	Upload path enforced; cross‑org read denied.
Pagination	Bounded initial load; “load older” works.
Virtualization	DOM count stays low with large chat.
Offline persistence	Data available offline; no duplicates on reconnect.
Monitoring	Sentry errors + Function alerts arrive.
Abuse controls	Rate limits activate on high writes.
Cost controls	Budget alerts, maxInstances documented.
Task card permissions	Edit/attach locked for non‑creator/non‑admin, completed tasks.
Task card formatting	Rich‑text renders correctly, no raw HTML.
Reply input layout	Wraps inside bubble.
Formatting toolbar	Always visible when replying.
Z‑index	Overlays not obscured.
Scroll arrows	Never hidden by input box.
Task completion	Edit icon removed; server rejects edits.
Typing indicator	Clear does not trigger typing.
Login flow	4‑s branded loading; no flash error.
Auth error message	Custom school‑admin message displayed.
Session restoration	Scroll/menus restored after re‑login.
Profile upload	Progress bar, preview, Save/Cancel.
Secure PDF pipeline	Toggle, recipient selection, OTP, stamping, one‑time download, 3 PM DM.
External link embedding	Link chip with name; opens new tab; raw URL hidden.
Support ticket system	Broadcast group read‑only; 1 ticket/week; auto‑resolution dates; pause/unavailability; private trail; notifications.
Assignee labels	Pills show “Assignee” / “Creator”.
Group unread status	Green/red outline on avatars.
Org branding	Org name in sidebar.
Layout alignment	Messages left/right; tighter spacing.
Reaction summary (P3)	Click chip shows user list.
Universal notifications (P3)	Scroll to & highlight target.
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

[P2-task34] support ticket system – broadcast, weekly limit, auto-resolution dates, pause
35–42 future enhancements (P3)

Final Execution Readiness Checklist
Firebase project & environments confirmed.

App Check reCAPTCHA v3 site key available.

Sentry DSN & alert channels available.

Billing budget & recipients approved.

Production domain / health endpoint known.

No orgId → workspaceId schema migration.

IST timezone handling confirmed for all scheduled functions & display.

Trigger Email Extension configured for OTP & support notifications.

System‑bot user created for automated DMs (download summaries, support notifications).

Support pause/unavailability defaults set in systemSettings.

Proposed First Implementation Sprint
To reduce risk:

Storage upload path fix (Task 5)

Firestore rules hardening (Task 1)

Org guard audit (Task 2)

Scheduled‑message Cloud Function (Task 4)

Firestore indexes (Task 8)

This closes the biggest security/reliability gaps before UI/performance refactors.



SUPPORT GROUP-ALL USERS OF THIS GROUP SHOULD NOT BE VISIBLE TO ANY ONE EXCEPT DEVELOPER(AS IT IS BROADCAST GROUP AND PRESNET IN MANY WORKSPACES)
