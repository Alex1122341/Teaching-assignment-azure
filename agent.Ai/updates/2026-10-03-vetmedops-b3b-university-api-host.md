# PAWS B3B — University API Host and Infrastructure Readiness

Captured: 2026-10-03

- Accepted main base: `e52b55b57136dbe5690c1ffdf8bfec610c254819` (PR #44 merged).
- Feature branch: `feature/vetmedops-university-api-host`.
- Runtime candidate: `b85d6420a66ddb24513d8c9fa4aa838906012074`.
- Status: local loopback API verified; infrastructure readiness is PARTIAL. No service activation or cutover.
- Windows identity on the target: `UC\sa-xinyu.zhu1`.

## Runtime delivered in the candidate

- Built-in Node HTTP listener constrained to loopback; default port 8787.
- Existing PAWS SQL/Firebase runtime reused; bounded JSON request bodies, exact-origin CORS, safe generic errors, and graceful pool shutdown.
- Windows service wrapper configuration is documentation/template only. `PAWSApi` remains STOPPED and DISABLED with inert placeholder image path.
- No external bind, wrapper installation, service enable/start, or deployment.

## Verification

- Server tests: 184/184 passed.
- Root suite: 623 passed, 29 skipped, 0 failed (Python 3.13.15 directory added to process-local PATH only).
- Freeze/deployment focused tests: 49/49 passed.
- `tools/beta-freeze.js`: PASS, 48 protected static paths.
- `tools/beta-api-freeze.js`: PASS, 20 protected runtime paths.
- Actual HTTP adapter + PAWS SQL runtime bound to `127.0.0.1` on an ephemeral port. With the task-authorized temporary self-signed-certificate bypass, `GET /api/health/sql` returned 200; anonymous `/api/v1/me` and `/api/v1/dashboard/summary` returned 401. Process exited after check; no data changed.
- Strict TLS remains unverified because SQL has not restarted since the trusted certificate binding was staged.

## Exact infrastructure blockers

1. `SERVICE_IDENTITY_SQL_LOGIN_ADMIN_REQUIRED`: current Windows account lacks `ALTER ANY LOGIN`, sysadmin, and securityadmin; `NT SERVICE\PAWSApi` has no SQL login. DBA must review the handoff scripts before any provisioning.
2. `SHARED_SQL_RESTART_DEFERRED`: SQL Agent workload/job inventory is unavailable to the current identity, so a safe restart window is not proven. Do not restart SQL.

## Data and production boundary

No SQL login creation, database permission/data/schema write, SQL restart, certificate/configuration change, service activation, external exposure, Azure/Firebase change, merge of the new PR, or deployment was performed. Existing approved SQL certificate/key ACL/registry binding staging predates this B3B step. The end-to-end data transfer and PAWS cutover milestone is not complete.

## Next authorized gates

DBA-reviewed login and least-privilege provisioning; independent SQL restart-window evidence; strict-TLS validation; separately reviewed service activation; then authenticated integration/cutover acceptance.
