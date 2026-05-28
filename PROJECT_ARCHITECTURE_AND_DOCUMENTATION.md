# PROJECT_ARCHITECTURE_AND_DOCUMENTATION.md

> **Project:** Talk & Task Enterprise  
> **Current documented build:** v16.0  
> **Architecture type:** React + Vite single-page application with Firebase Auth, Firestore, Storage, PWA support, and Vercel SPA hosting.  
> **Primary domain:** Real-time chat, group coordination, task lifecycle management, reminders, scheduled messages, admin reporting, and demo data seeding for school validation.

---

## 1. WORKSPACE TREE & FILE MAP

### 1.1 Clean workspace tree

```text
Talk-And-Task/
├── .githooks/
│   ├── post-checkout
│   ├── post-commit
│   └── post-merge
├── scripts/
│   ├── git-event-email.mjs
│   ├── install-git-hooks.mjs
│   └── seed-school-demo-data.mjs
├── src/
│   ├── App.jsx
│   ├── firebase.js
│   ├── index.css
│   ├── main.jsx
│   ├── components/
│   │   ├── ChatApp.jsx
│   │   ├── ErrorBoundary.jsx
│   │   ├── Admin/
│   │   │   └── AdminPanel.jsx
│   │   ├── Chat/
│   │   │   ├── ChatView.jsx
│   │   │   ├── InputArea.jsx
│   │   │   └── MessageBubble.jsx
│   │   ├── Common/
│   │   │   ├── MemoizedAvatar.jsx
│   │   │   ├── Toast.jsx
│   │   │   └── UploadOverlay.jsx
│   │   ├── Modals/
│   │   │   ├── ActiveSchedulesModal.jsx
│   │   │   ├── AdminEditUserModal.jsx
│   │   │   ├── ContextMenuModal.jsx
│   │   │   ├── GroupFormModal.jsx
│   │   │   ├── GroupSettingsModal.jsx
│   │   │   ├── ModalManager.jsx
│   │   │   ├── ProfileSettingsModal.jsx
│   │   │   ├── ReminderModal.jsx
│   │   │   ├── ScheduleSendModal.jsx
│   │   │   ├── TaskAnalyticsModal.jsx
│   │   │   ├── TaskConvertModal.jsx
│   │   │   └── TaskTrailModal.jsx
│   │   └── Sidebar/
│   │       ├── LeftSidebar.jsx
│   │       ├── RightSidebar.jsx
│   │       └── TaskBoard.jsx
│   ├── hooks/
│   │   ├── useChatEngine.js
│   │   └── useWorkspaceData.js
│   └── utils/
│       ├── helpers.js
│       ├── imageUtils.js
│       └── runtimeEventNotifier.js
├── root-level legacy/component mirror files/
│   ├── App.jsx
│   ├── LeftSidebar.jsx
│   ├── RightSidebar.jsx
│   ├── TaskConvertModal.jsx
│   ├── ReminderModal.jsx
│   ├── ScheduleSendModal.jsx
│   ├── TaskTrailModal.jsx
│   ├── TaskAnalyticsModal.jsx
│   ├── GroupFormModal.jsx
│   ├── GroupSettingsModal.jsx
│   ├── ProfileSettingsModal.jsx
│   ├── AdminEditUserModal.jsx
│   ├── ContextMenuModal.jsx
│   ├── ErrorBoundary.jsx
│   ├── UploadOverlay.jsx
│   ├── firebase.js
│   ├── imageUtils.js
│   └── index.css
├── GIT_EMAIL_NOTIFICATIONS.md
├── PROJECT_STATE.md
├── firebase.json
├── icon-192.png
├── index.html
├── package.json
├── postcss.config.js
├── service-worker.js
├── tailwind.config.js
├── vercel.json
└── vite.config.js
```

> **Note on duplicated root-level JSX files:** the active Vite entrypoint imports from `src/main.jsx`, which uses `src/App.jsx`. The root-level components appear to be legacy/mirror files retained in the repository. Treat `src/` as the canonical application implementation unless a future refactor intentionally removes or re-wires the root mirrors.

### 1.2 Major file map

| File / Path | Core Responsibility | Purpose / Notes |
|---|---|---|
| `package.json` | Dependency and script manifest | Defines Vite scripts, seed scripts, Firebase/React dependencies, PWA tooling, and git notification helper commands. |
| `index.html` | Browser shell | Mounts the React app and provides the Vite HTML entry. |
| `src/main.jsx` | React entrypoint | Creates the React root and renders `App`. |
| `src/App.jsx` | Authentication shell, app boot, session tracking | Handles Google login, Firebase session registry writes, version display, crash fallback, and wraps `ChatApp` in `ErrorBoundary`. |
| `src/firebase.js` | Firebase client binding | Initializes Firebase App/Auth/Firestore/Storage and re-exports Firebase primitives used throughout the app. |
| `src/components/ChatApp.jsx` | Main workspace orchestrator | Coordinates workspace data hooks, chat engine hooks, active group, modals, reminders, schedules, notifications, task conversion, group settings, resize panes, and top-level layout. |
| `src/hooks/useWorkspaceData.js` | Firestore subscription hook | Subscribes to users, groups, reminders, notifications, audit logs, tags, announcements, and user profile/tool preferences. |
| `src/hooks/useChatEngine.js` | Messaging engine hook | Manages message stream, typing state, offline drafts, message create/edit/delete, reactions, file upload, pin/bookmark, and scheduled message writes. |
| `src/components/Chat/ChatView.jsx` | Message list renderer | Renders pinned messages, typing indicators, message list, empty states, and delegates each message to `MessageBubble`. |
| `src/components/Chat/MessageBubble.jsx` | Message/task card renderer and task state machine UI | Renders chat bubbles, task cards, task action controls, assignee state labels, ack/submit/review/transfer/delegate flows, trail rendering, inline file upload, and task notifications/audit writes. |
| `src/components/Chat/InputArea.jsx` | Main composer | Handles rich chat input, file attachment queue, emoji picker, send button, scheduled/reminder/task conversion actions, and Enter-to-send behavior. |
| `src/components/Sidebar/LeftSidebar.jsx` | Workspace navigation sidebar | Displays profile, admin button, task hub toggle, create group/settings/logout controls, group list, DM list, compact search toggle, unread counters, and mobile overlay behavior. |
| `src/components/Sidebar/RightSidebar.jsx` | Task Hub sidebar | Aggregates assigned/created tasks, filters by status/date/archive, renders compact task cards and assignee avatars, and jumps to task messages. |
| `src/components/Sidebar/TaskBoard.jsx` | Alternate task board view | Provides a task-card grid/list style board for assigned tasks and group context. |
| `src/components/Admin/AdminPanel.jsx` | Admin workspace | Provides user approval/admin controls, group management, audit log visibility, tag management, analytics/reporting tables, and admin filtering. |
| `src/components/Modals/ModalManager.jsx` | Modal router | Centralizes conditional modal rendering and prop wiring for all modal panels. |
| `src/components/Modals/TaskConvertModal.jsx` | Convert message to task UI | Captures assignees, deadline, priority, ack/proof options, and triggers conversion to structured `taskData`. |
| `src/components/Modals/TaskTrailModal.jsx` | Task trail modal | Displays/adds task trail comments, file attachments, delegation, completion, and task title editing via parent handlers. |
| `src/components/Modals/ActiveSchedulesModal.jsx` | Reminder/scheduled message manager | Lists active reminders and pending scheduled messages, supports edit/cancel actions. |
| `src/components/Modals/ReminderModal.jsx` | Reminder creation UI | Captures date/time for selected message reminder. |
| `src/components/Modals/ScheduleSendModal.jsx` | Scheduled message UI | Captures date/time and sends schedule request to `scheduled_messages`. |
| `src/components/Modals/GroupFormModal.jsx` | Group create/edit UI | Captures group name, admins, members, and group image. |
| `src/components/Modals/GroupSettingsModal.jsx` | Existing group settings UI | Edits group name/members/admins/image and archives or updates group. |
| `src/components/Modals/ProfileSettingsModal.jsx` | User profile/preferences UI | Edits name/font preferences, notification sounds, tool toggles, and profile image. |
| `src/components/Modals/AdminEditUserModal.jsx` | Admin user edit UI | Allows admin-side user profile/approval property edits. |
| `src/components/Modals/ContextMenuModal.jsx` | Action menu modal | Presents message/task contextual actions where used. |
| `src/components/Modals/TaskAnalyticsModal.jsx` | Analytics modal | Displays task analytics/reporting view from computed analytics data. |
| `src/components/Common/MemoizedAvatar.jsx` | Avatar primitive | Renders cached user/group images or initials/icon fallback. |
| `src/components/Common/Toast.jsx` | Toast notifications | Renders transient UI notifications. |
| `src/components/Common/UploadOverlay.jsx` | Upload progress overlay | Displays blocking upload spinner/progress. |
| `src/components/ErrorBoundary.jsx` | React error boundary | Catches render/runtime crashes below it and displays fallback/reporting path. |
| `src/utils/helpers.js` | Date/workday helpers | Contains working-day deadline helper(s). |
| `src/utils/imageUtils.js` | Browser image compression | Compresses images client-side before upload where used. |
| `src/utils/runtimeEventNotifier.js` | Runtime event logging/email queue | Writes runtime diagnostics to Firestore collections such as `event_logs` and `mail`. |
| `scripts/seed-school-demo-data.mjs` | Demo data seeder | Generates realistic school groups, messages, tasks, notifications, reminders, scheduled messages, and audit logs from existing users. |
| `scripts/git-event-email.mjs` | Git event email helper | Sends git event emails via SMTP environment variables when configured. |
| `scripts/install-git-hooks.mjs` | Git hook installer | Installs local hooks from `.githooks`. |
| `vite.config.js` | Build/PWA config | Configures React plugin, PWA manifest/workbox, git build metadata constants, and dependency optimization. |
| `tailwind.config.js` | Tailwind design tokens | Defines primary, success, warning, danger, surface, card, and text color extensions. |
| `src/index.css` | Global CSS and utility overrides | Defines typography, scrollbars, animations, responsive mobile sidebar behavior, resizer styling, and `modern-date-input`. |
| `vercel.json` | Vercel SPA routing | Rewrites all paths to `index.html`. |
| `firebase.json` | Firebase config placeholder | Currently `{}` after Firebase Hosting workflow cleanup; Firestore/Auth still use client config in `src/firebase.js`. |
| `service-worker.js` | Legacy/manual service worker file | Present at root; Vite PWA also generates service worker assets during build. |
| `GIT_EMAIL_NOTIFICATIONS.md` | Git/runtime notification notes | Documents email notification strategy. |
| `PROJECT_STATE.md` | Project state notes | Captures prior project context/status notes. |

