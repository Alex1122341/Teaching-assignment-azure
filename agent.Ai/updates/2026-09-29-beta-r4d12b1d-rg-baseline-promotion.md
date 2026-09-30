# BETA-R4D-12B1D-RG — Corrected API Baseline Promotion / PR Integration

**Date:** 2026-09-29
**Branch:** `feature/beta-r4d12b1d-r-afc-unfiltered-list`
**Superseded frozen baseline:** `68bda43a71034089a57d3369128e5dafd80f06eb`
**Promoted frozen baseline (corrected runtime):** `5a7f8a535caaf42992598c6fc8fe301818075e67`
**Origin/main before merge:** `c83faeb39ab637ba1fa17ca066c74004d8a9d620`
**Status:** B1D-R CORRECTED / BASELINE PROMOTED / PR-PENDING / NOT LIVE

## 1. Why this promotion exists

BETA-R4D-12B1D-R found a live defect: `GET /api/v1/dashboard/afc-records`
without filters returned **503 SQL_UNAVAILABLE** because `listAfcRecords()`
started from an empty `predicates` array and still emitted
`WHERE ${predicates.join(' AND ')}`, producing a bare `WHERE` clause. Filtered
variants were unaffected. The correction omits the `WHERE` clause entirely when
there are no predicates.

The frozen trust anchor `68bda43...` predates that correction, so the accepted
API runtime and the frozen anchor disagreed on exactly one protected blob. This
governance unit promotes the corrected runtime as the new single static/API
trust anchor.

## 2. Governance implementation

- Promoted `5a7f8a5...` as the single static/API freeze trust anchor.
- Updated `tools/beta-freeze.js` to BETA-R4D-12B1D-RG and the corrected SHA.
- Updated `tools/beta-baseline.json` `sourceCommit`. All nine recorded static
  `sha256` values are **unchanged**: they were re-derived from Git blobs at the
  corrected commit and proved byte-identical to the superseded anchor.
- Kept `tools/static-assets.json` unchanged at 46 protected paths.
- Updated `tests/beta-baseline.test.js` to the new baseline with the superseded
  anchor retained as the previous/historical reference.
- Added a durable anchor assertion proving the promoted API anchor carries the
  corrected unfiltered AFC list query (empty-predicate guard + `${whereClause}`
  interpolation, no bare `WHERE ${predicates.join(...)}` in the AFC statement).
- Added an assertion that the superseded anchor remains readable as history and
  is still an ancestor of HEAD.
- Updated `tests/azure-deployment.test.js` to the corrected baseline SHA.
- Updated the active static release evidence baseline in
  `.github/workflows/azure-beta-static-deploy.yml` without changing any
  deployment behavior, inputs, or gates.
- Updated active continuity documents. Historical B0/B1/B1R/B1R2 references
  remain historical and were not globally rewritten.

## 3. Governance boundary (proved, not asserted)

Exhaustive protected-set delta between `68bda43...` and `5a7f8a5...`:

- Static protected set: **46 paths, delta 0** (`STATIC_DELTA_EMPTY=true`).
- API protected set: **17 runtime files + `deploy/aca/Dockerfile`, delta 1** —
  exactly `server/src/data/sql-dashboard-repository.js`
  (`63969b6dba44...` -> `5d04fae09a45...`), which is the intended correction.
  `API_DELTA_ONLY_INTENDED_PATH=true`.

No SQL artifact, Dockerfile, business test, static runtime asset, or
`swa-api/` file is part of this governance commit.

## 4. Files / components changed

| Path | Change |
|---|---|
| `tools/beta-freeze.js` | `BASELINE_COMMIT` -> `5a7f8a5...`; comment retargeted to B1D-RG |
| `tools/beta-baseline.json` | `sourceCommit` -> `5a7f8a5...`; nine `sha256` values unchanged |
| `tests/beta-baseline.test.js` | New baseline + previous baseline; two new anchor/history tests |
| `tests/azure-deployment.test.js` | Pinned baseline SHA updated |
| `.github/workflows/azure-beta-static-deploy.yml` | Static deploy evidence `--arg baseline` updated |
| `agent.Ai/PROJECT_STATE.md`, `TASK_CHAIN.md`, `TEST_RELEASE.md` | Active continuity updated |
| `agent.Ai/updates/2026-09-29-beta-r4d12b1d-rg-baseline-promotion.md` | This record |

## 5. Architecture / invariants affected

