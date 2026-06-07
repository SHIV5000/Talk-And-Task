# Talk & Task Production Monitoring & Alerting

## Runtime monitoring now wired in code
- Firebase Performance Monitoring is initialized from `src/firebase.js` for browser builds, alongside App Check and Firestore offline cache.
- Cloud Functions exposes `health`, an HTTPS health endpoint returning service/version/timestamp for uptime checks.
- Callable abuse protection writes server-side rate-limit records to `rate_limits` and org-scoped `abuse_logs` when thresholds are exceeded.

## Required console setup
1. **Firebase Performance Monitoring**
   - Open Firebase Console → Performance → enable Web Performance for the production app.
   - Watch page load, network, and custom traces after deploy.
2. **Sentry React**
   - Create a Sentry project for the React frontend.
   - Add the DSN as `VITE_SENTRY_DSN` when the dependency is introduced in a later dependency pass.
   - Alert on unhandled errors and session replay sampling only for production.
3. **Cloud Functions health check**
   - Deploy `health` and attach an uptime check to the HTTPS URL.
   - Alert Slack/email if two consecutive checks fail.
4. **GCP operational alerts**
   - Cloud Functions: error count > 5 in 5 minutes.
   - Cloud Functions: p95 latency > 5 seconds for callables.
   - Firestore: document read/write spikes > expected baseline.
   - Storage: upload/delete error spikes.
5. **Incident routing**
   - P0 security/auth/storage outage → immediate Slack + email.
   - P1 performance degradation → Slack during business hours.
   - Cost/budget alerts follow `COST_AND_BUDGET_SAFEGUARDS.md`.

## Manual verification
- Run `curl <health-url>` after deploy and confirm `{ "ok": true }`.
- Trigger a safe callable repeatedly in emulator/staging to confirm `abuse_logs` receives rate-limit events.
- Verify Firebase Performance dashboard receives web vitals within 24 hours after production traffic.
