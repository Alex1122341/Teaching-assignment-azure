# Agent Update — Role & Appointment period version compatibility

**Date:** 2026-10-23
**Agent/model:** GPT-6
**Repository:** Alex1122341/Teaching-assignment-azure
**Task status:** PRODUCT COMMITTED; GOVERNANCE / PR REVIEW

## 1. Goal
Repair the Role & Appointment active-period edit error “Reload this appointment before editing.” without weakening the current optimistic concurrency/version lock.

## 2. Starting breakpoint
- Base: `main` at `9734d2d9ba6cd927dbec3585838689f235ed0e9f`.
- Branch: `fix/role-appointment-period-version-20261023`.
- Product commit: `4c23f7f1d096437c4fcc020556cb1f0253701ecb`.
- Previous immutable static/API freeze: `5a3117d4aec48b685e734651f4caa24d9050ba4f`.
- PR: created after governance promotion, see branch/remote for authoritative number.
- Live state: prior accepted PR132/133 published; **no current role-version request payload from production was accessed**.

## 3. Analysis and changes
- Exact error from `server/src/data/dashboard-api.js`: HTTP 400 INVALID_ROLE_VERSION before SQL.
- SQL stale conflict remains distinct: HTTP 409 STALE_ROLE_PERIODS from stored procedure error 53509.
- Browser formerly forwarded `current.scheduleVersion` without verifying shape.
- Server formerly required precisely `0x` + 16 hex characters.
- Product now canonicalizes strict SQL rowversion formats (prefixed/unprefixed hex or JSON Buffer of 8 bytes) on both ends; malformed non-null tokens fail closed and are never replaced with null.
- Source explanation and verification boundaries: `docs/role-period-version-fix-20261023.md`.

## 4. Scope / invariants
- Product changes: `frontend/scripts/faculty-role-periods.js`, `server/src/data/dashboard-api.js`.
- Product tests: `tests/role-period-version.test.js`, `server/test/role-period-version.test.js`.
- Governance source: `tests/role-period-version-freeze-governance.test.js`.
- No SQL schema, stored procedure, DB data, write gate, permission, DOE, audit, Firebase configuration or deployment changes.
- Protected static and API freeze both promoted via separate governance commit referencing exact accepted product SHA, never via drift exceptions.

## 5. Test evidence
- RED first: 11 test cases, 5 expected failures for malformed/unprefixed/Buffer handling.
- GREEN after fix: 11/11 pass.
- Adjacent server/frontend/API suite: 113/113 pass.
- Governance test RED against old anchor as intended; separate governance verification in progress.
- Exact-HEAD full CI is required before any merge/release claim.

## 6. Live operations
- No SQL reads or writes against production, no API deployment, no Firebase deploy, no merge.
- Current user-facing issue is **not verified resolved live**; the exact malformed production token format was not available.
- For live acceptance after a separately approved coordinated API + Hosting release: revisit original Appointment; save new dates; confirm persistence and no DOE change; verify stale version still 409.

## 7. Current breakpoint and next safe action
Finish governance verification/commit, push branch, create a new PR against currently accepted main, inspect full GitHub CI, review the changed-file list and test exact PR head. Do not merge or deploy implicitly and do not copy this fix into the unrelated PR125.

## CI gate correction — 2026-10-23

Initial exact-PR-head Azure Beta Build run 40021261223 failed at root `npm test` (1025 pass, 5 fail, 52 skip): four historical `tests/beta-baseline.test.js` assertions and one `tests/person-name-governance.test.js` assertion still pinned the active freeze to the previous Person Name product (`5a3117d4`). There were no Role Period behavior test failures. The fix updates the *active* baseline reference to reviewed product `4c23f7f`, while explicitly preserving the historic Person Name product and its accepted-main Git evidence. No runtime bytes, scope, SQL, DOE or gates changed in this follow-up test-only correction. A targeted rerun of the previous five failure cases plus one related historical case passed 6/6. Updated exact-HEAD full CI remains required.
