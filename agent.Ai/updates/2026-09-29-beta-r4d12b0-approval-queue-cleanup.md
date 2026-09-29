# BETA-R4D-12B0 — Legacy Firestore Approval Queue Cleanup

**Date:** 2026-09-29  
**Starting main:** `5e5d947fd4c24b340185c1b8bb1a4bbe2c27d67d`  
**Branch:** `feature/beta-r4d12b0-approval-queue-real-data-cleanup`  
**Status:** B0 IMPLEMENTED / PENDING ARCHITECT REVIEW; NOT DEPLOYED

## Live data safety

- Exact Beta Firebase project verified: `tester-teaching`.
- Only `change_requests` and `afc_requests` were enumerated.
- Inventory: three `change_requests` total pending rows (two pending, one
  rejected) and two AFC rows (one pending_admin, one approved).
- No pending record contained finalized signature/PDF evidence.
- Private complete backup is outside Git at
  `C:\Users\xinyu\Documents\Codex\2026-08-31\outputs\b0\PAWS_BETA_B0_Legacy_Pending_Approval_Backup_2026-09-29.json`.
- Backup SHA-256:
  `e8bbf5e61d1dd60ff44918e0b7d140456f842fcb2c6a66864f59ed5d932ab572`.
- Deleted exactly two pending `change_requests` and one `pending_admin`
  `afc_requests`; no AFC `pdf_chunks` children existed.
- Post-cleanup pending counts are zero. Approved/rejected records remain, and
  no audit/history collection was touched.

## Code containment

- `asset-loader.js` skips `faculty-swap-safe.js`, the handoff helper, and
  `approval-workflow.js` when `sessionBackend() === 'azure-sql'`.
- `approval-workflow.js` independently returns before `UCVM.init()`, listener
  registration, request creation, or approval setup in Azure SQL mode.
- `afc-workflow.js` exposes a safe Azure SQL facade and temporary unavailable
  message. The AFC panel remains navigable; My Teaching, My Change History,
  close, Escape, and focus return remain available. No submit button or
  Firestore AFC read/write path is reachable from the Azure facade.
- Added `tests/b0-legacy-queue-containment.test.js` covering loader gating,
  direct fail-closed loading, AFC facade/navigation, no approval invocation,
  and the unchanged read-only SQL client contract.

## Verification and safety

- B0 focused suite: 4/4 pass.
- Full behavior regression excluding the expected baseline zero-drift assertion:
  490 pass, 29 skipped, 0 fail across 519 tests.
- Server suite: 129/129 pass.
- `git diff --check`: pass.
- Changed JavaScript syntax checks: pass.
- Frontend freeze reports intentional drift limited exactly to:
  `afc-workflow.js`, `approval-workflow.js`, `asset-loader.js`.
- API freeze: zero protected runtime drift.
- Live Beta site and SQL health: HTTP 200. Active ACA revision remains the
  existing Healthy/Provisioned R4D-11 revision.
- Read-only SQL verification: migrations 005/006 not applied; authority tables
  absent; no authority seed.
- No SQL writes, migration, seed, A2B, SQL Work Queue, B1, B2, DOE change,
  Firebase Auth mutation, Firestore-rules change, PR, or deployment.
