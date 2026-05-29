# Talk & Task UI Design Reference — Version 18

> **Purpose:** This document describes the **Version 18 UI baseline** so design discussions can happen with another AI/designer **without disturbing existing functionality, features, functions, state, database logic, permissions, or routing**.
>
> **Scope:** UI/UX appearance, layout, navigation surfaces, panels, controls, and interaction expectations only.
>
> **Do not infer implementation permission from this document.** Any future UI implementation must preserve existing handlers, data flows, task workflows, notifications, Firestore writes, upload logic, role checks, routing, and state management.

---

## 1. Version 18 Design Intent

Version 18 is the UI baseline where:

- The **left sidebar header is compact** and no longer shows the user display name below the avatar.
- The **Universal Task Bar carries the user identity**, using possessive naming:
  - `Priya Sharma's Talk & Task Bar`
  - `principal's Talk & Task Bar`
- The app version is shown as minimal text:
  - `Ver. 18.0`
- Task operations are intended to stay functionally intact, with tasks managed through the task sidebar experience introduced before this version.
- Search, notification navigation, task sidebar opening, replies opening, and task hub behavior must remain functional.

---

## 2. Non-Negotiable Functional Protection Rules

When discussing or redesigning the UI from this reference, **do not change**:

| Protected Area | Must Remain Untouched |
|---|---|
| Business logic | Task ack, completion, review, transfer, delegate, notifications, reminders, scheduling, search, pin/bookmark, replies, uploads |
| State management | React state variables, reducers, derived states, modal state, sidebar state, filters |
| Database | Firestore collections, document shape, field names, queries, updates, transactions |
| Auth/session | Google login, active-session registry, logout, approval/admin logic |
| Routing/navigation | Group/DM selection, notification navigation, search result scroll, task sidebar opening, reply thread opening |
| Event handlers | `onClick`, `onChange`, `onSubmit`, `onKeyDown`, file upload handlers, task action handlers |
| Role permissions | Admin, group admin, task creator/master reviewer, assignee/worker rules |

### Safe UI Discussion Areas

Future AI/design discussion may safely focus on:

- Colors
- Spacing
- Typography
- Border radius
- Icon style
- Visual hierarchy
- Badge language
- Responsive layout
- Panel widths
- Animation polish
- Empty states
- Accessibility contrast

---

