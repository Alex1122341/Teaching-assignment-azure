# Agent Update — P0 W1E Identity Authority and University Runtime Least Privilege

**Date:** 2026-10-05
**Agent/model:** Codex GPT-6
**Repository:** `Alex1122341/Teaching-assignment-azure`
**Task status:** LOCAL IMPLEMENTATION COMPLETE; external runtime identity confirmation/provisioning required before cutover; branch push pending final review.

## 1. Goal

Lock the University SQL API identity/role boundary, audit every protected API route and SQL repository permission, prepare an unexecuted least-privilege SQL artifact and future service runbook, verify the live runtime read-only, add regression tests, and push only the W1E feature branch. Do not create a PR, change live permissions/service identity/gates, execute SQL, publish Firestore rules, or deploy.

## 2. Starting breakpoint

- Repository: `Alex1122341/Teaching-assignment-azure`
- Accepted W1C: `916a90cc2e3e9f55c01e26ace6a14f21c7d2cca9`
- Accepted W1D base and W1E starting SHA: `2d40117eb34ce309826a0e0d357b694fcf86801a`
- Working branch: `feature/beta-w1e-identity-runtime-least-privilege`
- PR: none (W1E expressly excludes PR creation)
- W1D had not published its local Firestore rules. The prior AFC release run `37366171691` was not complete / not reverified in W1D evidence.

## 3. Work performed

### Code and documentation

- Added focused test coverage for Firebase identity plus SQL `UserProfile` role authority, mismatched Firebase/SQL claims, missing/inactive/password-change-required profiles, invalid tokens, SQL lookup failure, forged faculty target, and default-off/SQL-permission-denied write behavior.
- Added a repository-derived SQL object/procedure manifest and contract tests for exact object coverage, column-scoped reads, separate write roles, no principal binding, and no broad DML/schema-wide EXECUTE.
- Prepared local-only SQL artifact `database/azure-sql/017_w1e_runtime_least_privilege.sql`. It creates four reusable empty roles, grants column-scoped read access and two artifact-read procedures, and puts each of the three W1C procedures in its own write role. It does not create/map a user/login or grant a role to any principal.
- Prepared `docs/superpowers/specs/2026-10-05-paws-w1e-identity-and-permission-matrix.md`, including route-level authority, SQL permission inventory, live-runtime facts, exact minimal University IT handoff, service target, and future cutover/rollback order.
- Prepared `docs/operations/PAWSApi-university-runtime-runbook.md` for the future immutable-release service configuration, nonsecret config handling, monitoring/recovery, verification, cutover, and rollback.
- Recorded the accepted identity authority in `agent.Ai/DECISIONS.md`; refreshed current state and task chain. Older W1D checkpoint remains historical.

### Analysis and live reads

- Audited Firebase Admin token verification, API SQL profile repository, `/api/v1/me`, sessions, dashboard, AFC requests, AFC approval and approved-artifact routes. Verified from source that business role and self scope come from SQL `UserProfile`; Firestore roles/custom claims/client fields do not authorize the SQL API, and SQL lookup errors fail closed.
- Inventory: 13 direct SQL read objects; 2 approved AFC artifact GET procedures; 3 gated W1C write procedures in separate roles; 6 other current AFC write procedures are explicitly ungranted. No direct table DML is required where these stored-procedure boundaries exist.
- Re-inspected `ITAPPVETOPSDB01` read-only. API: Node `C:\Program Files\nodejs\node.exe`, command `src/runtime/university-api.js`, loopback `127.0.0.1:18787`; launcher under `C:\PAWS\Runtime\Acceptance\2026-10-04\Start-PAWSApi-StageA.ps1`. Process owner is personal `UC\sa-xinyu.zhu1`.
- `VetMed-Ops` reports the matching SQL login/database user `UC\sa-xinyu.zhu1`, `db_owner=1`, effective `CONTROL DATABASE=1`, and `ALTER DATABASE=1`; server `sysadmin=0`. This remains broad database control and is **UNSAFE_FOR_WRITE_ACTIVATION**.
- `MSSQLSERVER` is Running/Automatic under `UC\srv-vetmedPBIEngine`. `PAWSApi` is Stopped/Disabled with inert `cmd.exe /c exit 0` placeholder and is not hosting the API.
- Runtime source contract uses `msnodesqlv8` with Windows integrated auth over encrypted TCP to `ITAPPVETOPSDB01.uc.ucalgary.ca:1433`, database `VetMed-Ops`, certificate validation enabled. SQL health returned HTTP 200 during the bounded read-only inspection. No business query/write was issued.
- Exact source commit and process working directory remain **not attested**: the server source directory is not a Git worktree. Do not claim exact-main correspondence.
- Read-only SQL catalog check confirmed `Faculty.FteSourceReference`, `Faculty.FteSourceRow`, `Faculty.FteSourceUpdatedAtUtc`, and `vAfcRecordUnified.Purpose` exist in current VetMed-Ops. The artifact was not run.

## 4. Architecture / invariants affected

- Locked: Firebase Authentication proves identity, verified UID and token validity/revocation. SQL `paws.UserProfile.BaseRole`, `Active`, `MustChangePassword` and `FacultyId` authorize University SQL API operations. Firestore `users.role` / `facultyRoles` remain separate account/UI/Firestore-rule data and cannot grant or reduce SQL API authority.
- No browser-side synchronization between Firestore roles and SQL `BaseRole`; any future role management belongs in a trusted server-side API task.
- Runtime identity must be dedicated/nonpersonal and least privilege. `db_owner`, `CONTROL DATABASE`, `sysadmin`, broad DML/DDL, or schema-wide EXECUTE are not runtime requirements.
- Write eligibility requires both the independent server-side W1C gate and the matching narrow SQL procedure grant, followed by separately authorized activation. W1E enables no gate.