No architecture change. One release-governance value changed: the immutable
trust anchor moved from the pre-correction runtime to the corrected runtime.
The shared static/API anchor invariant is preserved — `beta-api-freeze.js` still
imports `BASELINE_COMMIT` from `beta-freeze.js` and declares none of its own.

## 6. Data / algorithm changes

None. The corrected `listAfcRecords()` statement shape was already implemented
and accepted in B1D-R; this unit only changes which commit is the freeze
authority. No identity matching, normalization, session grouping,
authorization, workflow state, concurrency, DOE, AFC semantics, publication, or
migration logic was modified.

## 7. Tests / CI evidence

| Suite | Command | Result |
|---|---|---|
| Static freeze | `node tools/beta-freeze.js` | PASS — baseline `5a7f8a5...`, protected **46**, drift `[]` |
| Candidate verifier | `node tools/verify-beta-candidate.js` | PASS — static drift `[]`, API drift `[]` |
| Focused governance | `node --test tests/beta-baseline.test.js tests/beta-api-freeze.test.js tests/azure-deployment.test.js` | **40/40 pass** (was 38; +2 new) |
| Server suite | `node --test test/*.test.js` (in `server/`) | **148/148 pass** |
| Root Beta suite | `node --test tests/*.test.js` | **521 pass / 1 fail / 29 skipped** (551 total) |
| Negative control | anchor assertion vs superseded + corrected blobs | superseded **FAIL**, corrected **PASS** — `NEGATIVE_CONTROL_OK=true` |
| Diff hygiene | `git diff --check` | clean |

The single root failure is `tests/hosting-boundary.test.js:48` ->
`spawnSync pwsh.exe ENOENT`. This is the known **host-only** failure
(PowerShell 7 is not installed on this Windows host; only 5.1.2261.6133) and is
reproduced on the pristine baseline. It is not a product defect and is unrelated
to this unit.

Pre-promotion the same suites reported static PASS/46 and API FAIL with exactly
one drift path (`server/src/data/sql-dashboard-repository.js`) plus 518 pass /
2 fail on root. Post-promotion the API drift failure is resolved.

## 8. Live operations

### Performed

None.

### Explicitly NOT performed

- No ACR image build or publish.
- No ACA revision or image mutation.
- No SWA / static cutover.
- No SQL migration apply, permission apply, or live proof.
- No live AFC record creation.
- No Firestore, Firebase Auth, or Rules mutation.
- No Azure resource mutation.
- No deployment of any kind.
- No A2B, Work Queue, B2A, B2B, or DOE change.

## 9. Current state after task

- Final branch: `feature/beta-r4d12b1d-r-afc-unfiltered-list`
- Runtime/correction commit: `5a7f8a535caaf42992598c6fc8fe301818075e67`
- Frozen baseline after promotion: `5a7f8a535caaf42992598c6fc8fe301818075e67`
- Superseded baseline (historical): `68bda43a71034089a57d3369128e5dafd80f06eb`
- Integration: one PR to `main`, merge commit only; merge SHA and the
  exact-main push Build are recorded in the B1D-RG handoff report.
- Live state unchanged: SQL B1 live, API B1 live **with the unfiltered-list
  defect**, static B0 live.

## 10. Blockers / unresolved questions

None at this gate. The live API still carries the unfiltered AFC list defect
until the corrected image is published and redeployed, which is explicitly out
of scope here.

## 11. Exact current breakpoint

The governance commit is pushed on the feature branch. The next step is the PR
to `main`, a true merge commit, and the exact-main push Build. No image publish,
API redeploy, or static cutover occurs in this unit.

## 12. Next safe action

After the merge SHA is captured, run B1D-RD: ACR publish of the corrected digest
and ACA redeploy to the corrected image, then resume C10 authenticated
acceptance (`GET /api/v1/dashboard/afc-records?limit=2000` must answer 200) and
C11 static cutover.

## 13. DO NOT REDO

- Do not re-apply migration 007 or the permission contract.
- Do not re-run the least-privilege proof against live.
- Do not rebuild the B1D-R correction; it is committed and pushed.
- Do not re-promote the baseline to `68bda43...`; it is superseded.
- Do not deploy from this unit.

## 14. Suggested next-agent prompt

`PAWS BETA-R4D-12B1D-RD — ACR PUBLISH OF THE CORRECTED B1D-R DIGEST + ACA
REDEPLOY. Baseline is 5a7f8a535caaf42992598c6fc8fe301818075e67. Publish the
exact-main artifact digest for that merge, activate a new ACA revision by exact
digest, verify the unfiltered AFC list endpoint returns 200, then stop and
report. No static cutover, no SQL change.`
