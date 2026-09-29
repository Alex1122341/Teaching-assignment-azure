# Agent Update — BETA-R4D-12B0G Freeze Promotion

**Date:** 2026-09-29
**Repository:** `Alex1122341/Teaching-assignment-azure`
**Branch:** `feature/beta-r4d12b0-approval-queue-real-data-cleanup`
**Status:** IMPLEMENTED + RUNTIME ACCEPTED + FROZEN BASELINE PROMOTED + PENDING PR/INTEGRATION + NOT LIVE

## Immutable baseline

- Reviewed B0 runtime candidate / new static and API trust anchor:
  `b3458f79a05353ce1255874754e1c6c1ec8ee683`.
- Previous frozen baseline:
  `8b1388f5afe210c761d6dbc3b4240536758f7342`.
- Candidate parent: `b4999ca61c09cf04ffc6d27c75b104c5b7f6291c`.
- Expected `origin/main` remains
  `5e5d947fd4c24b340185c1b8bb1a4bbe2c27d67d`.
- `BASELINE_COMMIT` and `tools/beta-baseline.json.sourceCommit` now point to
  the exact reviewed candidate. The reporting SHA-256 values were regenerated
  deterministically from Git blobs at that candidate; the existing nine-file
  reporting set remains unchanged.
- Protected manifest count remains 46. Previous paths missing = 0; newly added
  paths = 0. The static manifest itself was not changed.

## Runtime and safety continuity

The old visible Approval Queue was Firestore-backed through
`change_requests` and `afc_requests`, not Azure SQL. B0 backed up and cleared
the pending legacy queue records without deleting completed/signed/audit/history
records. The B0R read-only recheck remains zero for all three pending statuses.

The accepted B0 rule is explicit legacy opt-in only:
`sessionBackend() === 'firestore'`. Azure SQL, missing, unknown, and throwing
backend states fail closed. The real Azure client remains `azure-sql` with
`sessionWritesEnabled() === false`. B0G does not deploy this runtime.

## Governance scope

The governance commit may change only freeze references, derived baseline
reporting, baseline tests, and active continuity documentation. It must leave
all protected static runtime and API/build-definition bytes identical to the
B0 runtime candidate. Historical update/spec/plan records mentioning the old
baseline are intentionally retained as historical references.

Required next sequence: open one PR to `main`, wait for green repository and
artifact static/API freeze checks plus required Beta and SQL migration checks,
merge with a merge commit only, and stop at **MERGED / FROZEN / NOT LIVE**.
The next separate task is **B0D — controlled static release + final live
acceptance**. Do not deploy or begin B1 in B0G.
