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


## 14. Dot round-one QA follow-up (2026-11-25)

Dot tested adcc656c0a2c42cea949e1e1cb805f79e0644ec4 against main 35c2c608fb2010d359555ab37350b12325cfa2a9 and reported API 22/22, focused frontend 106/110, Calendar 46/49 vs main 49/49. Full PR merge-ref CI: 1,332 pass, 64 fail, 55 skipped, with later checks blocked (https://github.com/Alex1122341/Teaching-assignment-azure/actions/runs/45642913679/job/139306083107).

Coding response:
- Apply the same snapshot eligibility guard to both delegated and fallback Calendar selection controllers, including visual unavailable state and aria-disabled; preserve normal detail viewing and allow deselection of an already-selected stale row.
- Repair the two outdated synthetic fixtures, add explicit positive/negative selection cases for both controller paths, update Check Needed/Grid Ready contract assertions for the separate closure counts.
- Update current candidate static inventory assertions from 96 to 97, explicitly requiring the added asset. Do not alter immutable accepted anchor, historic receipt counts, or byte verification. Freeze drift remains a release blocker requiring a separate reviewed governance promotion.

Environment read-only checks:
- Draft isolated origin https://paws-testing-ucvm-20261022.web.app returned HTTP 404; no candidate preview is available there. No listener on isolated draft API port 18788 or prior stage port 18789.
- Existing preparation receipt PREPARED_NOT_READY; previous database creation receipt SQL_REJECTED. TLS-validated SQL metadata read using configured FQDN found VetMed-Ops-Testing missing or not visible to the current operator. No database provisioned, no seed or credential operations, no production changes.
- Planned independent test roles: developer, adfa_general, adfa_regular, faculty, hicc, visc, adc, lab. No usable isolated login accounts confirmed. Do not substitute production accounts or the separate Testing repository.

Dot may rerun automated checks on the new exact PR head. Manual authenticated/browser and real SQL acceptance remain BLOCKED until independent preview, dedicated test identities, and verified synthetic database/API are provisioned. No test executed by coding agent in this follow-up. Keep Draft; no merge, deployment, live gate activation, or freeze promotion.


## 15. Dot round-two QA follow-up (2026-11-25)

Dot reported candidate 54b884be3a832588fdf8f82b8ca8fc693b36cdd2: Calendar 50/50, frontend 110/111 (one stale 96-asset assertion in runtime-assets.test.js), API 22/22 using simulated SQL. Full exact-head CI, real authenticated browser QA and real SQL acceptance are outstanding. The coding follow-up corrects the current manifest count in runtime-assets.test.js and office-workspace-wiring.test.js, explicitly checks the new asset, and checks script load order. Historical freeze receipts, immutable anchors and actual byte comparisons remain unchanged. No tests executed by the coding agent.

Remote inspection before the fix: refs/heads/feat/testing-pass-parity-20261125 pointed to 54b884b; refs/pull/171/head and GitHub PR metadata still pointed to adcc656. Do not use stale PR CI as evidence for the new commit. Confirm exact head/merge ref and CI identity independently.


## 16. Dot round-three follow-up (2026-11-25)

Dot reported exact PR head 829d9dddc7c873b216b5d2c3a41adf21a5bffa38: frontend 121/121 and API 22/22 simulated. Full merge-ref CI e3f6612cac3ce33da9f0caeff44b6d75e8d0b130: 1,339 pass, 58 fail, 55 skip; reported remaining failures are freeze/release governance. See https://github.com/Alex1122341/Teaching-assignment-azure/actions/runs/45649984124/job/139331542422 . Re-fetch current candidate before interpreting new evidence.

New independent QA workflow: .github/workflows/session-batch-edit-sql.yml uses the exact PR HEAD and an ephemeral pinned SQL Server container bound to loopback only; no production credentials or University SQL endpoints. Tools/test-session-batch-edit-sql.ps1 and .js exercise the existing production connection adapter and repository against actual procedures in a scoped synthetic schema, including transactional rollback, audit, assignment changes, stale batch and concurrent writes, with fixture-only narrow read and execute grants. Existing Task Review SQL acceptance and race scripts run independently of the main release freeze. Dot owns execution and verification; this workflow does not establish University Staging, Firebase login, production grants, DOE post-commit acceptance, full migration parity, or deployed browser QA. No new test run performed manually by coding agent.

Freeze promotion proposal scope: currently accepted anchor c50fc52ddee859b6f6c68338977b8cd09189de33; proposed runtime product 829d9dddc7c873b216b5d2c3a41adf21a5bffa38 (no shipped runtime changes in this QA follow-up). Static count 96 -> 97, changed existing index.html, calendar-search.js, paws-data-client.js, timetable.js, timetable.css; added calendar-tested-features.js. Seven changed API source files: server/src/afc/afc-request-api.js, server/src/data/data-api.js, sql-session-repository.js, write-gates.js, server/src/runtime/swa-functions.js, swa-sql-runtime.js, university-http-server.js. No database migration, dependency/package, build definition, or static asset removal. Review exact immutable diff; formal approval and separately reviewed governance commit required before moving the shared anchor, regenerating the documentation hashes, and updating current-governance assertions. Retain historical pinned evidence and union/byte checks. No anchor change here.

University isolated preview and SQL remain blocked; do not substitute production accounts or deploy an unreviewed artifact.
