# Git & Runtime Notifications (No `.env` required)

This project now uses a Firebase-trigger pattern for runtime emails so you do not need to set webhook or SMTP env vars in the app.

## How it works

- On app start and on successful login, the app writes event records to Firestore:
  - `event_logs` (audit trail)
  - `mail` (email job payload with beautiful HTML)
- If Firebase **Trigger Email extension** is installed on project `niltask`, every new `mail` doc sends an email automatically.

## Runtime trigger events

- `app-run`
- `user-login`

## Email layout

- Gradient header + table layout
- Includes event, time, domain, branch, commit, edited time, source, and user details (when login event).

## Important

- This avoids `.env` setup in app/deployment for runtime notifications.
- Email delivery is handled by Firebase automation trigger from Firestore `mail` collection.
