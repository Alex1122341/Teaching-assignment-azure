# B2B-PERF-PR — Server Timing Baseline Promotion / PR Gate

**Date:** 2026-09-30
**Branch:** `feature/beta-b2b-perf-server-timing`
**Accepted runtime candidate:** `6bfd637af57955ded38e6a39d2c055bec67a0aa0`
**Previous frozen baseline:** `65766bcf9fc57e50ff8b4fe7dd7cedcffb6825be`
**Promoted frozen baseline:** `6bfd637af57955ded38e6a39d2c055bec67a0aa0`
**Origin/main before PR:** `742b624584b9fabcc853cdcf34812ea1862204e7`
**Status:** B2B-PERF ACCEPTED / BASELINE PROMOTED / PR OPEN / NOT LIVE

## 1. Why this promotion exists

B2B-PERF instruments `GET /api/v1/me` with `Server-Timing` phases so that live
diagnosis can separate token verification, SQL pool acquisition, the user
profile query, and authorization validation from the application-side total.

The frozen trust anchor `65766bc...` predates that instrumentation, so the
accepted API runtime and the frozen anchor disagreed on five protected blobs
(four modified, one added). This governance unit promotes the accepted runtime
candidate as the new single static/API trust anchor.

## 2. Accepted Server-Timing contract

Fixed metric allowlist, in emission order:

```text
firebase_verify
sql_connect
sql_user_query
profile_validate
me_total
```

Preserved properties: monotonic `performance.now()`; request-local timing state
only; fixed metric allowlist; finite and non-negative durations; only `cold` /
`warm` descriptions; no persistence; no telemetry backend; no logging sink; no
token, UID, FacultyId, email/name, or SQL topology/statement/secret exposure.
Anonymous and invalid Firebase token requests expose no detailed
`Server-Timing`. Authenticated SQL failures may expose only the approved safe
timing metrics.

## 3. Performance interpretation — locked

- `sql_connect;desc="cold"` means **only** that the current Node runtime had no
  reusable SQL pool and executed a new `ConnectionPool.connect()`. It is **not**
  evidence of an ACA cold start, an Azure SQL serverless resume, or a Firebase
  cold start.
- `sql_connect;dur=0;desc="warm"` means **only** that the current process already
  had a reusable pool.
- `me_total` is **not** full browser-visible `/me` latency. It is application-side
  timing beginning inside the `/me` application path. Later live diagnosis must
  compare browser `T2 -> T4` against `Server-Timing me_total`.
- `me_total - firebase_verify - sql_connect - sql_user_query - profile_validate`
  may be described **only** as `in-process unattributed remainder`. It must not be
  labelled ACA cold start, network time, SQL resume time, or Functions startup
  time without additional evidence.

## 4. Governance boundary (proved, not asserted)

Exhaustive protected-set delta between `65766bc...` and `6bfd637...`:

- Static protected set: **48 paths, delta 0** — added 0, removed 0, content
  drift 0. `tools/static-assets.json` is byte-identical across the promotion.
  All 11 recorded `sha256` values are unchanged.
- API protected set: **17 -> 18 runtime files**, delta exactly the five accepted
  paths:
  - modified: `server/src/data/data-api.js`,
    `server/src/data/sql-connection.js`,
    `server/src/data/sql-user-repository.js`,
    `server/src/runtime/swa-functions.js`
  - added: `server/src/perf/request-timing.js`
- `deploy/aca/Dockerfile`: delta 0. `swa-api/*`: delta 0.

## 5. Files / components changed

| Path | Change |
|---|---|
| `tools/beta-freeze.js` | `BASELINE_COMMIT` -> `6bfd637...`; comment retargeted to B2B-PERF-PR |
| `tools/beta-baseline.json` | `sourceCommit` -> `6bfd637...`; all 11 `sha256` values unchanged |
| `tests/beta-baseline.test.js` | New baseline + previous baseline; 7 new continuity/contract tests |
| `tests/beta-api-freeze.test.js` | API runtime count assertion 17 -> 18 |
| `tests/azure-deployment.test.js` | Pinned baseline SHA updated; evidence must not lag on the superseded anchor |
| `.github/workflows/azure-beta-static-deploy.yml` | Static deploy evidence `--arg baseline` advanced (metadata only) |
| `agent.Ai/PROJECT_STATE.md`, `TASK_CHAIN.md`, `TEST_RELEASE.md` | Active continuity updated |
| `agent.Ai/updates/2026-09-30-beta-b2b-perf-server-timing-baseline-promotion.md` | This record |

