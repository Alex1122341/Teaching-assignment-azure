# Agent Update — BETA-R4D-10B Stage 2 API client and Dashboard auth cutover

**Date:** 2026-09-28
**Agent/model:** Codex / GPT-5
**Repository:** `Alex1122341/Teaching-assignment-azure`
**Task status:** COMPLETE / AWAITING ARCHITECT REVIEW

## 1. Goal

Add the already-live read-only Dashboard API methods to the shared PAWS browser
data client and move only the Faculty Dashboard authorization/profile gate from
Firestore `users/{uid}` to `/api/v1/me`. Do not begin the Dashboard business-data
read cutover, baseline promotion, PR, merge, or deployment.

## 2. Starting breakpoint

- base branch: `main`
- base SHA: `db777d721ccff5665bc103fba89482a356dc0041`
- working branch: `feature/beta-r4d10b-dashboard-api-client-auth`
- starting SHA: `db777d721ccff5665bc103fba89482a356dc0041`
- PR: none
- relevant prior update: Stage 1 frontend cutover audit accepted by Architect
- live environment assumptions: R4D-10A3 backend acceptance is complete; no live
  acceptance or deployment is part of this stage

## 3. Work performed

- Added `dashboardSummary`, `dashboardFaculty`, and `dashboardFacultyById` to
  `paws-data-client.js`, reusing its existing token and GET request path.
- Loaded `paws-data-client.js` after Firebase libraries and before
  `faculty-admin.js`.
- Replaced the Dashboard auth profile lookup with
  `UCVM_PAWS_DATA.currentUser()`.
- Preserved password-change redirect, active-account checks, admin/self role
  routing, and server-provided FacultyId linkage.
- Added fail-closed 401, 403, 503, and network-error messages that preserve the
  Firebase login and never fall back to Firestore.
- Added the required redirect for the live API's 403
  `PASSWORD_CHANGE_REQUIRED` response; a behavioral callback test verifies the
  redirect occurs without Firestore lookup or signout.
- Added tests first, observed 12 expected RED failures, then implemented the
  minimum runtime changes and reached GREEN.

## 4. Files / components changed

- `paws-data-client.js` — three Dashboard GET methods.
- `faculty-admin.html` — data-client dependency load order.
- `faculty-admin.js` — API-backed authorization gate and failure messages.
- `tests/paws-data-client.test.js` — Dashboard request/response/error contracts.
- `tests/faculty-admin-api-auth.test.js` — focused Dashboard auth-cutover guards.
- `agent.Ai/PROJECT_STATE.md`, `agent.Ai/TASK_CHAIN.md`, and this update —
  documentation-only continuity records.

## 5. Architecture / invariants affected

Dashboard authorization now follows Firebase Auth → Firebase ID token → PAWS
API `/api/v1/me` → SQL UserProfile. The server remains authoritative for role
and FacultyId. There is no Firestore identity fallback and no browser-side SQL.
Stage 2 deliberately leaves existing Dashboard business-data Firestore reads
and writes unchanged for Stage 3.

## 6. Data / algorithm changes

Authorization/profile source changed only. No identity matching, DOE, AFC,
session grouping, schema, workflow state, or stored data changed. Self-service
uses only the `facultyId` returned by `/me`; no email matching is performed.

## 7. Tests / CI evidence

- Pre-change baseline: `npm test` → 387 tests, 356 pass, 2 fail, 29 skipped.
  Both failures were pre-existing faculty-swap source-contract failures.
- RED: `node --test tests/paws-data-client.test.js tests/faculty-admin-api-auth.test.js`
  → 3 pass, 12 expected failures because the Stage 2 methods/gate did not exist.
- Focused final: 61 tests, 61 pass, 0 fail.
- Full final: `npm test` → 400 tests, 367 pass, 4 fail, 29 skipped. Two failures
  are the expected frozen-baseline drift checks; the other two are the same
  pre-existing faculty-swap failures seen before any change.
- `node tools/beta-freeze.js` → expected failure naming only
  `faculty-admin.html`, `faculty-admin.js`, and `paws-data-client.js` as drift.
- `node --check` passed for both changed JavaScript runtime files.
- `node tools/build-static.js` built 45 files successfully.
- `git diff --check` passed (line-ending warnings only).

## 8. Live operations

### Performed

None.

### Explicitly NOT performed

- no SQL/API/backend changes;
- no Firebase or Firestore live reads/writes for acceptance;
- no ACA/SWA deployment;
- no baseline promotion;
- no PR, merge, or live credential use.

## 9. Current state after task

- final branch: `feature/beta-r4d10b-dashboard-api-client-auth`
- final SHA: the single Stage 2 commit containing this update
- PR: none
- merge/deploy state: unmerged and undeployed

## 10. Blockers / unresolved questions

No Stage 2 functional blocker. Architect review is required before Stage 3.
The repository-wide suite retains two unrelated pre-existing faculty-swap
failures. Frozen-baseline drift is expected and intentionally deferred to
Stage 4 governance promotion.

## 11. Exact current breakpoint

Stage 2 code and focused tests are complete on the dedicated branch. Dashboard
authorization is API/SQL-backed, while Dashboard business-data readers and
legacy mutation controls remain untouched and must not be deployed in this
intermediate state.

## 12. Next safe action

After Architect approval only, continue the same branch with BETA-R4D-10B
Stage 3: Dashboard UI API read cutover plus fail-closed legacy write controls.

## 13. DO NOT REDO

- do not reopen R4D-10A backend, SQL grants, ACA, or DTO work;
- do not add Firestore auth fallback;
- do not promote the frozen baseline before Stage 4;
- do not deploy or create a PR during Stage 2;
- do not start Stage 3 without Architect approval.