---

## 2. COMPONENT & FUNCTION GLOSSARY

### 2.1 Application shell and configuration

| File Name | Function Signature | Input/Output Parameters | Core Purpose / Usage |
|---|---|---|---|
| `src/main.jsx` | React entrypoint | Input: DOM `#root`; Output: mounted app | Boots React and renders the application. |
| `src/App.jsx` | `FallbackScreen({ error })` | Input: error object; Output: fallback JSX | Displays crash UI with reload button when an app-level error is captured. |
| `src/App.jsx` | `App()` | Input: none; Output: authenticated app or login screen | Manages auth state, Google login, user provisioning, session registry writes, version display, runtime event notifications, and protected `ChatApp` rendering. |
| `src/App.jsx` | `handleGoogleLogin(e)` | Input: form/button event; Output: Firebase login side effects | Uses Google popup login, creates/updates user profile, detects active sessions, optionally kills older sessions, and writes `user_sessions`. |
| `src/App.jsx` | `handleLogout()` | Input: none; Output: session ended + Firebase sign-out | Marks current session ended and calls Firebase sign-out. |
| `src/App.jsx` | `SafeChatApp({ user, onLogout, onCrash })` | Input: authenticated user and callbacks; Output: `ChatApp` wrapped in error handling | Ensures app crashes can be reported to the shell. |
| `src/firebase.js` | Firebase initialization | Input: embedded Firebase config; Output: `auth`, `db`, `storage`, helper exports | Central Firebase client SDK binding. |
| `vite.config.js` | `getGitInfo()` | Input: local git repository; Output: build metadata object | Captures branch, commit hash, commit subject/date, and remote URL for injected build constants. |
| `vite.config.js` | `safeRun(cmd, fallback)` | Input: shell command; Output: command stdout or fallback | Used by `getGitInfo()` to safely extract git metadata. |

### 2.2 Workspace data and chat engine hooks

| File Name | Function Signature | Input/Output Parameters | Core Purpose / Usage |
|---|---|---|---|
| `src/hooks/useWorkspaceData.js` | `useWorkspaceData(user, profileForm, setProfileForm)` | Input: Firebase user/profile form state; Output: workspace state collections and flags | Subscribes to users, groups, reminders, notifications, audit logs, tags, announcements, current user profile, admin/VIP status, and tool preferences. |
| `src/hooks/useWorkspaceData.js` | `verifyAdminStatus()` | Input: current Firebase auth token; Output: boolean admin claim | Reads custom auth claims to determine privileged admin status. |
| `src/hooks/useChatEngine.js` | `useChatEngine({ user, activeGroup, dbUsers, groups, toolPreferences, isWorkspaceLoading, addToast })` | Input: current user/group and workspace state; Output: messages, typing, offline draft state, and DB action functions | Main messaging hook for real-time messages, typing, offline drafts, upload, reactions, schedule, pin/bookmark/edit/delete. |
| `src/hooks/useChatEngine.js` | `playAlertSound()` | Input: none; Output: browser audio side effect | Plays alert sound for supported notification events. |
| `src/hooks/useChatEngine.js` | `openDraftDB()` | Input: none; Output: IndexedDB connection promise | Opens local `offlineDrafts` DB. |
| `src/hooks/useChatEngine.js` | `loadOfflineDrafts()` | Input: none; Output: updates draft state | Reads locally stored offline drafts. |
| `src/hooks/useChatEngine.js` | `saveOfflineDraft(text, groupId, groupName)` | Input: draft content and group metadata; Output: IndexedDB write | Persists failed/offline message drafts. |
| `src/hooks/useChatEngine.js` | `deleteOfflineDraft(id)` | Input: draft id; Output: IndexedDB delete | Deletes recovered/cleared offline draft. |
| `src/hooks/useChatEngine.js` | `flushOfflineDrafts()` | Input: none; Output: Firestore message writes | Replays saved drafts into `messages` when connectivity resumes. |
| `src/hooks/useChatEngine.js` | `logImmutableAction(actionType, content, target = '')` | Input: action metadata; Output: `audit_logs` write | Creates audit records for immutable workspace events. |
| `src/hooks/useChatEngine.js` | `triggerTypingEvent(userName)` | Input: current user display name; Output: `typing` doc write | Writes typing presence for active group/user. |
| `src/hooks/useChatEngine.js` | `sendMessageToDB(messageText, replyingTo, attachments = [], uploadProgressCb = null)` | Input: message text, optional reply, attachments, progress callback; Output: `messages` writes and mention notifications | Sends text messages, detects user/team mentions, supports private mention forwarding, and uploads attached files. |
| `src/hooks/useChatEngine.js` | `reactToMessageDB(msgId, emoji)` | Input: message id + emoji/tag; Output: message reaction update + notification | Toggles reactions and notifies message sender. |
| `src/hooks/useChatEngine.js` | `uploadAndSendFileDB(pf, onProgress, replyingTo = null)` | Input: pending file object and progress callback; Output: Storage upload + `messages` file doc | Compresses images, uploads files to Firebase Storage, and creates file messages. |
| `src/hooks/useChatEngine.js` | `scheduleMessageDB(text, dt, isTask, taskData)` | Input: text, scheduled datetime, task flag/data; Output: `scheduled_messages` write | Queues a future message/task for the client scheduler. |
| `src/hooks/useChatEngine.js` | `editMessageDB(msgId, originalText, newText)` | Input: message id and text; Output: message update + audit | Edits non-task messages. |
| `src/hooks/useChatEngine.js` | `deleteMessageDB(msg)` | Input: message object; Output: Firestore delete + audit | Deletes allowed messages. |
| `src/hooks/useChatEngine.js` | `togglePinDB(msgId, isPinned)` | Input: message id/current pin state; Output: pin toggle | Pins/unpins messages. |
| `src/hooks/useChatEngine.js` | `toggleBookmarkDB(msgId, bookmarkedBy)` | Input: message id/current bookmark list; Output: bookmark update | Adds/removes current user from bookmark list. |