No whitelist was added to `tools/verify-beta-candidate.js` or to the build
workflow, and the zero-drift enforcement model is unchanged.

## 6. Architecture / invariants affected

No architecture change. One release-governance value changed: the immutable trust
anchor moved from the pre-instrumentation runtime to the accepted instrumented
runtime. The shared static/API anchor invariant is preserved — `beta-api-freeze.js`
still imports `BASELINE_COMMIT` from `beta-freeze.js` and declares none of its own.

## 7. Tests / CI evidence (local, pre-commit)

| Suite | Command | Result |
|---|---|---|
| Focused governance | `node --test tests/beta-api-freeze.test.js` | **10/10 pass** |
| Focused governance | `node --test tests/beta-baseline.test.js` | **25/25 pass** |
| Focused governance | `node --test tests/azure-deployment.test.js` | **14/14 pass** |
| Accepted timing | `node --test server/test/request-timing.test.js` | **3/3 pass** |
| Accepted timing | `node --test server/test/me-server-timing.test.js` | **6/6 pass** |
| Accepted timing | `node --test server/test/sql-server-timing.test.js` | **3/3 pass** |
| Server suite | `npm test --prefix server` | **160/160 pass / 0 fail** |
| Root Beta suite | `npm test` | **622 pass / 1 fail / 29 skipped** (652 total) |
| Candidate verifier | `node tools/verify-beta-candidate.js` | PASS — static drift `[]`, API drift `[]` |
| Static freeze | `node tools/beta-freeze.js` | PASS — baseline `6bfd637...`, protected **48** |
| Static artifact freeze | `node tools/beta-freeze.js --artifact .azure-production/app` | PASS — protected **48** |
| API freeze | `node tools/beta-api-freeze.js` | PASS — repository API drift `[]` |
| API artifact freeze | `node tools/beta-api-freeze.js --artifact .azure-production/api` | PASS — artifact API drift `[]` |
| Diff hygiene | `git diff --check` | clean |
| Syntax | `node --check` on every changed JS file | clean |

Pre-promotion the same governance suites reported `beta-api-freeze` 9/10 (the
17 -> 18 count) and `beta-baseline` 17/18 (the API zero-drift test). Both
B2B-PERF freeze failures are resolved by the promotion; no other test changed
verdict.

The single root failure is `tests/hosting-boundary.test.js:48` ->
`spawnSync pwsh.exe ENOENT`. This is the known **host-only** failure (PowerShell 7
is not installed on this Windows host; only Windows PowerShell 5.1) and is
reproduced on the pristine baseline. It is classified separately and no product
code was changed to suppress it.

## 8. Live operations

### Performed

- Governance commit + push to the existing feature branch.
- PR creation against `main`.

### Explicitly NOT performed

- No merge and no auto-merge.
- No SWA / static deploy and no ACA Deploy.
- No ACR publish.
- No ACA min/max replica, CPU, or memory change.
- No Azure SQL tier change, SQL mutation, Firebase Auth mutation, Firestore
  mutation, or secret change.
- No live performance collection.
- No B3 and no DOE.

## 9. Current state after task

- Final branch: `feature/beta-b2b-perf-server-timing`
- Runtime candidate: `6bfd637af57955ded38e6a39d2c055bec67a0aa0`
- Frozen baseline after promotion: `6bfd637af57955ded38e6a39d2c055bec67a0aa0`
- Superseded baseline (historical): `65766bcf9fc57e50ff8b4fe7dd7cedcffb6825be`
- Live state unchanged: B2A and B2B behavior preserved; B2B-PERF **NOT LIVE**.
  The live API and static site continue to serve the previously deployed release.

## 10. Blockers / unresolved questions

None at this gate. Merge is explicitly **not** authorized by this task; the PR
stops for Architect merge review.

## 11. Exact current breakpoint

PR open against `main`; required `Azure Beta Build` CI green on the exact PR head.
No merge, no deployment, and no live performance acceptance has begun.

## 12. Next safe action

Architect merge review of the open PR. Only after an approved merge may the
B2B-PERF runtime be published and activated through the reviewed ACR publish +
ACA deploy chain, followed by live `T2 -> T4` versus `Server-Timing me_total`
diagnosis.

## 13. DO NOT REDO

- Do not redesign or optimize the accepted B2B-PERF instrumentation.
- Do not re-promote the baseline to `65766bc...`; it is superseded.
- Do not add a candidate-drift whitelist to the verifier or the build workflow.
- Do not merge, deploy, or dispatch any Azure workflow from this unit.
