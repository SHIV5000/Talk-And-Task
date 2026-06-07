# Firebase App Check Setup

Talk & Task initializes Firebase App Check in `src/firebase.js` with the reCAPTCHA v3 provider. App Check should be rolled out in monitor mode first, then enforced after verifying legitimate traffic.

## Required environment variables

Add these variables to each web deployment environment:

```bash
VITE_FIREBASE_APPCHECK_SITE_KEY="<recaptcha-v3-site-key>"
```

For local development only, add a debug token when needed:

```bash
VITE_FIREBASE_APPCHECK_DEBUG_TOKEN="<firebase-app-check-debug-token>"
```

You may temporarily set `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN="true"` to make the browser print a generated debug token in the console, then register that token in Firebase Console and replace `true` with the registered token value.

## Firebase Console rollout steps

1. Open Firebase Console → Build → App Check.
2. Register the web app with reCAPTCHA v3 and copy the site key into `VITE_FIREBASE_APPCHECK_SITE_KEY`.
3. Add local/staging debug tokens under App Check debug tokens.
4. Deploy the application with App Check initialized, but keep enforcement off initially.
5. Monitor App Check request metrics for Firestore, Storage, and Cloud Functions.
6. After valid client traffic is consistently verified, enable enforcement for:
   - Cloud Firestore
   - Cloud Storage
   - Cloud Functions callable/HTTPS endpoints where safe
7. Keep enforcement changes staged: development → staging → pilot tenant → production.

## Operational notes

- Missing `VITE_FIREBASE_APPCHECK_SITE_KEY` leaves App Check uninitialized and prints a browser warning.
- Debug tokens are secrets. Do not commit real debug token values to the repository.
- If enforcement blocks valid users, temporarily disable enforcement in Firebase Console, confirm the deployed site key/debug tokens, then re-enable enforcement after validation.