### 2.3 Main workspace and UI orchestration

| File Name | Function Signature | Input/Output Parameters | Core Purpose / Usage |
|---|---|---|---|
| `src/components/ChatApp.jsx` | `RepliesSidebar(props)` | Input: active thread, message/user/group data, handlers; Output: thread sidebar JSX | Displays reply thread, handles reply text/files, upload progress, and auto-scroll to latest reply. |
| `src/components/ChatApp.jsx` | `ChatApp({ user, onLogout })` | Input: authenticated Firebase user and logout handler; Output: full workspace UI | Main coordinator for state, hooks, layout panes, active modals, chat, sidebars, notifications, tasks, reminders, schedules, and admin view. |
| `src/components/ChatApp.jsx` | `addToast(message, type = 'message')` | Input: message/type; Output: toast state update | Adds transient UI notification. |
| `src/components/ChatApp.jsx` | `removeToast(id)` | Input: toast id; Output: toast removal | Removes clicked/expired toast. |
| `src/components/ChatApp.jsx` | `startResize(side)(e)` | Input: left/right side and pointer event; Output: pane width updates | Enables draggable sidebar resizing. |
| `src/components/ChatApp.jsx` | `playMelody(type)` | Input: sound profile/event type; Output: browser audio side effect | Plays sound cues for message, task, upload, reminder events. |
| `src/components/ChatApp.jsx` | `handleAckBroadcast()` | Input: none; Output: workspace announcement acknowledgement update | Marks global announcement as acknowledged by current user. |
| `src/components/ChatApp.jsx` | reminder/schedule checker effect | Input: active reminders/scheduled messages/time; Output: message writes/notifications/status updates | Polls for due reminders, due tasks, and pending scheduled messages; dispatches notifications and message writes. |
| `src/components/ChatApp.jsx` | `triggerHighlight(msgId)` | Input: message id; Output: highlight state | Temporarily highlights jumped-to messages. |
| `src/components/ChatApp.jsx` | `scrollToMessageDirect(msgId)` | Input: message id; Output: DOM scroll | Scrolls directly to message row. |
| `src/components/ChatApp.jsx` | `navigateToMessageFromNotification(msgId, targetGroupId, replyToId = null)` | Input: message/group/reply id; Output: active group switch + scroll/thread open | Jumps from notifications/task hub/search to the relevant message. |
| `src/components/ChatApp.jsx` | `handleSendOfflineAware()` | Input: current composer state; Output: send or offline draft | Sends message when online or stores local draft when offline. |
| `src/components/ChatApp.jsx` | `handleTypingEvent()` | Input: none; Output: typing state write throttled | Triggers typing indicator update. |
| `src/components/ChatApp.jsx` | `handleSendMessage()` | Input: composer text; Output: Firestore message + notifications | Sends main chat message and notifies other group members. |
| `src/components/ChatApp.jsx` | `handleSaveEdit(msg)` | Input: message being edited; Output: message update | Persists edited message text. |
| `src/components/ChatApp.jsx` | `handleSendPendingFiles()` | Input: pending files/captions; Output: Storage uploads + file messages | Sends queued attachments with optional caption. |
| `src/components/ChatApp.jsx` | `handleFileUpload(e)` | Input: file input event; Output: pending file state | Adds selected files to composer queue. |
| `src/components/ChatApp.jsx` | `handlePaste(e)` | Input: clipboard event; Output: pending image attachment | Detects pasted images and queues them as files. |
| `src/components/ChatApp.jsx` | `handleScheduleMessage(isTask = false, taskData = null)` | Input: schedule form state; Output: `scheduled_messages` write | Queues scheduled message/task and clears modal state. |
| `src/components/ChatApp.jsx` | `notifyInvolvedInTask(taskMsg, actionText)` | Input: task message + action text; Output: notifications | Notifies creator, assignees, and trail participants. |
| `src/components/ChatApp.jsx` | migration effect `migrateAssigneeStates()` | Input: current messages; Output: taskData backfill updates | Adds `assigneeStates`, `masterReviewerEmail`, and `ackBy` to legacy task messages. |
| `src/components/ChatApp.jsx` | `convertToTask()` | Input: selected message, assignees, deadline, priority, ack/proof settings; Output: updates selected message into task | Creates taskData, sends assignment notifications, resets modal state. |
| `src/components/ChatApp.jsx` | `handleSaveTaskTitle()` | Input: selected task/new title; Output: task message text update | Saves edited task title. |
| `src/components/ChatApp.jsx` | `handleDelegateTask()` | Input: selected task and delegate assignees; Output: taskData update | Legacy/modal delegation flow. |
| `src/components/ChatApp.jsx` | `handleCompleteTask()` | Input: selected task; Output: completed status update | Legacy/modal task completion flow. |
| `src/components/ChatApp.jsx` | `handleAddComment(closeModal = false)` | Input: trail comment and modal state; Output: task trail update | Adds task trail comment. |
| `src/components/ChatApp.jsx` | `handleTrailFileUpload(e)` | Input: file input event; Output: Storage upload + trail attachment | Adds file attachment to task trail. |
| `src/components/ChatApp.jsx` | `setReminder()` | Input: selected message + reminder date; Output: `reminders` write + message flag update | Creates message reminder. |
| `src/components/ChatApp.jsx` | `handleEditUserSubmit(e)` | Input: admin edit form; Output: user profile update | Saves admin-edited user data. |
| `src/components/ChatApp.jsx` | `handleAddInlineComment(targetMsg, commentText)` | Input: message/task and comment; Output: inline comment/trail update | Adds inline private/task comment. |
| `src/components/ChatApp.jsx` | `handleReactionIntercept(msgId, tagLabel)` | Input: message id + reaction/tag; Output: reaction update + sound | Routes tag/reaction events through chat engine. |
| `src/components/ChatApp.jsx` | `handleWipeAllTasks()` | Input: admin confirmation; Output: task cleanup | Admin utility to wipe/reset task data. |
| `src/components/ChatApp.jsx` | `handleGroupPicUpload(e)` | Input: group image file; Output: Storage upload + group image URL update | Uploads group avatar. |
| `src/components/ChatApp.jsx` | `handleUpdateGroupMembers(e)` | Input: member form; Output: group member update | Saves updated group member/admin lists. |
| `src/components/ChatApp.jsx` | `handleGroupSubmit(e)` | Input: group form; Output: create/update group | Creates or updates group document. |
| `src/components/ChatApp.jsx` | `onGroupUpdate(updates)` | Input: partial group updates; Output: group doc update | Saves group setting changes. |
| `src/components/ChatApp.jsx` | `handleProfileSubmit(e)` | Input: profile form; Output: user doc update | Saves current user profile/preferences. |
| `src/components/ChatApp.jsx` | `getUnreadInfoForUser(otherUserEmail, otherUserUid)` | Input: DM user identity; Output: unread/needs-task info | Computes DM unread/task counts. |
| `src/components/ChatApp.jsx` | `getUnreadInfoForGroup(groupId)` | Input: group id; Output: unread/needs-task info | Computes group unread/task counts. |

