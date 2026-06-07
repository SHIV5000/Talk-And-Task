# Denormalized Message & Task Schema Plan

Task 12 standardizes message/task documents so chat, task cards, scheduled delivery, and admin views can render without extra user/group lookups.

## Canonical `organizations/{orgId}/messages/{messageId}` fields

Every new message should include these identity and display fields at write time:

- `senderUid`, `senderEmail`, `senderName`, `senderAvatar`
- `groupId`, `groupName`, `groupAvatar`
- `timestamp`, `dateString`, `time`
- `isTask`, `allowedUsers`, `isPrivateForward`, `seenBy`, `reactions`, `deliveredTo`
- Attachment metadata when present: `storagePath`, `storedFileName`, `fileSize`, `originalFileSize`, `uploadedBy`, `uploadedAt`

## Canonical task display fields

Task messages keep the full `taskData` object, and also denormalize the values most often needed by dashboards/lists:

- `taskTitle`
- `taskStatus`
- `taskPriority`
- `taskDeadline`
- `taskAssigneeEmails`
- `taskAssigneeNames`
- `taskAssigneeCount`
- `taskMasterReviewerEmail`

These fields are duplicated intentionally so task cards, admin dashboards, search, exports, and notifications can avoid fetching users/groups only to render labels.

## Shared payload builders

- Client writes should use `src/utils/messagePayload.js` builders.
- Scheduled delivery should mirror the same schema in Cloud Functions before writing to `messages`.
- Future server-only message creation should either reuse the same schema helper directly or keep its payload contract aligned with this document.

## One-time backfill plan (execute later)

1. Export or snapshot production Firestore before changes.
2. Run a batched Admin SDK script over each `organizations/{orgId}/messages` collection.
3. For each message missing denormalized fields:
   - Resolve sender once from `users/{senderUid}` or cached `senderEmail` lookup.
   - Resolve group once from `organizations/{orgId}/groups/{groupId}`.
   - Derive task display fields from `taskData`.
4. Use batched writes in chunks of 300-450 docs with retry and progress checkpoints.
5. Dry-run first and log counts by organization.
6. Deploy rules/indexes/functions first, then run the backfill during a low-traffic window.
7. Validate random samples in chat, admin task dashboard, exports, scheduled-delivered messages, and notification deep links.

## Acceptance criteria

- New client messages contain sender and group display fields immediately.
- New task messages contain task display fields immediately.
- Scheduled messages delivered by Cloud Functions contain the same denormalized schema.
- UI can prefer denormalized fields and only fall back to live lookups for legacy/backfilled-incomplete documents.
