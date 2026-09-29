# BETA-R4D-12B1R2 — Exact AFC SQL Permission Contract Correction

**Date:** 2026-09-29
**Branch:** `feature/beta-r4d12b1-afc-dashboard-write-foundation`
**Starting B1R2 HEAD:** `b38afabeba683f728e751cfca0bfd144e471d5ee`
**Status:** B1R2 CORRECTED / PENDING ARCHITECT FINAL REVIEW / NOT LIVE

## Implementation result

- Replaced the permissive 007 permission preflight with a normalized,
  fail-closed allowlist covering database, schema, whole-object, and
  column-scoped rows.
- Represented the reviewed R4D-10A/10A2 read contract exactly: whole-object
  SELECT only for `paws.vCalendarSession` and `paws.vAfcRecordUnified`; all
  other reads are exact reviewed columns.
- Preserved the four `paws` mutation DENYs and five `staging` DENYs as exact
  contract rows.
- Supported exactly two valid preflight states: the existing pre-B1 contract
  and the idempotent contract with the two B1 grants already present.
- Added exact post-transaction verification; success is impossible if the
  resulting permission set has an unexpected or missing row.
- Preserved principal, role, database-owner, schema-owner, object-owner,
  public-broadening, and dbo ownership-chain guards.
- Kept the only new grants as object-level `SELECT` on
  `paws.vAfcRecordUnified` and object-level `EXECUTE` on
  `paws_api.CreateAfcRecord`, both without grant option.
- Made the least-privilege proof use the same semantic post-state and remain
  non-mutating.
- Added `server/test/fixtures/b1r2-permission-contract.js` and
  `server/test/b1-afc-permission-contract.test.js` with deterministic valid
  and invalid normalized fixtures, including the class=1/class=3 regression
  and public broadening checks.

## Evidence

- B1R2 focused tests: 5/5 pass.
- Combined B1/B1R/B1R2/UI/client tests: 30/30 pass.
- Full server suite: 145/145 pass.
- Root Beta suite: 549 total, 546 pass, 3 expected frozen-baseline drift
  failures, zero behavioral failures.
- Emulator suite: same expected three baseline drift failures, zero behavioral
  failures; Firestore `PERMISSION_DENIED` logs are expected rules-test evidence.
- Static freeze: expected drift only in `faculty-admin.html`,
  `faculty-admin.js`, and `paws-data-client.js`.
- API freeze: same six intentional B1 runtime drifts:
  `server/src/data/dashboard-api.js`,
  `server/src/data/sql-afc-write-repository.js` missing at baseline,
  `server/src/data/sql-dashboard-repository.js`,
  `server/src/runtime/swa-dashboard-functions.js`,
  `server/src/runtime/swa-sql-runtime.js`, and `swa-api/index.js`.
- `git diff --check` and changed-test `node --check`: pass.
- `beta-baseline.json`, static manifest, and frozen baseline were not changed.
- Migration 007, permission apply, live proof, live AFC/SQL writes, grants,
  Firestore/Firebase/Auth/Rules changes, Azure mutations, deployments, PR,
  baseline promotion, A2B, Work Queue, B2A, B2B, and DOE changes: none.

## Handoff

Commit and push on the same branch. Do not open a PR, apply SQL, deploy, or
begin B2A. Remain queued for B1G, B1D, B2A, B2B, B3, and DOE pending final
architect review.