### 2.4 Chat, task card, and composer components

| File Name | Function Signature | Input/Output Parameters | Core Purpose / Usage |
|---|---|---|---|
| `src/components/Chat/ChatView.jsx` | `ChatView(props)` | Input: messages, active group, user, handlers, state refs; Output: message viewport | Renders pinned messages, empty state, message rows, typing indicators, and `MessageBubble` components. |
| `src/components/Chat/InputArea.jsx` | `InputArea(props)` | Input: composer state, file handlers, send handlers, modal setters; Output: composer UI | Provides rich input, formatting actions, emoji picker, attachments, scheduling/reminder/task conversion buttons, offline draft status, and send action. |
| `src/components/Chat/MessageBubble.jsx` | `formatTaskDateTime(value)` | Input: date/datetime string; Output: `DD-MMM-YY HH:MM AM/PM`-style display | Formats task deadlines consistently. |
| `src/components/Chat/MessageBubble.jsx` | `MessageBubble(props)` | Input: message/task data, user/group/db state, handlers; Output: message bubble/task card JSX | Renders message UI and handles task workflow controls. |
| `src/components/Chat/MessageBubble.jsx` | `playTaskSound()` | Input: none; Output: browser sound | Plays task event sound. |
| `src/components/Chat/MessageBubble.jsx` | `logTaskAudit(action, previousState = '', newState = '')` | Input: action/state metadata; Output: `Audit_Logs` write | Appends task-specific audit entries. |
| `src/components/Chat/MessageBubble.jsx` | `notifyTaskChange(actionText, eventType = 'critical', routineKey = '')` | Input: action text and notification category; Output: notifications or batch bucket updates | Notifies involved task users; supports routine-update batching. |
| `src/components/Chat/MessageBubble.jsx` | `handleAcknowledge(e)` | Input: click event; Output: transaction-safe task ack update | Adds current user to `ackBy`, updates status/trail/audit, and unlocks worker controls. |
| `src/components/Chat/MessageBubble.jsx` | `handleInlineSaveTitle()` | Input: edited title state; Output: message title update | Saves inline task title edits. |
| `src/components/Chat/MessageBubble.jsx` | `handleInlineEditTrail(idx)` | Input: trail index; Output: trail edit update | Legacy/admin trail edit path; current UX treats task trail as immutable. |
| `src/components/Chat/MessageBubble.jsx` | `handleInlineDeleteTrail(idx)` | Input: trail index; Output: trail item removal | Legacy/admin trail delete path; current UX does not expose edit/delete controls. |
| `src/components/Chat/MessageBubble.jsx` | `handleInlineComplete(e)` | Input: click event; Output: transaction-safe submitted-for-review update | Moves current worker to `submitted_completed`, updates status/trail, and notifies reviewer. |
| `src/components/Chat/MessageBubble.jsx` | `handleCreatorAcceptCompletion(assigneeEmail)` | Input: assignee email; Output: task state update | Reviewer marks an assignee accepted/completed and recomputes global task status. |
| `src/components/Chat/MessageBubble.jsx` | `handleCreatorReviewAgain(assigneeEmail)` | Input: assignee email + review comment; Output: task state update | Reviewer moves assignee to `needs_review`, appends comment, notifies assignee. |
| `src/components/Chat/MessageBubble.jsx` | `handleInlineDelegateSubmit()` | Input: selected delegate users/comment; Output: task state update | Worker delegates task to selected users and records transfer trail/notifications. |
| `src/components/Chat/MessageBubble.jsx` | `handleTransferTask(fromEmail)` | Input: source assignee + selected transfer users/comment; Output: task state update | Reviewer transfers task from current assignee to one or more new assignees. |
| `src/components/Chat/MessageBubble.jsx` | `handleInlineFileUpload(e)` | Input: file input event; Output: Storage upload + task trail attachment | Uploads task trail files and displays inline progress. |

### 2.5 Sidebars, admin, modals, common components, scripts, and utilities

