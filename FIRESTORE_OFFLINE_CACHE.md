# Firestore Offline Cache Rollout

Task 11 enables Firestore's persistent local cache so repeat reads can be served from IndexedDB and queued writes can resume after connectivity is restored.

## What is enabled

- `src/firebase.js` initializes Firestore with `persistentLocalCache()`.
- `persistentMultipleTabManager()` allows the same signed-in user to keep Talk & Task open in multiple browser tabs without forcing one tab into a failed owner state.
- Existing IndexedDB draft support remains separate and continues to protect unsent message drafts.

## Expected behavior

- Recently loaded organization data can render while offline.
- Writes made while offline stay in Firestore's local queue and are sent when the browser reconnects.
- Firestore SDK write IDs and local mutation queue prevent duplicate commits from normal reconnect/retry behavior.

## Unsupported browser / private mode fallback

Some browsers, private/incognito sessions, locked-down enterprise profiles, or full storage quotas can block IndexedDB persistence. If that happens:

1. The app should continue running with Firestore's in-memory cache for that tab/session.
2. Offline data may not survive a tab close or browser restart.
3. Pending writes should be allowed to flush while the tab remains open and connectivity returns.
4. Users should leave the tab open until they are back online if they see browser storage/private-mode warnings.

## Manual verification

1. Open the app in a normal browser profile and sign in.
2. Load a tenant chat, reminders, notifications, and admin data that are allowed for your role.
3. Turn off network access in browser DevTools.
4. Refresh or navigate within already loaded screens and confirm cached data appears.
5. Create a test message while offline, reconnect, and confirm it sends once.
6. Repeat with two tabs open for the same account to verify multi-tab cache ownership works.
7. Repeat in private/incognito mode and confirm the app still loads even if persistent cache is unavailable.