## 3. High-Level Screen Layout

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Talk & Task App Shell                           │
├───────────────────────┬──────────────────────────────────────┬───────────────┤
│ Left Sidebar          │ Main Chat Workspace                  │ Right Sidebar │
│                       │                                      │               │
│ Profile/action header │ Chat Header                          │ Task Hub      │
│ Search toggle/panel   │ Universal Task Bar                   │ Replies       │
│ Groups list           │ Messages + Task Cards                │ Task Sidebar  │
│ Members / DMs list    │ Main Rich Text Input                 │               │
│ Admin Workspace entry │                                      │               │
└───────────────────────┴──────────────────────────────────────┴───────────────┘
```

### Main Regions

| Region | Purpose | Version 18 UI Notes |
|---|---|---|
| Left Sidebar | Workspace navigation | Compact profile/action header, Groups/Members navigation, admin entry at bottom |
| Main Chat | Primary conversation area | Header, search, universal task bar, message stream, task cards, composer |
| Right Sidebar | Contextual detail panel | Opens replies, task details, or task hub without replacing main chat context |
| Modals | Secondary workflows | Profile, group settings, reminders, schedule send, task conversion, admin actions |

---

## 4. Left Sidebar UI

### 4.1 Sidebar Purpose

The left sidebar is the main navigation rail for:

- User workspace controls
- Group navigation
- Direct message/member navigation
- Admin Workspace access

### 4.2 Header Layout

Version 18 removes the display name from the left sidebar header because the display name is now shown in the Universal Task Bar.

```text
┌──────────────────────────────┐
│ [Profile Photo] [Search] [+] [Gear] [Logout] │
└──────────────────────────────┘
```

### 4.3 Header Controls

| Control | Visual | Functionality To Preserve |
|---|---|---|
| Profile photo | User avatar/photo, compact circular image | Opens/identifies current user context visually; should remain clickable only if existing code already makes it so |
| Search icon | Compact icon button | Toggles sidebar search panel |
| Add `+` | Compact icon button | Opens group creation modal for users with permission |
| Settings gear | Compact icon button | Opens profile/settings modal |
| Logout | Compact icon button | Logs out current user |

### 4.4 Sidebar Search

- Search is **collapsed by default**.
- Clicking the search icon expands a compact search input.
- Search should target sidebar people/groups only.
- Search panel should not permanently consume sidebar space.

### 4.5 Group Section

Expected label:

```text
GROUPS
```

Group row contents:

- Group photo/avatar
- Group name
- Member count
- Unread indicator if relevant

Visual expectations:

- Active group is visibly highlighted.
- Long group names wrap or truncate cleanly without breaking layout.
- Group avatars should use a rounded-square/squircle style.

### 4.6 Members / Direct Messages Section

Expected label:

```text
MEMBERS
```

Member row contents:

- User profile photo/avatar
- Display name
- Online/offline or unread summary
- Presence marker where applicable

Visual expectations:

- User avatars are circular.
- Long names should wrap/truncate cleanly.
- Unread/task counts should remain visible.

### 4.7 Admin Workspace Entry

At the bottom of the left sidebar:

```text
Admin Workspace v18.0
```

Rules:

- Visible only to admin/VIP users according to existing logic.
- Must preserve existing `setViewMode('admin')` behavior.

---

## 5. Main Chat Header

### 5.1 Header Purpose

The main header identifies the active group/DM and exposes global quick actions.

### 5.2 Header Structure

```text
┌─────────────────────────────────────────────────────────────┐
│ [Group/User Photo]  Group Name                              │
│                     member/online sublabel                  │
│             [Search messages and tasks...] [Schedule] [Bell] [Task Hub] [Wipe DB] │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Active Group / DM Identity

| Element | UI Requirement |
|---|---|
| Group photo | Prefer actual uploaded group photo; fallback icon/avatar only if no photo exists |
| DM photo | Prefer actual user profile photo |
| Name | Bold, readable, single-line truncation when needed |
| Sublabel | Member count, online names, or encrypted DM text depending existing state |

### 5.4 Header Search

Version 18 requirement:

- Search above main chat should query **Messages** and **Tasks** only.
- Search result click should scroll to the referenced message/task and highlight it.
- DM search results must route to the correct DM conversation before scrolling.

### 5.5 Header Actions

| Action | Purpose |
|---|---|
| Schedule/reminders | Opens active schedules/reminders modal |
| Bell alerts | Opens notification/activity dropdown |
| Task Hub | Opens Right Sidebar Task Hub |
| Wipe DB | Admin/VIP destructive utility only; must remain protected by existing permissions |

---

## 6. Universal Task Bar — Version 18

### 6.1 Purpose

The Universal Task Bar is a compact, global filter/navigation strip immediately below the main chat header.

### 6.2 Version 18 Naming Rule

The bar displays the current user's display identity in possessive format.

| User | Label |
|---|---|
| Priya Sharma | `Priya Sharma's Talk & Task Bar` |
| principal@school.com | `principal's Talk & Task Bar` |

### 6.3 Version Display

Minimal version text:

```text
Ver. 18.0
```

### 6.4 Filter Buttons

Version 18 filter row should include compact chips such as:

| Filter | Expected Meaning |
|---|---|
| All | Show all visible messages/tasks |
| Pending Tasks | Show active/pending task items |
| Completed | Show completed task items |
| Messages | Show regular messages |
| Today | Show today's items |
| Bookmarked | Show bookmarked items if present in the UI baseline |

### 6.5 Visual Behavior

- Horizontal row.
- Compact chip buttons.
- Active filter visually highlighted.
- Long user display names should not break the row; truncate if necessary.

---

## 7. Main Chat Message Stream

### 7.1 Purpose

Primary workspace for:

- Group messages
- Direct messages
- File messages
- Task cards
- Pinned messages
- Search-highlighted results
- Typing status

### 7.2 Alignment Rules

