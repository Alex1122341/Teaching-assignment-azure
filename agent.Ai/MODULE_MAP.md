# PAWS Module and File Map

This is a practical map of where major responsibilities live. Verify exact paths at the task ref before editing because branches may differ.

## 1. Azure Beta frontend

### `index.html`

Main timetable application shell and script loading.

BETA-R1 adds the shared SQL-backed data client to the existing UI without redesigning the timetable.

### `timetable.js`

Large existing timetable controller.

Responsibilities include:

- Firebase browser auth initialization;
- current user/UI state;
- timetable ranges/list/week views;
- session cache;
- session display shaping;
- legacy editing workflows;
- Faculty assignment/edit UI;
- swap/edit/create/delete entry points.

BETA-R1 changes the **session read path** to use the PAWS API.

Current BETA-R1 write behavior:

- session mutations call a fail-closed gate;
- SQL writes are not enabled;
- old Firestore session mutation code remains present but is not allowed to execute in Azure read mode.

Do not use BETA-R1 as permission to refactor the entire file.

### `paws-data-client.js`

BETA-R1 browser data boundary.

Responsibilities:

- obtain current Firebase ID token;
- call same-origin API;
- `GET /api/v1/me`;
- `GET /api/v1/sessions`;
- expose `sessionBackend() = azure-sql`;
- expose `sessionWritesEnabled() = false`;
- no SQL credentials;
- no Firestore fallback.

This should remain a small API client, not a generic database abstraction exposed to the browser.

### Supporting browser modules

Existing root JS files include domain/helpers for:

- faculty access/capabilities;
- AFC;
- scheduling;
- audit details;
- approval workflow;
- availability lookup;
- maintenance state;
- bulk import;
- timetable selection;
- session guard;
- user management.

Do not assume every legacy helper is already Azure-SQL-backed. BETA-R1 only substitutes the session/profile read path it explicitly owns.

## 2. BETA-R1 backend

### `server/src/auth/firebase-admin.js`

Firebase Admin verifier construction/configuration.

Server-only credentials/configuration.

### `server/src/auth/firebase-sql-auth.js`

Wraps token verification and expected Firebase-project checks for the SQL runtime.

### `server/src/data/sql-connection.js`

Thin SQL connection/pool/query wrapper.

BETA-R1 currently expects server-side SQL connection configuration.

No browser use.

### `server/src/data/sql-user-repository.js`

Exact `paws.UserProfile` lookup by Firebase UID.

Must never fuzzy-resolve account identity.

### `server/src/data/sql-session-repository.js`

Session read repository.

Uses:

- `paws.vCalendarSession`;
- `paws.SessionAssignment` for Faculty-scoped filtering.

Read-only in BETA-R1.

### `server/src/data/data-api.js`

Application-level authorization/read contract.

Responsibilities:

- active profile requirement;
- password-change gate under current candidate policy;
- supported role validation;
- FacultyId requirement for Faculty/HICC/VISC;
- date-range validation;
- map authorized caller to session query.

Keep authenticated actor/profile server-owned.

### `server/src/runtime/swa-functions.js`

Maps domain API results to SWA/HTTP function responses.

### `server/src/runtime/swa-sql-runtime.js`

Composition root for BETA-R1:

- environment;
- Firebase verifier;
- SQL connection;
- repositories;
- data API;
- SWA function adapter.

This is runtime wiring, not the place for business rules.

## 3. SWA managed API package

### `swa-api/index.js`

Managed API entrypoint/package bridge.

### `swa-api/host.json`

Azure Functions host configuration for the managed API artifact.

### `swa-api/package.json` / lockfile

Deployment dependencies for the API artifact.

## 4. Azure SQL DDL

### `database/azure-sql/001_foundation.sql`

Creates:

- `staging` schema
- `paws` schema
- raw/import/provenance tables
- canonical Faculty/Course/Session/SessionAssignment/AFC/Role data
- `UserProfile`
- `AuditEvent`

This is the initial foundation/load schema, not a forever migration runner.

### `database/azure-sql/002_calendar_view.sql`

Creates `paws.vCalendarSession`.

Derived read model over Session + SessionAssignment + Faculty display names.

Not a second writable timetable table.

### `database/azure-sql/003_app_permissions.sql`

Historical/broader API permission proposal from PR #3.

Do not assume this broad contract is the final runtime permission model.

### `database/azure-sql/004_swa_beta_permissions.sql`

PR #6 narrow read-only Beta-R1 permission contract.

Intended principal:

`paws_swa_beta`

Grants only the BETA-R1 read surface and explicitly denies writes/staging.

Separate live operator action required.

### PR #5 `005_faculty_directory_profile.sql`

Draft Faculty enrichment structure.

Not live at last accepted checkpoint.

## 5. Migration tooling

### `tools/azure_sql_migration/`

Normalization/import support.

Key concerns:

- exact identity resolution;
- deterministic source transformation;
- preservation of raw evidence;
- no fuzzy matching;
- source/target validation.

### `tools/load_paws_azure_sql_empty.ps1`

Initial empty-database loader.

**Completed historical operation. Do not use as routine migration tooling and do not rerun against the loaded database.**

### reset tooling

Historical exact-scope reset scripts exist for the completed lab reset.

Do not rerun without a brand-new explicit destructive authorization.

### `tools/preview_faculty_enrichment.py` and related module

PR #5 preview-only Faculty enrichment.

Live apply is separate.

### `tools/preview_beta_userprofile_bootstrap.js`

PR #6 preview-only account bootstrap validation/SQL-plan generator.

No live DB connection/write by design.

### `tools/preview_beta_sql_runtime.ps1`

BETA-R1 runtime/preflight helper.

Treat as operator tooling; inspect exact behavior before use.

## 6. Build/release tooling

### `tools/build-beta-release.js`

Builds the Beta application artifact.

### `tools/build-swa-api.js`

Builds managed API artifact.

### `tools/verify-beta-candidate.js`

Strict wrapper around `tools/beta-freeze.js`. Verifies the repository runtime against the frozen baseline and fails on ANY protected runtime drift. Since the BETA-R3A-3 baseline promotion it has no drift whitelist and no Beta-R1 special-case exception.

### `tools/static-assets.json`

Authoritative shipped static asset manifest used by freeze checks.

### `tools/beta-freeze.js`

Protects frozen Beta baseline assets by comparing against immutable Git objects.

## 7. GitHub Actions

### Azure Beta Build

Build/test/candidate evidence.

Success does not deploy.

### Azure Beta Deploy

Manual/exact-SHA release path.

BETA-R1 modifies artifact shape to include:

- `.azure-production/app`
- `.azure-production/api`

Deployment remains a separate explicit action.

## 8. Experimental repository modules to know about

Repository:

`Alex1122341/Teaching-assignment`

Important future-source areas:

- `teaching-responsibility.js`
- `teaching-assignment-groups.js`
- `teaching-assignment-review.js`
- `subject-catalog-admin.js`
- `firestore.rules`
- DOE server/domain modules
- Published Timetable P3.1 spec
- LAB group/roster modules

These are architecture/reference sources until deliberately ported to Beta.

Do not copy them wholesale merely because they exist.
