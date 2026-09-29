# Agent Update — BETA-R4D-12B1 AFC foundation

**Date:** 2026-09-29  
**Agent/model:** Codex  
**Repository:** Alex1122341/Teaching-assignment  
**Task status:** PARTIAL — IMPLEMENTED / PENDING ARCHITECT REVIEW / NOT LIVE

## 1. Goal

Implement the B1 isolated Azure SQL AFC manual-create foundation: unified
imported/manual reads, administrator-only GET/POST Dashboard API, dedicated
stored-procedure write boundary, and administrator-only AFC Records UI.

## 2. Starting breakpoint

- base branch: `origin/main`
- base SHA: `68cd57074bbcf7916da6a031a238175d5530ae0b`
- working branch: `feature/beta-r4d12b1-afc-dashboard-write-foundation`
- starting SHA: `68cd57074bbcf7916da6a031a238175d5530ae0b`
- PR: none
- relevant prior update: B0D static-only release / B0 LIVE ACCEPTED / CLOSED
- live environment assumptions: frozen baseline `b3458f79a05353ce1255874754e1c6c1ec8ee683`; 005/006 unapplied; B1 is proposal/code only.

## 3. Work performed

### Code/docs

- Added migration 007 manual AFC table, unified view, static procedure, forward
  permission proposal, and least-privilege proof proposal.
- Added a dedicated SQL AFC write repository that invokes only the exact
  `paws_api.CreateAfcRecord` procedure.
- Added bounded unified AFC reads to summary, roster, faculty detail, and the
  administrator list API.
- Added administrator-only GET/POST AFC API handling and safe validation/error
  mapping; existing Dashboard routes remain GET-only.
- Added explicit client methods and administrator-only AFC Records tab/form,
  canonical FacultyId selection, filters, validation, and double-submit guard.
- Added focused B1 tests and updated existing contract tests for the intentional
  unified AFC source and current runtime-file count.
- Updated `PROJECT_STATE.md` and `TASK_CHAIN.md` at the new B1 breakpoint.

### Live reads / writes

- No live Azure, SQL, Firestore, Firebase Auth, Firebase Rules, ACR, ACA, SWA,
  GitHub PR, or deployment mutation was performed.

## 4. Files / components changed

- `database/azure-sql/007_afc_manual_write_foundation.sql`
- `database/azure-sql/007_afc_manual_write_permissions.sql`
- `database/azure-sql/007_afc_manual_write_least_privilege_proof.sql`
- `server/src/data/sql-afc-write-repository.js`
- `server/src/data/sql-dashboard-repository.js`
- `server/src/data/dashboard-api.js`
- `server/src/runtime/swa-dashboard-functions.js`
- `server/src/runtime/swa-sql-runtime.js`
- `swa-api/index.js`
- `paws-data-client.js`
- `faculty-admin.html`
- `faculty-admin.js`
- `server/test/b1-afc-foundation.test.js`
- `tests/b1-afc-dashboard-ui.test.js`
- related AFC/freeze regression tests and continuity files.

## 5. Architecture / invariants affected

The existing Firebase Auth → PAWS API/ACA → Azure SQL architecture and role
matrix are preserved. B1 intentionally introduces the first narrow writable
business domain, but only through a trusted stored procedure and existing
`paws.AuditEvent`; no timetable, authority, DOE, Firestore, or session-write
invariant changes.

## 6. Data / algorithm changes

Manual AFC rows are separate from imported `paws.AfcRecord` rows. The unified
view preserves one row per source record, controlled reason codes, legacy
Purpose, source kind, and audit metadata at the SQL read layer. API DTOs do
not expose Firebase UID, RequestId, audit internals, or SQL provenance.

## 7. Tests / CI evidence

- `node --test server/test/b1-afc-foundation.test.js tests/b1-afc-dashboard-ui.test.js tests/paws-data-client.test.js`: 20/20 pass.
- `npm test --prefix server`: 135/135 pass.
- `npm test`: 517 pass, 3 expected frozen-baseline drift failures, 29 skipped.
- `npm run test:emulator`: 546 pass, 3 expected frozen-baseline drift failures, 29 skipped.
- `node --check` on changed JavaScript: pass.
- `git diff --check`: pass.
- `node tools/beta-freeze.js`: expected fail with static drift only:
  `faculty-admin.html`, `faculty-admin.js`, `paws-data-client.js`.
- `node tools/beta-api-freeze.js`: expected fail with B1 drift:
  `server/src/data/dashboard-api.js`,
  `server/src/data/sql-afc-write-repository.js` (missing at baseline),
  `server/src/data/sql-dashboard-repository.js`,
  `server/src/runtime/swa-dashboard-functions.js`,
  `server/src/runtime/swa-sql-runtime.js`, `swa-api/index.js`.

## 8. Live operations

### Performed

None.

### Explicitly NOT performed

No SQL migration or permission apply; no live AFC row; no Firestore write or
delete; no Firebase Auth/Rules change; no ACR publish; no ACA or SWA deploy; no
PR or merge; no baseline promotion; no A2B, Work Queue, B2A, B2B, or DOE work.

## 9. Current state after task

- final branch: `feature/beta-r4d12b1-afc-dashboard-write-foundation`
- final implementation SHA: `7da1eff243464995f9fab58dc56af4378779ba90`
- PR: not opened
- merge/deploy state: not merged / not deployed / not live
- live counts/state: not reverified or mutated by B1.

## 10. Blockers / unresolved questions

No implementation blocker. Architect review is required before B1G. Frozen
baseline checks intentionally fail on the B1 runtime drift and must not be
weakened or promoted in this phase.

## 11. Exact current breakpoint

All B1 implementation and verification work is complete. The implementation
commit `7da1eff243464995f9fab58dc56af4378779ba90` is pushed to the exact
feature branch. The next action is to send the A–M B1 report to the architect
and stop pending B1 review.

## 12. Next safe action

Send the final architect report after confirming the branch is clean and the
remote branch points to the implementation commit. Do not open a PR or
apply/deploy anything.

## 13. DO NOT REDO

Do not rerun or alter the frozen baseline, do not apply migration 007 or its
permissions, do not create live AFC data, do not deploy, and do not start B1G,
B1D, B2A, B2B, A2B, Work Queue, or DOE work.

## 14. Suggested next-agent prompt

Review the B1 implementation branch against the architect B1 checklist and
choose B1-PASS, B1R, B1-SPLIT, or B1-SECURITY-FIX. Preserve the no-live-mutation
boundary until the explicit integration/deployment gates.