| Message Type | Alignment |
|---|---|
| Sent by current user | Right aligned |
| Received from others | Left aligned |
| Task cards | Same ownership-aware alignment as the source message |
| Replies panel message copies | Fit within panel width |

### 7.3 Bubble Width

Recommended baseline from Version 18:

- Message bubbles should not span full chat width.
- Task cards should have a max width and clear visual distinction from plain messages.
- Sidebar/thread mode should adapt to narrower widths.

### 7.4 Message Bubble Contents

Regular message bubble may contain:

- Sender name
- Text or rich HTML message content
- File/image preview
- Reactions/tags
- Timestamp
- Sent/delivered/seen status
- Reminder/bookmark markers
- Menu trigger
- Replies button when reply count exists

### 7.5 Message Menu

Existing functionality must remain:

- Reply in Replies
- Convert to Task
- Set Reminder
- Bookmark/unbookmark
- Pin/unpin when permitted
- Delete when permitted

UI redesign may change menu appearance, but must not alter permissions or handlers.

---

## 8. Task Cards In Main Chat

### 8.1 Purpose

Inline task cards show task summary only. By Version 18, task modifications are expected to happen through the task sidebar, not directly in the main chat stream.

### 8.2 Inline Task Card Summary

Expected visible fields:

- Priority chip
- Status chip
- Deadline/due date
- Concerned-only lock indicator
- Task title
- Assignee avatar stack
- Link/callout to open in Task Sidebar

### 8.3 Main Chat Task Behavior

Clicking a task card in main chat should:

1. Close replies if open.
2. Open task details/actions in the Right Sidebar task view.
3. Keep the main chat context intact.

### 8.4 Visual Distinction From Messages

Task cards should differ from message bubbles via:

- Card-like shape
- Clear border or accent border
- Priority/status chips
- Footer/action row
- Assignee avatars
- Lock/visibility indicator

### 8.5 Completed Task Display

Completed task cards should:

- Show completed status clearly.
- Use green/completed visual cues.
- **Not strike through the task title.**

---

## 9. Task Sidebar

### 9.1 Purpose

The Task Sidebar is the operational detail panel for task work.

All task modifications should happen here:

- Acknowledge
- Update
- Upload
- Delegate
- Submit completed
- Review again
- Mark done
- Transfer
- View trail

### 9.2 Sidebar Structure

```text
┌──────────────────────────────┐
│ Task Sidebar Header          │
├──────────────────────────────┤
│ Task card/details            │
│ Worker controls              │
│ Reviewer controls            │
│ Trail / updates              │
└──────────────────────────────┘
```

### 9.3 Worker State UI

| Worker State | Expected Badge | Controls |
|---|---|---|
| assigned | Pending/In Progress | Enabled after ack if ack is required |
| transferred_in | Transferred Task | Enabled after ack if ack is required |
| submitted_completed | Sent for Review | Disabled/read-only |
| needs_review | Under Review by Me | Re-enabled |
| accepted_completed | Completed | Disabled/read-only |
| transferred_out | Task Transferred | Disabled/read-only |
| revoked | Revoked | Disabled/read-only |

### 9.4 Acknowledgement UI

If acknowledgement is required:

- Only the concerned assignee sees the Ack button.
- After clicking Ack, that assignee's Ack button disappears.
- Controls become available for that assignee.
- Other assignees remain unaffected.

### 9.5 Reviewer Controls

Reviewer actions appear only for submitted assignees:

- Mark Done
- Review Again
- Transfer Task

Comments are required where the current workflow requires them.

### 9.6 Task Trail

Task trail is append-only in the UI:

- No edit/delete affordances.
- Shows updates, uploads, acknowledgement, delegation, transfer, review, completion.
- Uses display names where available.

---

## 10. Replies Sidebar

### 10.1 Purpose

Replies Sidebar shows a thread without losing the main chat context.

### 10.2 Open/Close Behavior

- Clicking reply thread opens Right Sidebar replies panel.
- Opening replies closes task sidebar if task sidebar is open.
- Opening a task closes replies if replies are open.

### 10.3 Replies Panel Layout

