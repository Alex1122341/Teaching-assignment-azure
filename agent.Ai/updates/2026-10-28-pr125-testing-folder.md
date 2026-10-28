# Agent Update — PR125 Testing folder consolidation

**Date:** 2026-10-28
**Agent/model:** Codex
**Repository:** Alex1122341/Teaching-assignment-azure
**Task status:** PARTIAL

## User direction and work performed

The owner directed that Testing environment configuration, deployment and runtime scripts live in one dedicated folder, with automated tests remaining under `tests/`. The implementation is centralized under `tools/testing/`: `config/`, `db/`, `host/`, the Firestore modules, and Testing build, publication, preflight and attestation tools. Testing environment JSON and its template moved into `tools/testing/config/`; Production configuration remains in `config/environments/production.json`. Shared environment rendering selects the new Testing path and keeps the Production path unchanged. GitHub-required workflow definitions remain under `.github/workflows/` and reference the centralized scripts.

Old JavaScript and PowerShell script paths under `tools/`, `tools/testing-db/` and `tools/testing-host/` contain short compatibility entry points, not duplicated implementations. The original SQL seed and configuration files are in the centralized folder; historical documentation retains historical paths. The existing university host's files were not moved or changed. The active Testing host staging manifest was updated for the new source paths.

## Verification

The first targeted environment/host/deployment suite had one stale assertion for the renamed configuration file; after correcting it, 122/122 tests passed. Separate layout tests passed 5/5, including legacy module and CLI delegation and loading the nine-file staged university supervisor in an isolated temporary directory. `node tools/build-static.js` built 96 files, and `node tools/verify-environment-config.js --repository` passed. Testing build with `--if-provisioned` correctly reported that the Testing API origin is not provisioned. The Auth/Firestore emulator passed 2/2 tests after the move, covering isolated HTTP reads and synthetic fixture/disabled identity behavior; Admin SDK operations bypass Security Rules. Obtain fresh exact-head CI after committing these changes.

## Remaining work and boundaries

CCC schedule, profile, calendar and sanitized leadership reads are implemented only as an unpublished Testing slice. Firestore writes, faculty dashboard, assignments, AFC, DOE, swaps/approvals, history, reports, safe identity activation, host staging, full browser acceptance and PR merge remain incomplete. No Testing application or API is deployed, no live seed was executed and no Production service was modified. The pre-existing shared lab Faculty privacy issue remains separately unresolved. See prior updates for the live index and identity controls.
