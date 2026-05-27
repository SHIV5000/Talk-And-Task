# Git Email Notifications

Yes — this is possible.

This repo now includes an optional Git-hook based email notifier for events like:
- commit (`post-commit`)
- branch switch/create checkout (`post-checkout`)
- merge (`post-merge`)

## Setup

1. Install dependency:
   ```bash
   npm install
   ```
2. Enable repository hooks:
   ```bash
   npm run setup:hooks
   ```
3. Export environment variables:
   ```bash
   export GIT_EVENT_SMTP_HOST=smtp.yourmail.com
   export GIT_EVENT_SMTP_PORT=587
   export GIT_EVENT_SMTP_USER=your-user
   export GIT_EVENT_SMTP_PASS=your-pass
   export GIT_EVENT_FROM=bot@yourdomain.com
   export GIT_EVENT_TO=you@yourdomain.com
   ```

## What gets emailed

- Event type
- Branch
- Commit hash
- Commit message (name)
- Edited time (`DD-MMM-YY HH:MM`)
- Commit author
- Source repository URL

## Notes

- Git hooks run on your local machine/repository clone, so each developer who needs emails must run setup in their clone.
- If env vars are missing, the hook exits safely without blocking your Git action.
