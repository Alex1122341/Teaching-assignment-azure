# Agent Update — BETA-R4D-12B1R AFC security and data-integrity corrections

**Date:** 2026-09-29  
**Repository:** Alex1122341/Teaching-assignment-azure  
**Status:** B1R CORRECTED / PENDING ARCHITECT FINAL REVIEW / NOT LIVE

## Authority and breakpoint

- Same branch: `feature/beta-r4d12b1-afc-dashboard-write-foundation`.
- Starting B1R HEAD: `59632a1f6c04650fabc177bbb1687ebb904a203f`.
- `origin/main`, merge base, and verified main SHA remain
  `68cd57074bbcf7916da6a031a238175d5530ae0b`.
- Frozen baseline remains `b3458f79a05353ce1255874754e1c6c1ec8ee683`.
- B0 remains LIVE ACCEPTED / CLOSED. No new branch was created.

Architect3 accepted the B1 architecture without redesign and issued targeted
corrections before B1G: exact case-sensitive SQL ReasonCode handling, wider
procedure validation inputs, fail-closed ownership proof, hardened permission
preflight/least-privilege proof, complete inactive-Faculty history, and removal
of the post-commit response read dependency.

## B1R changes

- `007_afc_manual_write_foundation.sql`
  - guards both `paws` and `paws_api` schema ownership as `dbo`;
  - uses `Latin1_General_100_BIN2` for the table check and procedure validation;
  - trims but never lowercases ReasonCode;
  - widens procedure inputs to `@ReasonCode nvarchar(128)` and `@Notes nvarchar(max)`;
  - validates 1000/1001-character Notes before storage conversion;
  - resolves active Faculty and captures DisplayName inside the write transaction;
  - returns the created DTO from captured variables after COMMIT, with no
    post-commit read from the unified view, manual table, or Faculty table.
- `007_afc_manual_write_permissions.sql`
  - verifies runtime principal, database owner, role membership, schema/object
    ownership, database/schema/object grants, public broadening, staging DENYs,
    paws DENYs, object existence, and ownership chain before either B1 GRANT;
  - applies only unified-view SELECT and exact procedure EXECUTE, with no
    grant-option widening.
- `007_afc_manual_write_least_privilege_proof.sql`
  - removes the incorrect `owning_principal_id` assumption;
  - proves runtime ownership through `sys.schemas.principal_id` and
    `sys.objects.principal_id`;
  - proves both schema owners and effective procedure/target-object ownership;
  - rejects unexpected database/schema/object mutation or EXECUTE grants,
    public broadening, direct manual-table access, roles, and staging access;
  - requires the exact B1 post-state and prints
    `LEAST_PRIVILEGE_WRITE_PROOF_OK`.
- `server/src/data/sql-dashboard-repository.js`
  - keeps `listAfcRecords()` bounded and Faculty-joined but removes the
    `Faculty.Active = 1` predicate so valid AFC history remains visible for
    inactive Faculty; creation still requires active Faculty in SQL.
- `server/test/b1-afc-foundation.test.js`
  - adds exact ReasonCode, input-width, ownership, permission-preflight,
    inactive-history, active-create, and post-commit-response contract tests.

## Verification

- Focused B1/B1R/UI/client tests: **25/25 pass**.
- `npm test --prefix server`: **140/140 pass**.
- Root `npm test`: **549 total; 517 pass; 3 expected frozen-baseline drift
  failures; 29 skipped**.
- `npm run test:emulator`: **549 total; 546 pass; 3 expected frozen-baseline
  drift failures; 0 skipped**. Firestore permission-denied log lines are the
  expected rules-test evidence.
- Changed JavaScript `node --check`: pass.
- `git diff --check`: pass.
- `node tools/beta-freeze.js`: expected red, exact static drift remains
  `faculty-admin.html`, `faculty-admin.js`, `paws-data-client.js`.
- `node tools/beta-api-freeze.js`: expected red, exact API drift remains
  `server/src/data/dashboard-api.js`,
  `server/src/data/sql-afc-write-repository.js` (missing at baseline),
  `server/src/data/sql-dashboard-repository.js`,
  `server/src/runtime/swa-dashboard-functions.js`,
  `server/src/runtime/swa-sql-runtime.js`, and `swa-api/index.js`.
- Freeze trust anchors, baseline hashes, and static manifest were not changed.

## Git and safety

- Correction commit: `438dba9cce6f0c917614643c13e6e011b6a0b668`
  (`fix: harden AFC SQL write boundary`).
- No migration apply, permission apply, live AFC insert, SQL business write,
  Firestore/Firebase mutation, Azure mutation, ACR/ACA/SWA deployment, PR,
  merge, baseline promotion, A2B, Work Queue, B2A, B2B, or DOE change.
- Next exact action: push this same branch and send the B1R A–L report to
  Architect3. B1G, B1D, B2A, B2B, B3, and DOE remain queued.
