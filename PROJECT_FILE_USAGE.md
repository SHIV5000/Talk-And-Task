# Talk-And-Task File Usage Map (v25.0)

## Active application files

| File | Application in app | Functions / features related to it |
|---|---|---|
| `src/main.jsx` | React/Vite entrypoint | Mounts `App`, loads global CSS and PWA/runtime hooks. |
| `src/App.jsx` | Login and app shell | Firebase auth, version label, runtime fallback, `ChatApp` bootstrap. |
| `src/firebase.js` | Firebase binding | Exports Auth, Firestore, Storage, and Firestore helpers used by app hooks/components. |
| `src/index.css` | Global styling | Tailwind layers, theme utilities, chat bubble/sidebar/search/alert styles. |
| `src/components/ChatApp.jsx` | Main workspace controller | Layout, groups/DMs, universal filters/search, notifications, task conversion, modal state, upload limits. |
| `src/hooks/useWorkspaceData.js` | Workspace subscriptions | Users, groups, reminders, notifications, tags, announcements, audit logs, profile settings. |
| `src/hooks/useChatEngine.js` | Chat/data engine | Message listener, send/edit/delete, reactions, typing, scheduled messages, uploads, limits, sounds. |
| `src/components/Chat/ChatView.jsx` | Main chat renderer | Message list, day separators, inline reply threads, pinned/empty states, scroll targets. |
| `src/components/Chat/MessageBubble.jsx` | Message and task card UI | Bubbles, inline replies/attachments, task ack/update/delegate/transfer/completion, trail rendering. |
| `src/components/Chat/InputArea.jsx` | Main composer | Rich text, mention chips, files, emoji, schedule/reminder/task buttons, typing cleanup. |
| `src/components/Sidebar/LeftSidebar.jsx` | Left navigation | Profile/admin controls, groups, DMs, unread/online indicators, search/settings/logout. |
| `src/components/Sidebar/RightSidebar.jsx` | Analytics sidebar | Logged-in user stats, online count, date preset cards, compact activity summary. |
| `src/components/Admin/AdminPanel.jsx` | Admin workspace | Users, groups, tasks, tags, broadcast vault, audit logs, analytics, upload limit controls. |
| `src/components/Modals/ModalManager.jsx` | Modal router | Opens profile, group, reminder, schedule, task, analytics, context, and admin edit modals. |
| `src/components/Modals/TaskConvertModal.jsx` | Convert to task | Assignees, priority, deadline, ack/proof settings. |
| `src/components/Modals/TaskTrailModal.jsx` | Task trail modal | Task history/comments/attachments where modal trail is still invoked. |
| `src/components/Modals/ActiveSchedulesModal.jsx` | Schedule/reminder manager | List/edit/cancel reminders and scheduled messages. |
| `src/components/Modals/ReminderModal.jsx` | Reminder creation | Date/time reminder setup. |
| `src/components/Modals/ScheduleSendModal.jsx` | Scheduled send | Date/time scheduled message setup. |
| `src/components/Modals/GroupFormModal.jsx` | Group create/edit | Group name, members/admins, photo. |
| `src/components/Modals/GroupSettingsModal.jsx` | Group settings | Edit members/admins/name/photo and group archive/update. |
| `src/components/Modals/ProfileSettingsModal.jsx` | User profile | Name/photo/font/sound/tool preferences. |
| `src/components/Modals/AdminEditUserModal.jsx` | Admin user editor | User approval/profile/admin property updates. |
| `src/components/Modals/ContextMenuModal.jsx` | Context actions | Message/task menu actions. |
| `src/components/Modals/TaskAnalyticsModal.jsx` | Analytics modal | Detailed task metrics/reporting. |
| `src/components/Common/MemoizedAvatar.jsx` | Avatar component | Cached user/group avatars with fallback initials/icons. |
| `src/components/Common/Toast.jsx` | Toast UI | Short success/error/info notifications. |
| `src/components/Common/UploadOverlay.jsx` | Upload progress UI | Shared upload progress display when invoked by modal manager. |
| `src/components/ErrorBoundary.jsx` | React safety wrapper | Catches render crashes and shows fallback UI. |
| `src/utils/helpers.js` | Date helpers | Working-day/deadline utility logic. |
| `src/utils/imageUtils.js` | Image processing | Compresses and converts uploaded images to webp where used. |
| `src/utils/runtimeEventNotifier.js` | Runtime notification helper | Sends app/runtime event notification records. |

## Deleted unused/duplicate files

| Deleted file | Why removed |
|---|---|
| Root-level JSX/CSS/Firebase mirror files (`App.jsx`, `LeftSidebar.jsx`, `RightSidebar.jsx`, modal mirrors, `firebase.js`, `imageUtils.js`, `index.css`) | Duplicates not imported by Vite; active app imports canonical files from `src/`. |
| `src/components/Sidebar/TaskBoard.jsx` | No imports or route references in active code; right sidebar now uses analytics and tasks open in main chat. |