| File Name | Function Signature | Input/Output Parameters | Core Purpose / Usage |
|---|---|---|---|
| `src/components/Sidebar/LeftSidebar.jsx` | `LeftSidebar(props)` | Input: user/group/DM data and navigation handlers; Output: sidebar JSX | Primary navigation for profile, groups, DMs, task hub, admin workspace, compact search, create/settings/logout actions. |
| `src/components/Sidebar/RightSidebar.jsx` | `formatDDMMMYY(value)` | Input: date string; Output: `DD-MMM-YY HH:MM AM/PM` label | Formats Task Hub due dates. |
| `src/components/Sidebar/RightSidebar.jsx` | `RightSidebar(props)` | Input: assigned/created tasks, groups, users, navigation handlers; Output: task hub JSX | Displays task filters/date filters/archive controls and task cards. |
| `src/components/Sidebar/TaskBoard.jsx` | `TaskCard({ task, groups, dbUsers, user, onClick })` | Input: task and context; Output: task card JSX | Renders alternate task-card UI. |
| `src/components/Sidebar/TaskBoard.jsx` | `TaskBoard(props)` | Input: task lists/context; Output: task board JSX | Provides task board layout. |
| `src/components/Admin/AdminPanel.jsx` | `stripHtml(html)` | Input: HTML string; Output: text | Sanitizes message/task text for admin display/export. |
| `src/components/Admin/AdminPanel.jsx` | `AdminPanel(props)` | Input: users, groups, logs, admin handlers, filter state; Output: admin workspace JSX | Provides user approval, group editing, audit logs, tags, analytics, and admin task/message controls. |
| `src/components/Modals/ModalManager.jsx` | `ModalManager(props)` | Input: `activeModal` and all modal props; Output: selected modal JSX/null | Central modal switchboard. |
| `src/components/Modals/ActiveSchedulesModal.jsx` | `ActiveSchedulesModal({ setActiveModal, user, activeReminders })` | Input: modal close, user, reminder list; Output: schedules modal | Lists/cancels/edits reminders and pending scheduled messages. |
| `src/components/Modals/ActiveSchedulesModal.jsx` | `fetchScheduled()` | Input: current user; Output: scheduled messages state | Reads current user's pending scheduled messages. |
| `src/components/Modals/ActiveSchedulesModal.jsx` | `cancelReminder(id)` | Input: reminder id; Output: reminder deletion | Deletes reminder document. |
| `src/components/Modals/ActiveSchedulesModal.jsx` | `cancelScheduled(id)` | Input: scheduled message id; Output: scheduled message deletion | Deletes pending scheduled message. |
| `src/components/Modals/ActiveSchedulesModal.jsx` | `saveEdit(id, isReminder)` | Input: id and object type; Output: reminder/scheduled message update | Saves edited text/time. |
| `src/components/Modals/AdminEditUserModal.jsx` | `AdminEditUserModal({ setActiveModal, adminForm, setAdminForm, handleEditUserSubmit })` | Input: admin form and submit handler; Output: modal JSX | Admin profile/permission edit dialog. |
| `src/components/Modals/ContextMenuModal.jsx` | `ContextMenuModal(props)` | Input: context action props; Output: modal menu JSX | Modalized context menu action UI. |
| `src/components/Modals/GroupFormModal.jsx` | `GroupFormModal(props)` | Input: group form state and handlers; Output: group create/edit modal | Creates/edits group name, members, admins, image. |
| `src/components/Modals/GroupSettingsModal.jsx` | `GroupSettingsModal(props)` | Input: active group/settings handlers; Output: group settings modal | Updates group metadata/membership and archive state. |
| `src/components/Modals/ProfileSettingsModal.jsx` | `ProfileSettingsModal(props)` | Input: profile form, tool prefs, upload handlers; Output: profile modal | Saves user display and app preference settings. |
| `src/components/Modals/ReminderModal.jsx` | `ReminderModal({ setActiveModal, reminderDateTime, setReminderDateTime, setReminder })` | Input: reminder datetime and save handler; Output: modal JSX | Captures reminder datetime. |
| `src/components/Modals/ScheduleSendModal.jsx` | `ScheduleSendModal({ setActiveModal, scheduleDateTime, setScheduleDateTime, pendingScheduledText, handleScheduleMessage })` | Input: schedule text/date and save handler; Output: modal JSX | Captures scheduled send datetime and confirmation. |
| `src/components/Modals/TaskAnalyticsModal.jsx` | `TaskAnalyticsModal({ setActiveModal, analyticsData })` | Input: analytics data; Output: analytics modal | Displays task reporting/summary metrics. |
| `src/components/Modals/TaskConvertModal.jsx` | `TaskConvertModal(props)` | Input: selected message, task settings, users, handlers; Output: task conversion modal | Converts a message into a task with assignees/deadline/ack/proof settings. |
| `src/components/Modals/TaskTrailModal.jsx` | `TaskTrailModal(props)` | Input: selected task and trail handlers; Output: task detail modal | Displays task history and task-level update controls. |
| `src/components/Common/MemoizedAvatar.jsx` | `MemoizedAvatar({ uid, url, name, sizeClass, isGroup, extraClasses, imageLoading })` | Input: avatar metadata; Output: image or initials/icon JSX | Memoized avatar renderer with localStorage URL cache. |
| `src/components/Common/Toast.jsx` | `Toast({ toasts, removeToast })` | Input: toast list/removal handler; Output: toast stack JSX | Renders notification toasts. |
| `src/components/Common/UploadOverlay.jsx` | `UploadOverlay({ uploadProgress, fileName })` | Input: upload percentage/name; Output: overlay JSX | Shows upload progress while files send. |
| `src/components/ErrorBoundary.jsx` | `ErrorBoundary` class | Input: children; Output: children or fallback | React class boundary for render/runtime errors. |
| `src/utils/helpers.js` | `getNextWorkingDay9AM(date)` | Input: date; Output: future working-day date | Computes next working-day 9 AM for acknowledgement deadlines. |
| `src/utils/imageUtils.js` | `compressImage(file, maxWidth = 1280, maxHeight = 1280, quality = 0.72)` | Input: image `File`; Output: compressed `File`/blob promise | Browser canvas image compression utility. |
| `src/utils/runtimeEventNotifier.js` | `escapeHtml(value = '')` | Input: text; Output: HTML-safe text | Escapes runtime notification content. |
| `src/utils/runtimeEventNotifier.js` | `toRows(entries)` | Input: object entries; Output: table row HTML | Builds HTML rows for runtime event email. |
| `src/utils/runtimeEventNotifier.js` | `buildHtml(eventName, details)` | Input: event name/details; Output: email HTML | Formats runtime diagnostic email body. |
| `src/utils/runtimeEventNotifier.js` | `notifyRuntimeEvent(eventName, details)` | Input: event name/details; Output: Firestore `event_logs` and `mail` writes | Emits runtime diagnostics and queues email through Firebase-trigger pattern. |
| `scripts/seed-school-demo-data.mjs` | `rolePicker(users)` | Input: Firestore users; Output: school role map | Maps existing users into principal/coordinator/teacher roles. |
| `scripts/seed-school-demo-data.mjs` | `baseMessage(...)`, `taskMessage(...)`, `notification(...)`, `audit(...)` | Input: scenario metadata; Output: write descriptor | Builds deterministic demo Firestore documents. |
| `scripts/seed-school-demo-data.mjs` | `readUsers()` | Input: Firestore or mock flag; Output: users array | Reads existing users or returns mock users for local validation. |
| `scripts/seed-school-demo-data.mjs` | `writeDocument(item)` | Input: collection/id/data descriptor; Output: Firestore `setDoc` | Writes seed docs idempotently. |
| `scripts/seed-school-demo-data.mjs` | `main()` | Input: CLI flags; Output: dry-run summary or Firestore writes | Orchestrates full school demo seed. |
| `scripts/git-event-email.mjs` | `run(cmd, fallback = 'unknown')` | Input: shell command; Output: stdout/fallback | Reads git metadata for hook email reports. |
| `scripts/install-git-hooks.mjs` | installer script body | Input: `.githooks` directory; Output: installed executable hooks | Copies local git hooks into `.git/hooks`. |

---

## 3. APPLICATION FLOW & BUSINESS LOGIC

### 3.1 Authentication, user provisioning, and session lifecycle

```text
Login Screen
  └─ Google popup auth
       ├─ Firebase Auth returns user
       ├─ App checks user_sessions for existing active sessions
       │    ├─ If active sessions exist: prompt user to kill or abort
       │    └─ Old sessions can be marked killed
       ├─ users collection is checked/created/updated
       ├─ user_sessions/{localSessionId} is written active
       └─ ChatApp mounts after auth state resolves
```

Key persisted collections:

| Collection | Purpose |
|---|---|
| `users` | User profile, approval/admin flags, group creation permission, preferences, last activity/login/logout. |
| `user_sessions` | Active/killed/ended session tracking with app version metadata. |
| `event_logs` | Runtime boot/health event tracking. |
| `mail` | Firebase-trigger style email dispatch queue used by runtime notifier. |

### 3.2 Workspace data loading flow

```text
ChatApp
  ├─ useWorkspaceData(user)
  │   ├─ users snapshot
  │   ├─ groups snapshot
  │   ├─ reminders query for current user
  │   ├─ notifications query for current user
  │   ├─ workspace tags snapshot
  │   ├─ global announcement snapshot
  │   └─ admin-only reminders/audit logs snapshots
  └─ useChatEngine(...)
      ├─ messages ordered by timestamp
      ├─ typing presence
      ├─ offline draft IndexedDB
      └─ message/file/schedule/reaction actions
```

Data moves through React state as follows:

1. Firestore `onSnapshot` emits records.
2. Hooks normalize snapshots into arrays/state.
3. `ChatApp` computes derived views: groups, DMs, active tasks, notifications, search results, filters, unread counts.
4. UI components render from those derived arrays.
5. UI actions call hook or inline handlers to write back to Firestore/Storage.
6. Snapshot listeners receive the updated data and refresh the UI.

### 3.3 Chat message flow

```text
User types in InputArea
  ├─ Enter or Send invokes handleSendOfflineAware
  ├─ If offline: draft saved in IndexedDB
  └─ If online: handleSendMessage
       └─ sendMessageToDB
            ├─ Detect user mentions and team tags
            ├─ Add text message to messages
            ├─ Upload attachments to Firebase Storage if provided
            ├─ Add file messages with download URLs
            ├─ Forward private mentions into DM thread when applicable
            ├─ Write notifications for mentioned/target users
            └─ Write audit log for immutable message create
```

Core Firestore/Storage outputs:

| Output | Trigger |
|---|---|
| `messages` document | Text send, recovered draft, file upload, scheduled message dispatch. |
| Firebase Storage file object | File upload or task trail upload. |
| `notifications` document | Mention, reaction, task update, reminder, direct/group message notification. |
| `audit_logs` document | Message/task/group/admin events. |
| IndexedDB `offlineDrafts` | Send while offline. |

