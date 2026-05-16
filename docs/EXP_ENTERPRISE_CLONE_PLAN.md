# Talk & Task Enterprise (`exp`) — Implementation Plan

Date: 2026-05-16  
Branch: `exp`

## Objective
Build an experimental enterprise clone on top of the existing Talk & Task codebase while **reusing the same Firebase project and data model** (`users`, `groups`, `messages`).

## Guardrails
- Reuse existing Firebase initialization and environment variables.
- Preserve existing Firestore collection names and task payload shape.
- Keep current auth and approval gates (`isApproved`, `isAdmin`, `canCreateGroups`).
- Favor inline expansion over nested modal drilling for core records.

## Workstreams

### 1) Foundation & Theming
- Consolidate enterprise color semantics (indigo/slate/emerald/amber/rose/blue/purple/teal).
- Normalize compact typography and spacing for dense operational views.
- Introduce reusable status tokens for task badges and pills.

### 2) Data & Workflow Compatibility
- Validate all task writes maintain `taskData` fields:
  - `assignees`, `status`, `priority`, `deadline`
  - `requireAck`, `ackDeadline`, `acknowledgedBy`
  - `requireProof`, `escalated`, `escalationTransferred`, `breachedBy`, `trail`
- Ensure delegation computes assignee deltas (`added`, `removed`, `kept`).
- Ensure action interception auto-appends acknowledgments where required.

### 3) Escalation & Compliance Engine
- Keep periodic checker cadence (15s) for deadline and ack-deadline breach.
- Maintain immutable breach attribution (`breachedBy`) for SLA analytics.
- Preserve escalation-transfer behavior when delegated after escalation.

### 4) UI: Inline Expansion Pattern
- Use row expansion for task/department detail drill-down.
- Avoid nested modal stacks for operational detail navigation.
- Keep admin/reporting actions visible and fast from primary view.

### 5) Reporting & Exports
- Keep PDF generation client-side (`jspdf`, `jspdf-autotable`).
- Standardize header/footer utility for all admin exports.
- Sanitize rich text into plain text for tabular reports.

### 6) Delivery Strategy
- Phase A: visual token + dense layout normalization.
- Phase B: task workflow hardening (ack/proof/delegation/escalation).
- Phase C: admin SLA/reporting views and export refinement.
- Phase D: QA pass and regression check.

## Verification Checklist
- [ ] App builds successfully in Vite.
- [ ] Firebase auth session works with existing project.
- [ ] Existing groups/messages render without migration.
- [ ] Task creation + delegation + completion lifecycle works.
- [ ] Escalation logic marks and transfers state correctly.
- [ ] Admin exports include standardized header/footer.

## Notes
This branch is intentionally experimental and should remain backward-compatible with production Firebase documents.
