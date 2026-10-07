# Agent Update — P3 all-status Faculty roster hotfix

**Date:** 2026-10-07  
**Agent/model:** Codex  
**Repository:** Alex1122341/Teaching-assignment-azure  
**Task status:** PARTIAL

## 1. Goal

Fix the empty `WHERE` emitted by the administrator `status=all` Faculty roster with no optional filters, advance the protected runtime trust anchor through the reviewed freeze process, then release and verify the narrow P3 hotfix. Do not start P4.

## 2. Starting breakpoint

- Base branch: `main`
- Base SHA: `436d9a5e79bb1ce62997902ebe665fb1ae14318b`
- Working branch: `fix/p3-faculty-all-roster`
- Starting SHA: `436d9a5e79bb1ce62997902ebe665fb1ae14318b`
- PR: none yet
- Relevant prior update: `2026-10-07-p3-profileversion-hotfix-governance.md`
- Live assumptions: Existing release remains `436d9a5e79bb1ce62997902ebe665fb1ae14318b`, trust anchor `576fff9687417a97fe635cbb4e523f41ade74e4a`; fixture `7AE9027A-BFD3-4795-B79F-8621E351C291` remains inactive; expected counts 120 active / 1 inactive.

## 3. Work performed

- Added regression tests first; they failed on the exact empty-WHERE condition before the fix.
- Added an optional `whereClause` following the existing AFC query pattern; expanded SQL and API status tests.
- Created functional commit `d6b433f3b7f5bb62400deedba537e47b970b34d2`.
- Advanced freeze authority and current-anchor assertions to that functional commit in a separate governance commit after the functional commit.
- Static asset hashes and shipped bytes remain unchanged.
- No live reads/writes or deployments in this checkpoint.

## 4. Files / components changed

- `server/src/data/sql-dashboard-repository.js`: omit WHERE when predicate list is empty.
- `server/test/dashboard-api-r4d10a2.test.js`, `server/test/dashboard-api.test.js`: all filter combinations and authorization/invalid-status coverage.
- `tools/beta-freeze.js`, `tools/beta-baseline.json`: reviewed trust-anchor advance.
- `tests/beta-baseline.test.js`, `tests/azure-deployment.test.js`: current-anchor assertions.
- `agent.Ai/PROJECT_STATE.md`, `agent.Ai/TASK_CHAIN.md`, this update: continuity checkpoint.

## 5. Architecture / invariants affected

The existing SQL-authoritative API, access controls, and protected-file freeze remain in place. The frozen runtime anchor advances to the functional commit through governance. No infrastructure or business invariant changed.

## 6. Data / algorithm changes

No SQL schema, stored procedure, migration, Faculty record, authorization, P1/P2, DOE, Teaching Assignment, or AFC business logic changed. No data mutation.

## 7. Tests / CI evidence

- Red-before-fix: focused roster/API tests failed only on the unfiltered all-status SQL.
- Focused roster/API: `node --test server/test/dashboard-api-r4d10a2.test.js server/test/dashboard-api.test.js` — 75/75 pass.
- P3-focused: `node --test test/*faculty*test.js test/*p3*test.js` from `server` — 89/89 pass.
- Server: `npm test` from `server` — 398/398 pass.
- Root: `npm test` — 782 total, 750 pass, 32 skipped, 0 fail.
- Freeze/governance focused: `node --test tests/beta-baseline.test.js tests/azure-deployment.test.js` — 50/50 pass.
- `node tools/build-beta-release.js`; candidate verifier and static/API repository and artifact freezes pass with zero drift. Static build: 56 files / 1,835,569 bytes.
- `git diff --check` passes. `gitleaks` is unavailable; added-diff secret-pattern scan passed. Hosted CI has not run.

## 8. Live operations

### Performed

None.

### Explicitly NOT performed

No SQL writes, fixture mutation, migration, deployment, merge, Firebase Hosting deployment, or ACR/ACA action.

## 9. Current state after task

- Final branch: `fix/p3-faculty-all-roster`
- Functional SHA: `d6b433f3b7f5bb62400deedba537e47b970b34d2`
- Governance SHA: separate current branch HEAD; verify with `git log -2`.
- PR: none yet
- Merge/deploy: not performed
- Live fixture remains assumed inactive; counts not re-read.

## 10. Blockers / unresolved questions

None identified locally. Push/PR, hosted CI, merge, exact-main artifact, runtime deployment, and live acceptance remain.

## 11. Exact current breakpoint

The current branch has two commits: the functional hotfix and a separate freeze-anchor promotion, including current-anchor tests and continuity updates. Root tests and added-diff secret scan pass. No PR or external release action has occurred.

## 12. Next safe action

Push the branch and open one narrow PR. Continue only through A6's CI, exact-main artifact, University API deployment, and read-only acceptance instructions.

## 13. DO NOT REDO

Do not rerun migrations 023/024, create/change/delete/restore the fixture, repeat the prior P3 mutation lifecycle, use ACR/ACA, deploy Hosting if static bytes remain unchanged, or start P4.

## 14. Suggested next-agent prompt

Continue Architect #6's approved P3 all-status Faculty roster hotfix from `fix/p3-faculty-all-roster`. Preserve functional commit `d6b433f3…` and a separate governance commit. Finish secret scan and local checks, push/open one PR, require hosted CI, merge without squash, require exact-main CI/artifact, deploy the API to the specified University runtime, and perform read-only roster/P1/P2 acceptance. Do not mutate the fixture or begin P4.