### 3.4 Reply/thread flow

1. User opens replies from a message action.
2. `RepliesSidebar` filters `messages` where `replyToId === activeReplies.id`.
3. Sidebar auto-scrolls to latest reply when thread changes or reply count changes.
4. Reply send calls `sendMessageToDB` with reply metadata and optional files.
5. New reply appears in thread and normal message stream through Firestore snapshot.

### 3.5 Task creation flow

```text
Message action: Convert to Task
  └─ TaskConvertModal
       ├─ Select assignees
       ├─ Select deadline/priority
       ├─ Optional mandatory acknowledgement
       ├─ Optional proof requirement
       └─ convertToTask()
            ├─ Sanitize message title
            ├─ Build taskData
            │    ├─ deadline
            │    ├─ assignees
            │    ├─ priority/status
            │    ├─ trail[]
            │    ├─ requireAck / ackDeadline / ackBy
            │    ├─ requireProof
            │    ├─ assigneeStates map
            │    ├─ masterReviewerEmail
            │    ├─ isDeleted/deletedAt
            │    └─ dismissedBy/isArchived
            ├─ setDoc messages/{messageId} merge isTask=true + taskData
            ├─ Add notifications for assignees
            ├─ Add audit log
            └─ Play task-created sound
```

Business rules implemented/expected:

| Rule | Behavior |
|---|---|
| Creator/master reviewer is not automatically a worker | `masterReviewerEmail` is separate from `assignees`. |
| Assignee state is per email | `taskData.assigneeStates[email]` tracks worker state. |
| Global task status is derived from assignee states | Completed only when all active workers are accepted/completed. |
| Mandatory ack locks controls | If `requireAck` and current assignee is not in `ackBy`, worker controls are hidden/disabled. |
| Proof-required completion | Completion is disabled until proof exists when `requireProof` applies. |
| Task trail is append-style business record | Trail entries describe created, acknowledged, update, upload, submitted, review, transfer, delegate, completed events. |

### 3.6 Task acknowledgement flow

```text
Assignee opens task
  ├─ If requireAck=true and ackBy[userEmail] is false
  │    └─ Show Ack button only
  └─ On Ack
       ├─ runTransaction reads latest task
       ├─ Adds ackBy[userEmail] = true
       ├─ Appends trail line
       ├─ Updates status to In Progress where appropriate
       ├─ Writes audit record
       └─ UI unlocks controls on next snapshot
```

### 3.7 Task work/update/upload flow

```text
Worker controls
  ├─ Update: append task trail comment
  ├─ Attach: upload file to Storage, append trail file metadata
  ├─ Delegate: select new users + comment, update assigneeStates/assignees/trail
  └─ Completed: submit for review
```

Routine updates/uploads may create batched notification records to avoid excessive pings; critical actions bypass batching.

### 3.8 Submit for review and reviewer flow

```text
Worker clicks Completed
  ├─ runTransaction reads latest task
  ├─ assigneeStates[worker] = submitted_completed
  ├─ Task trail records submission comment
  ├─ Notify master reviewer
  └─ Worker card becomes read-only / Sent for Review

Master Reviewer sees submitted assignees
  ├─ Mark Done
  │    ├─ assigneeStates[worker] = accepted_completed
  │    ├─ Recompute global status
  │    ├─ Append trail comment
  │    └─ Notify worker
  ├─ Review Again
  │    ├─ Requires comment
  │    ├─ assigneeStates[worker] = needs_review
  │    ├─ Append trail comment
  │    └─ Notify worker; controls become available again
  └─ Transfer
       ├─ Requires comment and selected new user(s)
       ├─ Old assignee becomes revoked/transferred-out style state
       ├─ New assignee(s) become active workers
       ├─ Append trail comment
       └─ Notify old and new assignees
```

### 3.9 Reminder and scheduled message flow

#### Reminder

```text
User selects message/task → ReminderModal
  ├─ setReminder() writes reminders
  ├─ message.hasReminder = true
  └─ ChatApp interval checks due reminders
       ├─ update reminder isTriggered=true
       ├─ add notifications reminder
       ├─ play alert sound
       └─ show active reminder alert UI
```

#### Scheduled message

```text
User enters text → ScheduleSendModal
  ├─ handleScheduleMessage()
  └─ scheduleMessageDB() writes scheduled_messages
       └─ ChatApp interval checks pending messages for current sender
            ├─ when due, add messages document
            ├─ mark scheduled_messages status=sent
            └─ play sent sound
```

### 3.10 School demo seed flow

```text
npm run seed:school-demo:dry-run
  ├─ Read users from Firestore
  ├─ Map users to school roles
  ├─ Generate deterministic write descriptors
  ├─ Print counts and role mapping
  └─ Exit without writes

npm run seed:school-demo
  ├─ Same generation steps
  └─ setDoc deterministic docs into:
       ├─ groups
       ├─ messages
       ├─ scheduled_messages
       ├─ reminders
       ├─ notifications
       └─ audit_logs
```

The mock script (`npm run seed:school-demo:mock`) uses fake local users only for generator validation and never writes remote data.

---

## 4. UI PANELS, TABS & NAVIGATION ARCHITECTURE

### 4.1 High-level UI layout

```text
Authenticated App
├── Left Sidebar
│   ├── Profile/avatar/name
│   ├── Search toggle
│   ├── Create group
│   ├── Task Hub toggle
│   ├── Settings/profile
│   ├── Logout
│   ├── Groups list
│   ├── Direct messages list
│   └── Admin Workspace button when admin
├── Main Chat Panel
│   ├── Group/DM header
│   ├── Global search
│   ├── Filter/schedule/notification/task buttons
│   ├── Universal Task Bar with version and quick filters
│   ├── Message viewport
│   ├── Scroll-to-top/bottom controls
│   └── Input composer
├── Right Sidebar / Replies Sidebar
│   ├── Task Hub when enabled
│   └── Replies thread when active
└── Modal Layer
    ├── Profile
    ├── Group form/settings
    ├── Task conversion/trail/analytics
    ├── Reminder/schedule management
    └── Admin edit/context menu
```

### 4.2 Left sidebar navigation

| Navigation Element | Visibility | Action |
|---|---|---|
| Profile photo/name | All authenticated users | Shows user identity; profile settings are available via settings control. |
| Search icon/button | All users | Toggles collapsible sidebar search input to conserve space. |
| Create group button | Admins or `canCreateGroups` users | Opens group creation modal. |
| Task Hub button | All users | Toggles right sidebar task hub. |
| Settings button | All users | Opens profile settings modal. |
| Logout button | All users | Ends current session and signs out. |
| Group list | Groups where current user is a member | Switches active group. |
| DM list | Other approved users | Opens direct-message thread. |
| Admin Workspace v16.0 | Admin/VIP admin only | Switches to admin panel view. |

Responsive behavior:

* Desktop: left sidebar is persistent and resizable.
* Mobile: sidebar becomes a slide-in overlay panel with backdrop.
* Search input is collapsible to preserve width.
* Group/user avatars use memoized image caching.

### 4.3 Main chat panel

| Area | Purpose |
|---|---|
| Header | Active group/DM identity, online member summary, global search, filter/schedule/notification/task controls. |
| Universal Task Bar | Shows current app version and quick filters: All, Pending Tasks, Completed, Messages, Today, Bookmarked. |
| Message viewport | Renders messages/tasks with pinned highlights, unread highlights, typing indicators, and scroll controls. |
| Composer | Rich input, files, emoji, schedule, reminder, task conversion, offline send awareness, Enter-to-send. |

Filtering behavior:

