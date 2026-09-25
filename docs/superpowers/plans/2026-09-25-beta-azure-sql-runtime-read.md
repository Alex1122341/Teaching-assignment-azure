# Beta Azure SQL Runtime Read Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the controlled Beta timetable session-read domain over to Firebase-authenticated, same-origin SWA Managed Functions backed only by canonical Azure SQL `paws.*`, while keeping session mutations fail-closed and every other domain on its existing Firestore path.

**Architecture:** A public configuration module selects exactly `firestore` or `azure-sql`. A single browser data client owns authenticated same-origin API calls. Managed Functions reuse small server modules for Firebase verification, SQL profile resolution, canonical session reads and safe HTTP responses. The deterministic release-candidate artifact has separate `app/` and `api/` roots; activation and frozen-baseline promotion remain later gates.

**Tech Stack:** Vanilla browser JavaScript, Node.js 22, Azure Functions v4, `firebase-admin`, `mssql`, Azure Static Web Apps, Azure SQL.

**Spec:** `C:/Users/xinyu.zhu1/.codex/attachments/9d7613d7-5f7c-44f0-9fd8-a6bc32e52b93/Pasted text.txt`

## Global Constraints

- Base exactly `c42392914878d8872b2f67689b8e2ab15bd7462a`; PR #3 stays an explicit unmerged dependency.
- Implement only session reads plus `/api/health/sql` and `/api/v1/me`; no AFC, DOE, SWAP, P3.1, HICC/VISC workflow, publication or session writes.
- Firebase Authentication remains authoritative identity; SQL profile data is authoritative authorization.
- Missing SQL profile, inactive profile, invalid backend, missing server configuration and runtime errors fail closed.
- Runtime queries only `paws.*`; no `staging.*`, automatic Firestore fallback or dual write.
- No live SQL, Firebase, SWA setting, deployment, main, freeze-baseline, PR #2 or PR #3 mutation.
- `tools/beta-freeze.js` remains unchanged; changed runtime is a release candidate pending explicit baseline promotion.

## Review Focus

- Authenticated token with the correct project but no SQL profile returns controlled 403 and performs no insert.
- Faculty-shaped roles with no linked `FacultyId` cannot expand to all sessions.
- Azure SQL errors never include connection strings, credentials, raw SQL or stack traces.
- Every callable session mutation entrypoint rejects before obtaining a Firestore batch/reference in SQL mode.
- The assembled API artifact contains its deterministic dependencies but excludes staging/import/private/secret material.

---

### Task 1: Configuration and Browser Data Boundary

**Files:**
- Create: `firebase-config.js`
- Create: `paws-data-client.js`
- Modify: `index.html`
- Modify: `tools/static-assets.json`
- Test: `tests/firebase-config.test.js`
- Test: `tests/paws-data-client.test.js`

**Interfaces:**
- Produces: `window.UCVM_PAWS_SESSION_BACKEND`; `createPawsDataClient({backend,tokenProvider,fetchImpl})` with `currentUser()`, `listSessions({start,end})`, `sessionBackend()`, `sessionWritesEnabled()`.
- Consumes: existing Firebase browser Auth only for `getIdToken()`; same-origin `/api/v1/*`.

- [ ] Write failing tests for default Firestore, accepted Azure SQL, invalid mode fail-closed, same-origin authenticated calls, safe errors, no fallback and public-config secret exclusion.
- [ ] Run `node --test tests/firebase-config.test.js tests/paws-data-client.test.js` and confirm failures are missing modules/contracts.
- [ ] Implement the minimal configuration/client boundary and load it before `timetable.js`.
- [ ] Re-run the focused tests and `node --test tests/page-modules.test.js tests/runtime-assets.test.js tests/hosting-boundary.test.js`.
- [ ] Commit `feat: add explicit beta session data boundary`.

### Task 2: Server SQL, Firebase Authentication and API

**Files:**
- Create: `server/package.json`, `server/package-lock.json`
- Create: `server/src/auth/firebase-admin.js`, `server/src/auth/firebase-sql-auth.js`
- Create: `server/src/data/sql-connection.js`, `server/src/data/sql-user-repository.js`, `server/src/data/sql-session-repository.js`, `server/src/data/data-api.js`
- Create: `server/src/http/errors.js`, `server/src/runtime/swa-functions.js`, `server/src/runtime/swa-sql-runtime.js`
- Test: `server/test/*.test.js`