```text
┌──────────────────────────────┐
│ Replies Header               │
├──────────────────────────────┤
│ Original Message             │
│ Reply count separator        │
│ Reply message list           │
├──────────────────────────────┤
│ Rich text reply input        │
└──────────────────────────────┘
```

### 10.4 Reply Composer

By Version 18, the replies input should share the same rich text input behavior as main chat:

- Formatting toolbar
- Emoji
- Attachment logic
- Enter to send
- Shift+Enter for newline
- File rename/caption flow if available

### 10.5 Auto-Focus

When a reply thread opens:

- Reply input should receive focus automatically.
- Replies should scroll to latest reply.

---

## 11. Right Sidebar Task Hub

### 11.1 Purpose

Task Hub provides a compact list of tasks assigned to/by the current user.

### 11.2 Task Hub Controls

- Status dropdown/filter
- Date filter toggle
- From/to date inputs
- Clear date range
- Archive/unarchive local task visibility

### 11.3 Task Hub Card Contents

Each task card should show:

- Status
- Due date
- Task title
- Group/context label
- Archive/unarchive action
- Assignee avatar stack

### 11.4 Reverse Navigation Behavior

Clicking a Task Hub card should:

1. Navigate/open the correct group or DM if needed.
2. Scroll the main chat to the original task card.
3. Highlight the original task card briefly.

---

## 12. Input Area / Composer

### 12.1 Main Composer Purpose

The main composer sends messages, attachments, scheduled messages, offline drafts, mentions, emojis, and formatted rich text.

### 12.2 Required Controls

| Control | Purpose |
|---|---|
| Formatting toolbar | Bold, italic, underline, superscript, subscript, text color, clear formatting |
| Attachment button | Opens file picker |
| Emoji button | Opens emoji picker |
| Rich text input | Main message body |
| Schedule button | Opens schedule send modal |
| Offline drafts | Opens queued drafts when present |
| Send button | Sends current message/file |

### 12.3 Keyboard Behavior

- Enter sends.
- Shift+Enter creates a newline.
- Mention selection should continue working.

### 12.4 Attachment Flow

Preserve existing behavior:

- File selection
- File rename
- Captions
- Secure/view-only toggle
- Send all pending files
- Upload progress

---

## 13. Notifications / Bell Dropdown

### 13.1 Purpose

The bell dropdown surfaces:

- Pending task alerts
- Replies
- Mentions
- Reminders
- Reactions
- Direct messages
- Task updates

### 13.2 Navigation Behavior

Clicking an alert should route to the referenced item:

| Alert Type | Expected Result |
|---|---|
| Message | Open group/DM and scroll to message |
| Task | Open group/DM and scroll/open task depending existing routing rule |
| Reply | Open thread and scroll/highlight referenced reply/message |
| Reminder | Navigate to linked message/task if available |
| DM | Open correct direct message conversation |

### 13.3 Clear/Delete Controls

- Clear all should mark notifications read according to existing behavior.
- Individual close/delete should preserve existing delete behavior.

---

## 14. Search UX

### 14.1 Main Header Search

Search is scoped to:

- Messages
- Tasks

### 14.2 Search Result Card

Each result should show:

- Sender/display context
- Date/time
- Message/task text
- Task marker if task

### 14.3 Click Behavior

Clicking a result should:

- Close/fade search results.
- Open correct group/DM context.
- Scroll to target message/task.
- Highlight target briefly.

---

## 15. Modals UI Inventory

Version 18 keeps all modal workflows functionally intact.

| Modal | Purpose |
|---|---|
| Profile Settings | User profile, preferences, settings |
| Group Form | Create/edit group |
| Group Settings | Group details, members/admins, group photo |
| Reminder | Set reminder on message/task |
| Schedule Send | Schedule future message |
| Task Convert | Convert message to task |
| Task Trail | View task trail if still accessible in UI |
| Active Schedules | Manage scheduled messages/reminders |
| Admin Edit User | Admin user management |
| Task Analytics | Task reporting/analytics if enabled |

Designers may restyle modal spacing/radius/colors, but modal behavior and data submission must remain unchanged.

---

## 16. Design Tokens — Version 18 Discussion Baseline

These tokens describe the visual direction that existed around Version 18 and can be used in design discussions.