| Filter | Expected Result |
|---|---|
| All | All visible messages and tasks. |
| Pending Tasks | Visible tasks not globally completed. |
| Completed | Completed task cards. |
| Messages | Non-task messages. |
| Today | Content from current date. |
| Bookmarked | Messages/tasks where current user is in `bookmarkedBy`. |

Visibility rules:

* Private mention messages are visible to sender and allowed users.
* Task cards are visible to master reviewer, assignees, and admins.
* Group messages are scoped to active group membership.
* Direct messages use deterministic DM group id derived from sorted user ids.

### 4.4 Right sidebar / Task Hub

| UI Area | Behavior |
|---|---|
| Header | Displays Task Hub title and close button. |
| Status dropdown | Filters All, Pending, Completed, Assigned To Me, Created By Me, Archived. |
| Date filter icon | Expands From/To date inputs. |
| Clear date range | Clears date filters. |
| Task card list | Shows task status badge, due date, title, group name, archive/unarchive, assignee avatars. |
| Completed cards | Use muted readable text and check indicator; no text strikethrough. |

### 4.5 Replies sidebar

| UI Area | Behavior |
|---|---|
| Thread header | Shows Replies label and close/scroll-to-latest actions. |
| Thread messages | Filters messages by `replyToId`. |
| Reply composer | Supports text, file upload, upload progress, Enter-to-send pattern. |
| Auto-scroll | Scrolls to latest reply on thread open and reply count changes. |

### 4.6 Modal navigation

| Modal | Entry Point | Exit / Persistence |
|---|---|---|
| TaskConvertModal | Message action: Convert to Task | Writes taskData into selected message. |
| TaskTrailModal | Task detail flow | Adds comments/files/delegation/completion through parent handlers. |
| ReminderModal | Message/task reminder action | Writes `reminders`, sets `hasReminder`. |
| ScheduleSendModal | Composer schedule action | Writes `scheduled_messages`. |
| ActiveSchedulesModal | Header calendar button | Lists, edits, cancels active reminders and scheduled messages. |
| GroupFormModal | Create/edit group action | Writes `groups`. |
| GroupSettingsModal | Active group header/settings | Updates group metadata/members/admins. |
| ProfileSettingsModal | Settings button | Updates `users` preferences. |
| AdminEditUserModal | Admin panel user edit | Updates selected user. |
| TaskAnalyticsModal | Admin/reporting flow | Displays task analytics summary. |

### 4.7 Formatting/export behavior

The app includes `jspdf` and `jspdf-autotable`, and admin/reporting surfaces are structured around sanitized text (`stripHtml`) to prevent raw rich-text markup in reports/tables. For static conversion or PDF-style exports:

* Always sanitize rich message HTML to plain text before table/report output.
* Preserve task trail entries as immutable business history.
* Convert timestamps to local display strings at render/export time.
* Avoid relying on scroll containers for exported content; render full data lists to tables.

---

## 5. DESIGN SYSTEM & THEME SPECIFICATIONS

### 5.1 Tailwind theme tokens

| Token | Value | Usage |
|---|---:|---|
| `primary.DEFAULT` | `#4F46E5` | Primary buttons, active states, app brand. |
| `primary.hover` | `#4338CA` | Primary hover state. |
| `primary.light` | `#E0E7FF` | Soft selected backgrounds. |
| `success` | `#0D9488` | Completed/success states. |
| `warning` | `#D97706` | Warning/amber states. |
| `danger` | `#DC2626` | Error/destructive states. |
| `surface` | `#F8F7F4` | App background. |
| `card` | `#FFFFFF` | Cards/modals/surfaces. |
| `text-primary` | `#1E1B4B` | Main text. |
| `text-secondary` | `#6B7280` | Supporting text. |

### 5.2 Extended color matrix

| Visual State | Background | Text/Icon | Border | Example Usage |
|---|---:|---:|---:|---|
| App surface | `#F8F7F4` | `#1E1B4B` | n/a | Body/background. |
| Card/modal | `#FFFFFF` | `#1E1B4B` | `#E2E8F0` / `slate-200` | Messages, cards, modals. |
| Primary/active | `#4F46E5` | `#FFFFFF` | `#4F46E5` | Main CTA, version pill, active selected buttons. |
| Primary hover | `#4338CA` | `#FFFFFF` | `#4338CA` | Hover on primary controls. |
| Primary soft | `#E0E7FF` / `#EEF2FF` | `#3730A3` / `#4F46E5` | `#C7D2FE` | Selected filters, chat header buttons. |
| Success/completed | `#F0FDFA` / `teal-50` | `#0D9488` / `teal-600` | `#99F6E4` / `teal-200` | Completed task badges/cards. |
| Warning/review | `#FFFBEB` / `amber-50` | `#D97706` / `amber-600` | `#FDE68A` / `amber-200` | Sent for review, warning states. |
| Danger/destructive | `#FEF2F2` / `rose-50` | `#DC2626` / `rose-600` | `#FECDD3` / `rose-200` | Delete, archive, due warnings. |
| Transferred/maroon | `rgba(128,0,32,0.05)` | `#800020` | `rgba(128,0,32,0.30)` | Transferred/revoked task card emphasis. |
| Slate neutral | `#F1F5F9` / `slate-100` | `#64748B` / `slate-500` | `#CBD5E1` / `slate-300` | Inputs, disabled/neutral badges. |
| Sidebar dark | `#312E81` / indigo dark | `#FFFFFF` | `rgba(255,255,255,0.10)` | Left navigation sidebar. |
| Overlay backdrop | `rgba(15,23,42,0.40)` / `black/40` | n/a | n/a | Modals, mobile overlay. |

### 5.3 Typography

| Layer | Font / Size / Weight | Usage |
|---|---|---|
| Base | `Inter`, `Segoe UI`, Helvetica Neue, Helvetica, Arial, sans-serif | Global body font. |
| App title/login | `text-3xl`, `font-bold` | Product title and major headings. |
| Section headings | `text-xl` / `text-lg`, `font-bold` | Modal/admin/sidebar headers. |
| Chat text | `text-sm` / `text-[13px]`, `font-medium` | Message content and task descriptions. |
| Micro labels | `text-[10px]` / `text-[11px]`, `font-bold` / `font-black`, uppercase/tracking | Badges, filters, timestamps, counts. |
| Buttons | `text-xs` to `text-sm`, `font-bold` / `font-semibold` | Actions and controls. |

### 5.4 Spacing, radius, shadows, and motion

| Category | Standard |
|---|---|
| Modal radius | `rounded-3xl` for major modal shells. |
| Card radius | `rounded-xl` / `rounded-2xl` for task/message cards. |
| Button radius | `rounded-full` for pill actions; `rounded-lg/xl` for utility controls. |
| Standard gap | `gap-2`, `gap-3`, `space-y-3`. |
| Sidebar padding | `p-3`, `p-4`. |
| Modal padding | `p-6`, `p-8`. |
| Shadows | `shadow-sm` for cards, `shadow-lg/2xl` for floating panels/modals. |
| Hover interaction | `hover:-translate-y-0.5`, `hover:shadow-md`, color transition. |
| Animations | `animate-slide-in-right`, `highlight-flash`, `typing-gradient-text`, `typing-avatar-pulse`, loading bar. |

### 5.5 Button component guidelines