## 5. Tests / CI evidence

Tests used Node `22.23.3` from a temporary local npm package cache because system Node is `24.19.0`; no global Node or repo manifest change.

- Focused: `node --test server/test/w1e-identity-authority.test.js server/test/w1e-permission-contract.test.js server/test/write-gates.test.js` — **12/12 passed**.
- Server full suite: `npm test` under `server/` — **329/329 passed** on Node 22.23.3.
- Root full suite: `npm test` — **770 total, 733 pass, 5 fail, 32 skipped**.
- Emulator suite: `npm run test:emulator` — **770 total, 765 pass, 5 fail, 0 skipped**. The emulator-backed W1D SQL-canonical browser-write-denial subtests executed and passed.
- The five failing root/emulator test cases are exactly the same five as the pre-W1E baseline log: the frozen runtime zero-drift aggregate, 52-file identity assertion, B2B helper protection, B0 runtime candidate, and API freeze zero-drift assertion. No test/freeze baseline was changed.
- Direct `node tools/beta-freeze.js`: 52/52 checked, **11 static files drift** from frozen candidate `51ed5f7aa0851aac5f20133ea213666028e018a3`. Each is already different between that frozen candidate and accepted W1D base `2d40117eb34ce309826a0e0d357b694fcf86801a`; no W1E static file was changed.
- Direct `node tools/beta-api-freeze.js`: 37/37 checked, **4 API files drift** from the same frozen candidate. Each difference is already present at accepted W1D base; no W1E runtime implementation file was changed.
- `node tools/verify-beta-candidate.js`: reports the same 11 static / 4 API inherited differences; no baseline or whitelist weakened.
- The first direct SQL contract test run found its new assertion included the two intended read-role procedures alongside write procedures. The assertion was corrected to include both exact read grants; focused tests then passed 12/12.
- Pending final run after continuity updates: Node syntax checks for both changed test files, staged diff check, and changed-file secret-pattern scan.
- No hosted CI was requested or run.

## 6. External dependency

- **Dependency:** University IT identity confirmation/provisioning and supported-service model review.
- **Minimal action:** confirm or provision a nonpersonal Windows service identity for `PAWSApi` on `ITAPPVETOPSDB01`; prefer organization-managed gMSA/passwordless Windows-integrated SQL auth if supported. Confirm service logon, SQL SPN/Kerberos behavior, and required Firebase Admin network/credential model. Do not ask IT for database grants, `db_owner`, `CONTROL DATABASE`, or `sysadmin`; grants belong to the separate DBA review. Current account inventory was not enumerated, so W1E does not assert that gMSA is absent.
- **Resume point:** after IT confirms the identity and host/network model, separately review the exact live SQL object definitions and artifact, then stage an authorized cutover plan. Under the final identity verify the process owner, source SHA/hash, SQL principal, roles/effective permissions and authenticated read-only routes, with all write gates still false. Preserve tested rollback. Only a separately approved DBA change may remove application reliance on the personal SA; preserve legitimate DBA access.

## 7. AFC parallel breakpoint

- AFC remains **PARTIAL**. Evidence references accepted run `37366171691` as not complete/not reverified; missing independently recorded authenticated `/api/v1/me`, screenshots, and AFC POST/network zero-write counts remain.
- Release/build/deploy rerun required: **NO**. Deployment rerun required: **NO**.
- Resume only through the previously authorized normal authenticated acceptance/evidence path after Architect #6 directs it. Do not recreate or submit AFC records as part of W1E.

## 8. Live operations

- Performed: read-only host/process/service inspection, SQL identity/role/effective-permission metadata queries, SQL catalog column-existence query, and API SQL-health probe.
- Explicitly not performed: SQL artifact execution or database writes; SQL login/user/role/grant changes; Windows service identity/state/configuration change; firewall/certificate/Azure/Firebase/Firestore/Cloudflare/PAWS mutation; Firestore rules publication; deployment; write-gate change; PR; merge; main modification.

## 9. Current breakpoint

Local W1E implementation is ready for review on `feature/beta-w1e-identity-runtime-least-privilege`, based on W1D `2d40117eb34ce309826a0e0d357b694fcf86801a`. All independent local work is complete. Current runtime remains personal-SA / `db_owner` / `CONTROL DATABASE` and is unsafe for write activation; University IT identity confirmation/provisioning is the external cutover dependency. Final commit/push evidence is to be filled after the final diff check.

## 10. Next safe action

Review and push only `feature/beta-w1e-identity-runtime-least-privilege`; provide the A–M W1E report to Architect #6. Wait for Architect #6 review. No PR, merge, deployment, SQL execution or permission/service/gate/rules mutation.

## 11. DO NOT REDO

- Do not rerun AFC release/deploy run `37366171691`; its missing evidence is known and separate.
- Do not execute SQL artifact 017, bind a runtime identity, change live SQL permissions/service configuration, or enable any W1C write gate.
- Do not change Firestore rules, Firestore business data, Firebase config, Azure, Cloudflare, or PAWS production; do not create a PR or alter `main`.
- Do not weaken static/API freeze checks. The exact five root/emulator test failures and 11/4 direct freeze differences predate W1E at accepted W1D base.
- Do not treat the personal `UC\\sa-xinyu.zhu1` account as an acceptable application runtime identity or remove the owner's administrative DBA access.
