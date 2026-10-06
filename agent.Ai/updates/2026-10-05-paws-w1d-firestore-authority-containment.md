# Agent Update — PAWS P0 W1D Firestore Authority Containment

**Date:** 2026-10-05
**Agent/model:** Codex execution agent
**Repository:** `Alex1122341/Teaching-assignment-azure`
**Task status:** COMPLETE / READY FOR ARCHITECT REVIEW

## 1. Goal

Remove the normal Beta browser's direct Firestore mutation authority for SQL-canonical timetable, AFC, Faculty and DOE business data, independently of maintenance metadata, while retaining established Firestore-only identity, group and public-information functions.

## 2. Starting breakpoint

- base branch: `feature/beta-w1c-write-containment`
- base SHA: `916a90cc2e3e9f55c01e26ace6a14f21c7d2cca9`
- working branch: `feature/beta-w1d-firestore-authority-containment`
- starting SHA: `916a90cc2e3e9f55c01e26ace6a14f21c7d2cca9`
- PR: none (not authorized)
- relevant prior update: W1C accepted implementation `08633276663b71d7a6fc995e9be2d20c7cba4065`
- live assumptions: W1D rules are local only; live authority/identity findings below are inherited from prior read-only evidence and were not reverified in this task.

## 3. Work performed

### Code and documents

- Added unconditional Firestore write denials for canonical `sessions`, `session_change_log`, `faculty`, `faculty_change_log`, AFC request/artifact/audit paths, SQL audit, and derived settings paths; canonical denial does not consult `settings/system_state` or `teachingDataWriteLocked`.
- Replaced timetable edit/swap/bulk/delete browser writers with API-required fail-closed behavior, removed the dead derived-index writer consumer, and retained the independent default-off SQL session-edit gate.
- Disabled the Firestore approval loader and AFC fallback/decision writers; removed obsolete writer script tags and the shared-page dynamic loader that could reintroduce the legacy modules.
- Removed the User Management Faculty Report-To Firestore mutation and fail-closed DOE role cleanup, while retaining scoped user/group/account-audit capabilities. Firebase user roles versus SQL `UserProfile.BaseRole` remains an Architect decision.
- Added W1D static and Firestore emulator authority tests; updated legacy tests to the accepted deny/retain contract without changing immutable freeze checks.
- Added the authority matrix at `docs/superpowers/specs/2026-10-05-paws-w1d-firestore-authority-matrix.md`, the implementation plan, and continuity records.
- Independent read-only review found no Critical/Important defects and one Minor matrix description error about the AFC Firestore read path; corrected the matrix to state the Beta Firestore view is unavailable while scoped rule reads remain.
- Used the available SDD workspace/brief/review-package tools and recorded the ledger in ignored `.superpowers/sdd/2026-10-05-paws-w1d-firestore-authority-containment/progress.md`; task-start/task-done scripts were unavailable in the installed skill package.

### Analysis / live operations

- Local source and rule analysis only. No live database reads were made for W1D.
- No live writes, configuration, permissions, services, rules, secrets, deployment, merge, PR, or main changes were performed.

## 4. Files / components changed

See the branch diff and authority matrix. Principal runtime changes are `firestore.rules`, `timetable.js`, `approval-workflow.js`, `afc-workflow.js`, `afc-actions.js`, `asset-loader.js`, `faculty-access.js`, `index.html`, `user-management.js` and `user-management.html`. Tests, the plan, matrix and continuity files are included in the branch.

## 5. Architecture / invariants affected

- Preserved the accepted architecture: Firebase Authentication → trusted PAWS University API → server-side authorization → narrow procedures → VetMed-Ops.
- W1D is authority containment only. It does not activate W1C writes or change canonical database state.
- Canonical Firestore write rules are deny-by-default and independent of maintenance-lock presence/value.
- Kept user/group scope separate. Firebase `users.role` / `facultyRoles` may overlap SQL `UserProfile.BaseRole`; no ownership mapping was invented. Architect #6 decision remains required.

## 6. Data / algorithm changes

- No identity, schedule, DOE, AFC, publication, migration, or live data changes.
- Browser timetable mutation and derived-index refresh operations now fail closed with API-required messages.
- Firestore remains the current separate store for Firebase user/group management, append-only account audit and bounded information-center announcements, subject to the existing rules.