| Button Type | Classes / Style Pattern | Usage |
|---|---|---|
| Primary CTA | `bg-indigo-600 text-white rounded-xl/rounded-full font-bold hover:bg-indigo-700` | Send, save, confirm, version/tag actions. |
| Secondary pill | `bg-white border border-slate-200 text-slate-600 rounded-full shadow-sm hover:bg-indigo-50 hover:text-indigo-600` | Task controls: Delegate, Attach, Update. |
| Success action | `bg-emerald-600 text-white` or `bg-emerald-50 text-emerald-700 border-emerald-200` | Mark Done, Completed. |
| Warning action | `bg-amber-500 text-white` / `amber-50` | Review Again / pending review. |
| Danger action | `bg-rose-600 text-white` / `rose-50 text-rose-600` | Transfer, archive, delete, destructive actions. |
| Disabled | `disabled:opacity-50`, `cursor-not-allowed` | Invalid review comments, proof-required completion without proof. |
| Icon button | Square/circle `w-8 h-8` or `w-10 h-10`, centered icon | Header controls, close buttons, search toggles. |

### 5.6 Form and date input guidelines

`modern-date-input` standard:

```css
width: 100%;
height: 38px;
padding: 0 10px;
font-size: 12px;
font-weight: 600;
color: #334155;
background: #fff;
border: 1px solid #cbd5e1;
border-radius: 10px;
transition: all .2s ease;
focus border: #6366f1;
focus shadow: rgba(99,102,241,.15);
```

Use this for:

* Reminder date/time.
* Scheduled message date/time.
* Task deadline.
* Admin filters.
* Right Sidebar date filters.

---

## 6. SERVER & ENVIRONMENT ARCHITECTURE

### 6.1 Runtime architecture

```text
Developer Machine / Vercel Build
  └─ npm run build
       ├─ Vite compiles React app
       ├─ vite.config.js injects git metadata constants
       ├─ Tailwind/PostCSS compiles CSS
       ├─ VitePWA generates service worker/manifest
       └─ dist/ deployed as static assets

Browser Runtime
  ├─ Firebase Auth handles Google login
  ├─ Firestore provides realtime app data
  ├─ Firebase Storage stores file uploads/images
  ├─ IndexedDB stores offline drafts
  ├─ Web Audio API plays notification sounds
  └─ Service worker/PWA assets support app-like install/update behavior

Firebase Backend Services
  ├─ Auth
  ├─ Firestore
  ├─ Storage
  └─ Optional mail/event processing if Firebase extensions/functions are configured externally
```

### 6.2 Hosting

| Layer | Current Configuration |
|---|---|
| Primary hosting target | Vercel static SPA. |
| Vercel rewrites | `/(.*)` → `/index.html`. |
| Firebase Hosting | Disabled/cleared; `firebase.json` is `{}`. |
| PWA | `vite-plugin-pwa` with auto-update and runtime Google APIs as `NetworkOnly`. |

### 6.3 Build and development commands

| Command | Purpose |
|---|---|
| `npm run dev` | Run Vite dev server. |
| `npm run build` | Production build into `dist/`. |
| `npm run preview` | Preview built output locally. |
| `npm run setup:hooks` | Install local git hooks from `.githooks`. |
| `npm run notify:git-event` | Manually send git event notification email if SMTP env is configured. |
| `npm run dev:notify` | Notify app-run event then start Vite dev server. |
| `npm run seed:school-demo:mock` | Validate school demo seed generation with mock users; no writes. |
| `npm run seed:school-demo:dry-run` | Read real Firestore users and print seed plan; no writes. |
| `npm run seed:school-demo` | Apply school demo dataset to Firestore using deterministic IDs. |

### 6.4 Critical environment variables

The React app currently embeds Firebase client configuration in `src/firebase.js`; no `VITE_*` Firebase keys are required by the active code. The following environment keys are used only by optional scripts/automation:

| Environment Key | Used By | Purpose | Required? |
|---|---|---|---|
| `GIT_EVENT_SMTP_HOST` | `scripts/git-event-email.mjs` | SMTP host for git event email notifications. | Optional |
| `GIT_EVENT_SMTP_PORT` | `scripts/git-event-email.mjs` | SMTP port; defaults to `587` if unset. | Optional |
| `GIT_EVENT_SMTP_USER` | `scripts/git-event-email.mjs` | SMTP username. | Optional |
| `GIT_EVENT_SMTP_PASS` | `scripts/git-event-email.mjs` | SMTP password/app password. | Optional |
| `GIT_EVENT_FROM` | `scripts/git-event-email.mjs` | From address for git event email. | Optional |
| `GIT_EVENT_TO` | `scripts/git-event-email.mjs` | Recipient address for git event email. | Optional |

Build-time constants are injected by Vite from local git commands, not environment variables:

| Build Constant | Source |
|---|---|
| `__BUILD_BRANCH_NAME__` | `git rev-parse --abbrev-ref HEAD` |
| `__BUILD_COMMIT_HASH__` | `git rev-parse --short HEAD` |
| `__BUILD_COMMIT_SUBJECT__` | `git log -1 --pretty=%s` |
| `__BUILD_COMMIT_DATE__` | `git log -1 --date=format-local:%d-%b-%y %H:%M --pretty=%cd` |
| `__BUILD_SOURCE_REPO__` | `git config --get remote.origin.url` |

### 6.5 Process manager / daemon configuration

There is no Node/Express backend server and no PM2 configuration in this repository. The deployable artifact is a static Vite build. Operational responsibilities are therefore split as follows:

| Concern | Recommended Owner |
|---|---|
| Static asset hosting and auto-restart | Vercel platform. |
| Auth/session persistence | Firebase Auth + Firestore. |
| Realtime database availability | Firestore managed service. |
| File uploads | Firebase Storage managed service. |
| Scheduled message dispatch | Current client-side interval while sender is logged in. For production-grade delivery, migrate to Cloud Functions/Cloud Scheduler. |
| Reminder dispatch | Current client-side interval while user is logged in. For production-grade delivery, migrate to Cloud Functions/Cloud Scheduler. |
| Runtime email queue processing | Firebase extension/function external to repo if `mail` collection processing is required. |

Recommended future hardening:

1. Move scheduled message dispatch to a backend scheduled function.
2. Move reminder due checks to a backend scheduled function.
3. Move task state mutation authorization to Firestore rules or callable functions.
4. Move seed script to Firebase Admin SDK with `GOOGLE_APPLICATION_CREDENTIALS` for controlled admin seeding.
5. Extract embedded Firebase config to `VITE_FIREBASE_*` environment variables if multiple environments are needed.

### 6.6 Primary Firestore collections

| Collection | Purpose |
|---|---|
| `users` | Profiles, approval/admin flags, preferences, activity timestamps. |
| `groups` | Group metadata, members, admins, archive status. |
| `messages` | Chat messages, file messages, task cards, replies, private forwards. |
| `notifications` | Per-user unread alerts for messages, mentions, reactions, tasks, reminders. |
| `reminders` | Per-user reminder schedule and triggered state. |
| `scheduled_messages` | Pending/sent scheduled message queue. |
| `typing` | Per-group/user typing presence. |
| `audit_logs` | Admin-visible immutable event log. |
| `Audit_Logs` | Task-specific audit shadow collection used by task card actions. |
| `workspace_tags` | Custom reaction/tag labels. |
| `workspace/announcement` | Global announcement/broadcast document. |
| `user_sessions` | Active/killed/ended session registry. |
| `event_logs` | Runtime boot/health event logs. |
| `mail` | Email queue collection for Firebase-trigger pattern. |
| `notification_batches` | Routine task update batching buckets. |

---

## Closing Notes for Future Maintainers

* Treat `src/` as the canonical app source.
* Task cards are stored as `messages` with `isTask: true` and nested `taskData`.
* The app is currently frontend-heavy; several workflows that would typically be backend-enforced are implemented client-side and should be backed by Firestore rules or Cloud Functions for stricter production security.
* The school demo seeder is deterministic and safe to rerun because it writes fixed document IDs with `setDoc(..., { merge: true })`.
* The visible application version is currently tracked manually in `src/App.jsx`, `src/components/ChatApp.jsx`, and the left sidebar admin label.
