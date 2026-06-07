# Talk & Task Cost & Surprise-Bill Safeguards

## Console actions required
1. **Billing budget alerts**
   - Create a monthly GCP budget for the Firebase billing project.
   - Add thresholds at **50%**, **80%**, and **90%**.
   - Route alerts to owner email and Slack/email integration used by the school/admin team.
2. **Cloud Functions limits**
   - New monitoring/admin callables use `maxInstances` guards in code.
   - Keep production functions on conservative max instances until traffic baselines are known.
3. **Firestore quota dashboard**
   - Track daily reads, writes, deletes, index storage, and listener count.
   - Investigate any sudden read spike from chat/admin screens.
4. **Storage quota dashboard**
   - Track `organizations/{orgId}/storageUsedBytes` against package limits.
   - Alert when an org reaches 80% and 95% of its effective storage limit.

## INR planning assumptions
- Treat Firestore reads as the primary variable cost because chat/admin listeners can fan out quickly.
- Keep initial chat page bounded and use `Load older` instead of unbounded history reads.
- Secure PDF downloads generate Function invocations, email extension writes, signed URL reads, and Storage egress.
- Budget review should happen weekly until traffic stabilizes, then monthly.

## Launch gate checklist
- [ ] Budget alerts configured at 50/80/90%.
- [ ] Budget alert recipients tested.
- [ ] Firestore usage dashboard bookmarked for the support/admin owner.
- [ ] Storage usage dashboard bookmarked.
- [ ] Cloud Functions max-instance policy reviewed before production deploy.