## 7. Tests / CI evidence

All commands ran locally on Node `v24.19.0` (the server package declares Node 22.x; `npm ci` warned about this engine mismatch).

- `npm run test:emulator`: **770 total / 765 pass / 5 fail / 0 skipped**. All Firestore emulator assertions ran. The only failures were the same five immutable static/API freeze checks listed below; no W1D behavior test failed.
- `npm test`: **770 total / 733 pass / 5 fail / 32 skipped**. All five failures are strict frozen-runtime drift checks; skipped tests are emulator-only cases without the emulator environment in this invocation.
- W1D/AFC/maintenance/scheduling focused group: **28/28 pass**; W1D source-contract file's five assertions pass in that group.
- Server `npm test`: **318/318 pass** after `npm ci` from the committed lockfile.
- `node --check` passed for all changed JavaScript runtime/test files.
- `git diff --check` passed; Git emitted only LF-to-CRLF working-copy notices.
- `node tools/verify-beta-candidate.js` failed closed as expected: **52/52 static files checked, 11 static content-drift entries**; **37/37 API files checked, 4 API drift entries** (`server/src/data/dashboard-api.js`, `server/src/data/data-api.js`, `server/src/data/write-gates.js` absent at the frozen anchor, `server/src/runtime/swa-sql-runtime.js`). The root suite's five freeze failures are not waived. No freeze test/baseline was changed.
- No hosted CI was run or claimed.

## 8. Live operations

### Performed

- None. No W1D live reads or mutations.

### Explicitly NOT performed

- No production Firestore writes or live rule/configuration change.
- No Firebase mutation, Azure/VetMed-Ops/SQL mutation, migration 016 execution, W1C enablement, service/configuration/permission change, deployment, PR, merge, or main advance.

## 9. Current state after task

- final branch: `feature/beta-w1d-firestore-authority-containment`
- base/start SHA: `916a90cc2e3e9f55c01e26ace6a14f21c7d2cca9`
- final commit SHA / push status: recorded in the Architect #6 handoff and Git metadata after the final review; no PR created.
- merge/deploy/rules-publish state: none.

## 10. Blockers / unresolved questions

- Live rules remain unchanged; therefore W1D has not closed the production Firestore bypass yet. Rules publication is out of scope.
- Existing University SQL runtime principal `UC\\sa-xinyu.zhu1` remains previously evidenced as `db_owner` / `CONTROL DATABASE`; least privilege is **NO** and W1D does not modify it.
- Runtime exact-main attestation: **NO** (not reverified). AFC release run `37366171691`: **not complete / not reverified**.
- Firestore Firebase role fields versus SQL `UserProfile.BaseRole` ownership requires Architect #6 decision.
- Five freeze failures remain exactly as reported; freeze gates/baselines were intentionally left strict.

## 11. Exact current breakpoint

The reviewed local W1D candidate is on `feature/beta-w1d-firestore-authority-containment`, based on W1C `916a90cc2e3e9f55c01e26ace6a14f21c7d2cca9`. It contains the branch changes and evidence matrix; five immutable static/API freeze checks report drift and are not weakened. The branch commit/push SHA is reported directly to Architect #6. No rules are published and no live write authority is activated.

## 12. Next safe action

Architect #6 should review the feature-branch commit, matrix and five freeze failures, decide the Firebase-user/SQL-BaseRole authority boundary, and separately direct any future rules publication or least-privilege work.

## 13. DO NOT REDO

- Do not run database migration 016 or enable W1C gates.
- Do not publish/deploy these Firestore rules or alter live maintenance state.
- Do not relax or promote the frozen baseline tests as part of W1D.
- Do not infer the Firebase user-role/SQL BaseRole mapping.
- Do not claim live W1D acceptance, runtime exact-main attestation, least privilege, AFC release completion, hosted CI or deployment.

## 14. Suggested next-agent prompt

Review the pushed `feature/beta-w1d-firestore-authority-containment` commit and its path-by-path matrix. Assess the five strict freeze failures and decide the unresolved Firebase-user role boundary. Do not publish rules, activate W1C, mutate production, merge, or deploy unless separately authorized.