| Token | Suggested Value / Meaning |
|---|---|
| Primary accent | Indigo / violet family |
| Primary button | Indigo background, white text |
| Soft accent | Pale indigo backgrounds |
| Success | Green/teal cues for completed/accepted |
| Warning | Amber/yellow cues for pending review/ack |
| Danger | Rose/red cues for destructive/revoked |
| Transfer | Maroon/rose/orange cue for transferred-out |
| Sidebar | Deep indigo/violet |
| Chat background | Light neutral/slate or soft-tint workspace |
| Panel background | White |
| Border | Light slate/indigo-tinted borders |
| Typography | System sans-serif / Inter-like UI font |
| Radius | Rounded cards/buttons, compact pill filters |

---

## 17. Component-Level UI Map

| Component/File | UI Responsibility | Version 18 Design Notes |
|---|---|---|
| `App.jsx` | Login/loading shell and app version | Shows `Ver. 18.0` on login screen |
| `ChatApp.jsx` | Main app shell, header, task bar, sidebars, modals | Hosts Universal Task Bar label and major navigation layout |
| `LeftSidebar.jsx` | Groups/Members navigation | Compact header, no display name, search toggle, admin footer |
| `RightSidebar.jsx` | Task Hub | Filters, date range, task cards, reverse navigation |
| `ChatView.jsx` | Message list and scroll/highlight behavior | Maintains scroll, date divider, pinned message, typing status |
| `MessageBubble.jsx` | Message bubble and task-card rendering | Sent/received alignment, task summary, menus, reactions/tags |
| `InputArea.jsx` | Main/reply rich text composer | Toolbar, attachments, emoji, send, schedule, offline drafts |
| `MemoizedAvatar.jsx` | Avatar rendering | Actual photo first; fallback initials/icon; group square/user circle principle |
| `ProfileSettingsModal.jsx` | User profile/settings UI | Can be styled but profile logic must remain intact |
| `ScheduleSendModal.jsx` | Scheduling UI | Date/time controls should stay consistent with theme |
| `TaskConvertModal.jsx` | Task creation UI | Must preserve assignee/ack/proof/deadline behavior |
| `ActiveSchedulesModal.jsx` | Scheduled/reminder management | Preserve scheduling/reminder actions |

---

## 18. Suggested Discussion Prompts For Another AI

Use these prompts when discussing design safely:

1. **Left Sidebar:** “Improve the visual hierarchy of Groups and Members without changing click handlers, filtering, or group/DM data.”
2. **Universal Task Bar:** “Suggest compact chip styling for `Ver. 18.0`, user possessive label, and filters without changing filter keys or state.”
3. **Message Bubbles:** “Improve sent/received bubble contrast and spacing while preserving message menus, reactions, reply buttons, and alignment.”
4. **Task Cards:** “Improve inline task card readability without adding/removing task actions or changing task state logic.”
5. **Replies Sidebar:** “Make the thread visually clearer while preserving reply composer, reply navigation, and thread message ordering.”
6. **Task Sidebar:** “Improve worker/reviewer action grouping without changing acknowledgement, review, transfer, completion, upload, or delegation behavior.”
7. **Task Hub:** “Improve task list card density and filter layout without changing archive/filter/navigation behavior.”

---

## 19. Red Flags For Future UI Work

If another AI proposes any of these, reject or revise the proposal:

- Renaming Firestore fields.
- Moving task updates out of the task sidebar without approval.
- Replacing existing event handlers.
- Removing `taskData.assigneeStates`, `ackBy`, or task trail rendering.
- Making creator auto-assignee again.
- Making task acknowledgement global instead of per-assignee.
- Reintroducing completed task title strikethrough.
- Hiding task controls based only on global task status instead of per-assignee state.
- Removing DM support from notifications/search.
- Removing file rename/caption/security behavior.
- Replacing actual profile photos with initials when photos exist.

---

## 20. One-Line Summary

**Version 18 UI = compact left sidebar header + user-named Universal Task Bar + minimal `Ver. 18.0` tracking + main/reply rich composer parity + task-sidebar-oriented task operations + preserved task/reply/search/notification functionality.**
