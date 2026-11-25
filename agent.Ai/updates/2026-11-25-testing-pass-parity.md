# Agent Update - Accepted Testing feature parity

**Date:** 2026-11-25
**Agent/model:** GPT-6.2
**Repository:** Alex1122341/Teaching-assignment-azure
**Task status:** PARTIAL - feature candidate implemented; not released

## 1. Goal
Port the accepted University Closures, Workflow Notifications and Select Sessions batch-edit behavior to Beta; verify existing Scheduling Task Review. Defer AFC CSV Import (Multi Input already exists).

## 2. Starting breakpoint
- Base: main, 35c2c608fb2010d359555ab37350b12325cfa2a9
- Branch: feat/testing-pass-parity-20261125
- Runtime read-only verification: release 20a5e893a6d446def353991d251c91307ab9a8a5, schedulingTaskReview false, sessionEdit true.
- No production change authorized by the candidate itself.

## 3. Work performed
- Read-only institutional closure calendar overlay, independent checkbox, dates aligned with existing AFC closure policy; no DOE or session mutations.
- Account-scoped notification counts from University API, asynchronous after login, no faculty names or private request details in notification panel.
- Select Sessions: max 20 existing sessions, scalar edits and supported canonical Faculty assignment changes. Curriculum year stays read-only. Existing Firestore mutation gates remain closed.
- API POST /api/v1/sessions/batch-edit: explicit role and separate write capability, all rows validated, snapshot tokens checked in a SERIALIZABLE transaction, existing audited stored procedures reused. Any write failure rolls back the transaction. DOE recalculation is post-commit under existing authority.
- Existing Task Review verified; no implementation replacement and no live write-gate change.
- Graphify dependency review regenerated from base; checked relevant calendar/save functions.

## 4. Changed components
- frontend/pages/index.html, frontend/scripts/calendar-tested-features.js, timetable.js, paws-data-client.js, timetable.css and static manifest.
- server/src/data/data-api.js, sql-session-repository.js, write-gates.js, runtime route/HTTP wiring, AFC capability read route.
- New focused tests and existing capability-contract tests updated.

## 5. Architecture / invariants
Preserve Beta SQL authority, server role scope, canonical identities, existing audit procedures, default-denied writes, separate immutable runtime freeze. No Firestore fallback. New batch write gate PAWS_SESSION_BATCH_EDIT_ENABLED defaults false and also requires sessionEdit true. Conservative first-release limit of 20. Closure dates reflect existing policy, not newly verified institutional calendars; exports unchanged. Sessional/unresolved assignments not silently replaced.

## 6. Data / algorithms
Snapshot token hashes canonical session facts and sorted faculty assignment identities/roles/active states. Preflight every token before writes; prevent duplicate IDs, unsupported fields, invalid assignments and stale edits. Post-commit DOE failures are reviewable, not client-computed. No schema migration added.

## 7. Test evidence
- First focused run: 96 passed, one test file could not load pdf-lib before server dependencies were installed.
- Login and new UI/calendar tests after UI fix: 58/58 pass.
- Batch edit server tests: 7/7 pass (mock transaction / rollback, role, capability, stale snapshot, validation, route).
- Existing Scheduling Task Review tests: 14 passed, 2 skipped; no failures.
- Full root/server suites and immutable freeze promotion are release prerequisites. Mock SQL is not evidence of live transaction validation.

## 8. Live operations
Only runtime health read. No SQL writes, production configuration edits, Firebase mutation, merge, permission enablement, deployment, or DOE writes.

## 9. Current state
Feature branch candidate. Draft PR intended for separate review and testing; not merged or deployed.

## 10. Blockers
- Independently review the candidate, validate actual SQL transaction on synthetic/staging fixtures (including mid-batch rollback, two concurrent edits, assignment changes, stale tokens, and DOE review results).
- Browser visual/interaction QA and role-scoped notification validation.
- Separate explicit reviewed governance promotion of immutable static/API anchor; do not bypass freeze checks.
- Confirm existing task-review SQL procedure execute permissions and stage test role denial, authorized transition, audit, and no side effects. Production gate remains false.

## 11. Breakpoint
Candidate code and focused tests in this branch. Current production is unchanged.

## 12. Next safe action
Review diff and full test reports; complete staging and governance review; authorize release separately. On deployment update runtime/recovery gate configuration consistently, with explicit PAWS_SESSION_BATCH_EDIT_ENABLED=true and PAWS_SCHEDULING_TASK_REVIEW_ENABLED=true only after applicable validation. Verify exact-main CI, live runtime identity/gates, protected static deployment, role access and rollback plan. Keep AFC CSV import deferred.


## 13. QA ownership and remaining implementation handoff (2026-11-25)

The user assigned coding to the coding agent and independent testing to Dot. Candidate follow-up clears login notifications across authentication changes, resets cached write capabilities before refreshing, and keeps closure records outside teaching-session counts. The runtime runbook describes the independent batch gate and rollback. No additional tests were run in this follow-up.

Dot should obtain the current PR head from PR #171, run full suites and report exact command, head, pass/fail/skip counts and reproduction steps. Validate browser views and role scope for closures/notifications, batch edits in isolated staging with synthetic records including concurrency and rollback, and existing Task Review permissions/audit. Return defects to the coding agent; do not change production data, enable live gates, promote frozen anchors, merge, or deploy without explicit approval.