**Interfaces:**
- Produces: `createSwaSqlRuntime().handle(request)`; safe `GET /api/health/sql`, `/api/v1/me`, `/api/v1/sessions` behavior.
- Consumes: `paws.UserProfile`, `paws.Faculty`, `paws.SessionAssignment`, `paws.vCalendarSession`; `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `PAWS_SQL_CONNECTION_STRING` server settings.

- [ ] Write failing server tests for configuration redaction, bounded SQL failures, Firebase token/project verification, no-profile/inactive denial, safe profile projection, range validation, FacultyId scope and canonical-only SQL.
- [ ] Run `node --test server/test/*.test.js` and confirm expected missing-module failures.
- [ ] Implement environment-neutral modules with injected Firebase/SQL dependencies; SQL user lookup is read-only and never auto-provisions.
- [ ] Re-run all server tests and assert no query contains `staging.`.
- [ ] Commit `feat: add authenticated Azure SQL read API`.

### Task 3: Timetable SQL Reads and Mutation Guards

**Files:**
- Modify: `timetable.js`
- Test: `tests/timetable-azure-sql-read.test.js`
- Test: existing timetable/session mutation tests as needed.

**Interfaces:**
- Consumes: Task 1 `UCVM_PAWS_DATA` contract.
- Produces: SQL-mode one-shot range reads and `SQL_SESSION_WRITES_NOT_READY` before every session mutation path.

- [ ] Write failing source/behavior tests for SQL range reads, absence of Firestore session subscription, empty/error states, no fallback, normalized rows and all discovered mutation entrypoint guards.
- [ ] Run focused tests and verify the missing branches/guards fail.
- [ ] Implement one backend branch at the timetable data boundary and one shared guard called before any session write/edit path.
- [ ] Re-run focused timetable, selection, scheduling, swap and integration tests.
- [ ] Commit `feat: route beta timetable reads through Azure SQL`.

### Task 4: Deterministic Managed Functions Artifact

**Files:**
- Create: `swa-api/index.js`, `swa-api/host.json`, `swa-api/package.json`, `swa-api/package-lock.json`
- Create: `tools/build-swa-api.js`, `tools/build-beta-release.js`
- Modify: `.github/workflows/azure-beta-build.yml`
- Modify: `.github/workflows/azure-beta-deploy.yml`
- Test: `tests/beta-runtime-artifact.test.js`
- Test: `tests/azure-deployment.test.js`

**Interfaces:**
- Consumes: Task 2 runtime modules and Task 1 static assets.
- Produces: `.deploy-beta/app` plus `.deploy-beta/api`, deterministic allowlisted API source/dependencies and exact-artifact handoff.

- [ ] Write failing artifact/deployment tests for frontend/API inclusion, deterministic file inventory, exact dependency lock, secret/private-data exclusion and deploy workflow API handoff.
- [ ] Run focused tests and confirm artifact support is absent.
- [ ] Implement allowlisted API packaging and release assembly; retain manual exact-main deployment gates and no live credential.
- [ ] Build and inspect the artifact itself, then rerun deployment/artifact tests.
- [ ] Commit `build: package beta managed functions release candidate`.

### Task 5: Least-Privilege Preview Contract and Operator Documentation

**Files:**
- Create: `database/azure-sql/004_swa_beta_permissions.sql`
- Create: `tools/preview_beta_sql_runtime.ps1`
- Create: `docs/beta-azure-sql-runtime.md`
- Modify: `docs/azure-sql-migration.md`
- Test: `tests/python/test_beta_sql_runtime_contract.py`

**Interfaces:**
- Produces: read-only preview of target/object/count/principal/settings requirements; reviewed SQL grants for SELECT-only runtime access and explicit `DENY` on `staging`.
- Consumes: PR #3 schemas; no runtime INSERT because live `UserProfile` bootstrap is a separate operator action.

- [ ] Write failing contract tests for preview-by-default, explicit apply prohibition in this phase, SELECT-only objects, no broad grants, staging denial and OAuth helper defect documentation.
- [ ] Run the focused Python tests and confirm files/contracts are missing.
- [ ] Implement preview tooling and permission SQL without executing either live; record PR #3 OAuth helper typo as a follow-up because runtime tooling does not depend on it.
- [ ] Re-run contract and migration tests.
- [ ] Commit `docs: define beta SQL runtime activation preview`.

### Task 6: Full Verification, Candidate CI and Handoff

**Files:**
- Modify: tests only for regressions found during verification.
- Create: release-candidate evidence in the execution ledger; no frozen-baseline change.

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: pushed exact head, green applicable CI, verified candidate artifact, explicit freeze-promotion procedure and one later operator preview action.

- [ ] Run all focused browser/server/Python/build tests, then full Beta unit and emulator suites.
- [ ] Run `node tools/beta-freeze.js` and record expected candidate drift without changing the verifier or baseline; validate unchanged baseline paths separately from intentional candidate assets.
- [ ] Run deterministic release build twice and compare inventories/hashes; scan repository/artifacts for secret/private migration material.
- [ ] Review the whole branch against the spec, fix Critical/Important findings with RED→GREEN coverage, and commit.
- [ ] Push only `feature/beta-azure-sql-runtime-read`; open a Draft PR stacked on `feature/azure-sql-cutover-foundation`; wait for exact-head Beta CI and report run IDs.

