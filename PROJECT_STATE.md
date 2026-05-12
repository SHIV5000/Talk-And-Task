# 🚀 Talk & Task - Board Edition (Project State)
**Last Updated:** May 2026

## 🏗️ Tech Stack & Architecture
* **Frontend:** React (Vite) + Tailwind CSS
* **Backend/DB:** Firebase (Firestore, Auth, Storage)
* **Design Philosophy:** Modular Enterprise Structure. 
  * Avoid global screen-blocking modals. Favor contextual, localized overlays and inline expansions (e.g., inside the Admin tab or Sidebar).
  * Direct library imports used for Firebase to prevent circular dependency (`as`) crashes.
  * Custom hooks (`useWorkspaceData`, `useChatEngine`) handle all heavy logic, keeping the orchestrator (`ChatApp.jsx`) clean.

## 📂 Directory & Component Map
* **`ChatApp.jsx`**: The Grand Orchestrator. Manages UI state, view toggling, and passes props.
* **`hooks/useChatEngine.js`**: Backend Brain. Handles all Firestore message reads/writes, task scheduling, and file uploads.
* **`hooks/useWorkspaceData.js`**: Global State. Fetches users, groups, notifications, and audit logs.
* **`Admin/AdminPanel.jsx`**: Enterprise Dashboard. Handles user management, group creation, log filtering, and localized task trail overlays.
* **`Sidebar/RightSidebar.jsx`**: Task Hub. Renders Jira-style task cards and inline comment/trail expansions.
* **`Modals/ModalManager.jsx`**: Global overlays (Profile settings, context menus, schedule sends). Excludes Admin/Task modals which are now handled locally.

## ✅ Recently Completed Milestones
1. **Squashed the Service Worker Bug:** Injected `registerSW({ immediate: true })` into `main.jsx` to forcefully bust stale caches and prevent blank screens.
2. **Fixed COOP Auth Crashes:** Transitioned from `signInWithPopup` to `signInWithRedirect` to bypass strict browser popup blockers.
3. **Localized Admin Overlays:** Refactored `AdminPanel.jsx` to render Group Creation and Task Trails *inside* the admin tab using `localOverlay` state, abandoning the global `ModalManager` for these views.
4. **Inline Task Trails:** Modified `RightSidebar.jsx` so clicking a task expands the trail and comment box inline beneath the card, rather than opening a modal.
5. **Architectural Cleanup:** Removed duplicate modal handlers and passed `handleAddInlineComment` strictly where needed to prevent prop drilling crashes.

## 🗺️ Immediate Roadmap (Next Features)
* **Phase 2:** Implement **Dark Mode** (Save theme preference to `toolPreferences` in Firestore; use Tailwind `dark:` variants).
* **Phase 3:** Build **Global Search** (Query entire `messages` array across all departments/DMs).
* **Phase 4:** **Email Integration** (Trigger email alerts for "Critical" tasks or external assignees via Firebase extension or Node service).

## ⚠️ Core Rules for AI Assistant
1. **Never** suggest reverting our architecture back to global modals for Admin/Task views. Maintain the localized overlay strategy.
2. **Always** use direct Firebase imports (e.g., `import { doc } from 'firebase/firestore'`) rather than importing from local configuration to prevent Vite compilation crashes.
3. **Respect Custom Hooks:** Ensure all backend modifications interact properly with `useChatEngine.js` and `useWorkspaceData.js` rather than writing bare Firebase calls inside UI components.
4. **Context Diet:** Do not assume the structure of files not explicitly provided in the current prompt. Ask for the code if needed.
