# Agent Update — VetMed-Ops Windows Auth Runtime

**Date:** 2026-10-03  
**Agent/model:** ChatGPT 6 Luna  
**Repository:** Alex1122341/Teaching-assignment-azure  
**Task status:** COMPLETE — PR OPEN, CI GREEN, NOT MERGED

## 1. Goal

Add an explicit opt-in Windows Integrated Authentication SQL driver for the university-hosted PAWS runtime, prove the actual PAWS health/read path and rollback-safe AFC write path, and open a green PR for review.

## 2. Starting breakpoint

- base branch: `main`
- base SHA: `c99b064002d0cf07a9ef44b7914321f3921777ad`
- working branch: `feature/vetmedops-windows-auth-runtime`
- starting SHA: `c99b064002d0cf07a9ef44b7914321f3921777ad`
- PR: #44, https://github.com/Alex1122341/Teaching-assignment-azure/pull/44
- relevant prior update: `2026-09-30-beta-b2b-perf-server-timing-baseline-promotion.md`
- live environment assumptions: ITAPPVETOPSDB01, VetMed-Ops; temporary migration Windows identity only

## 3. Work performed

- Code/docs changes: added explicit `PAWS_SQL_DRIVER=msnodesqlv8`, pinned `msnodesqlv8@5.5.0` in the server workspace, retained the Tedious/default and Azure Managed Identity paths, and promoted the source freeze anchor.
- Analysis/review: inspected the AFC POST route, repository, stored procedure, table dependencies, permission requirements, and outer-transaction rollback behavior.
- Live reads: exercised `createSwaSqlRuntime()`, `GET /api/health/sql`, the SQL identity query, and strict TLS validation against VetMed-Ops.
- Live writes: performed one authorized AFC repository-path write inside an outer transaction and verified its rollback.
- Deployment/release actions: none. PR #44 is open and unmerged.

## 4. Files / components changed

- `server/src/data/sql-connection.js`: opt-in driver selection, allowlisted Windows connection options, trusted connection, strict TLS defaults, and test-only self-signed bypass.
- `server/src/runtime/swa-sql-runtime.js`: lazy Windows driver loading while preserving injection and the default path.
- `server/package.json`, `server/package-lock.json`: pinned server-only native SQL dependency.
- `server/test/sql-connection-windows.test.js`: driver, TLS, credential rejection, lazy loading, and connection regression coverage.
- `tools/beta-freeze.js`, `tools/beta-baseline.json`, governance tests, and the static deployment evidence workflow: point to the accepted source candidate; protected static content remains unchanged.
- This update plus `PROJECT_STATE.md` and `TASK_CHAIN.md`: continuity status.

## 5. Architecture / invariants affected

Existing Azure Managed Identity/Tedious behavior is preserved. Windows Integrated Authentication is explicit opt-in. Strict TLS validation remains the default; bypass requires the test-only flag. The static protected path set remains 48 with zero drift; the protected API path set remains 18 with zero path-set drift. No earlier decision was superseded.

## 6. Data / algorithm changes

No business data model, authorization, session grouping, DOE, AFC workflow, or migration algorithm change. The controlled AFC proof used synthetic identifiers and left no data or audit residue.

## 7. Tests / CI evidence

- `npm.cmd test --prefix server`: 174 total, 174 passed, 0 failed, 0 skipped.
- `npm.cmd test`: 652 total, 623 passed, 0 failed, 29 skipped.
- `node tools/beta-freeze.js`: PASS, protected 48, zero drift.
- `node tools/beta-api-freeze.js`: PASS, baseline `e80d73558c137f9d2cb6de316e2179e4ad073353`.
- `git diff --check`: PASS.
- GitHub Actions `Azure Beta Build`, run `37138852302`: PASS on PR #44 after the CI test stub fix. Runtime code head validated: `37bb5a6b28a1ee18000ccbce85423c694c4de626`. This report records the green implementation/test head; the continuity-only update does not change product or test code.
- No failure remains. The initial CI failure was a test isolation issue: the lazy-import test attempted to load `mssql` on a runner without server workspace dependencies; the test now stubs module loading.

## 8. Live operations

### Performed

- Actual PAWS SQL runtime health endpoint returned HTTP 200 with the expected service response.
- Read-only SQL identity query succeeded through the same PAWS SQL connection implementation and selected VetMed-Ops.
- Strict TLS with certificate validation enabled failed on the current self-signed server certificate as expected; classified `EXPECTED_PRODUCTION_TLS_BLOCKER`.
- Actual AFC procedure/repository path was run with a synthetic test record under an outer transaction. The row and audit event existed inside the transaction, then rollback removed both; no residue remained.

### Explicitly NOT performed

No permanent database test data, schema, SQL permission, SQL configuration, certificate, Windows service, Firebase, Azure, deployment, merge, or main-branch change.

## 9. Current state after task

- final branch: `feature/vetmedops-windows-auth-runtime`
- final SHA at report time: `37bb5a6b28a1ee18000ccbce85423c694c4de626`
- PR: #44 OPEN, CI GREEN
- merge/deploy state: NOT MERGED / NOT DEPLOYED
- `origin/main`: `c99b064002d0cf07a9ef44b7914321f3921777ad`

## 10. Blockers / unresolved questions

A permanent PAWS runtime must use a dedicated least-privilege Windows service identity; the temporary migration identity is not approved for production runtime use. Current database-level CONTROL does not supply server-level login creation. The current SQL principal has only CONNECT SQL and VIEW ANY DATABASE at server scope; it lacks ALTER ANY LOGIN / CREATE LOGIN. SQL administrator provisioning is required for the next service-identity stage.

Production TLS remains blocked until the SQL Server certificate chain is trusted and matches the server name. This PR does not change the certificate.

## 11. Exact current breakpoint

PR #44 contains the Windows Auth implementation, baseline promotion, and CI test isolation fix. CI run `37138852302` is green; PR is open and no merge or deployment occurred. Live read and rollback proofs are complete. The next stage is dedicated service identity provisioning and strict TLS remediation planning.

## 12. Next safe action

Architect review of PR #44, then prepare the dedicated Windows service identity and trusted SQL certificate path using authorized server-level administration. Keep the temporary migration identity out of production configuration.

## 13. DO NOT REDO

- Do not repeat the live AFC rollback proof; it completed with no residue.
- Do not change the SQL certificate or permissions as part of PR #44.
- Do not merge or deploy PR #44 before review.
- Do not use the temporary migration identity as the production runtime identity.
- Do not repeat the baseline/root/server tests unless the PR head changes.

## 14. Suggested next-agent prompt

Review PR #44 and continue the PAWS VetMed-Ops migration at the service-identity and strict-TLS readiness stage. Use a dedicated least-privilege Windows service identity; verify its effective permissions before authenticated API read/write acceptance. Preserve Firebase, Azure Managed Identity, and the default Tedious path.
