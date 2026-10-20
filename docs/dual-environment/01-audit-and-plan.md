# PAWS dual environment — audit and implementation plan

Branch `feat/dual-environment-testing`, from `main` @ `0d4b4d9`. Read-only audit done 2026-10-14.

> This is the original 2026-10-14 audit (base `0d4b4d9`). The work now lives on `feat/paws-testing-environment`, rebased onto `main` @ `6addfb9`. For the independent review and fixes see `02-review-and-fixes.md`; for owner setup see `03-setup-and-deployment.md`; for the acceptance checklist and current status see `04-acceptance-and-status.md`.

## 1. What runs today

| Layer | Current deployed Beta ("production") | Evidence |
|---|---|---|
| Frontend | Firebase Hosting site `tester-teaching` → https://tester-teaching.web.app | `firebase-hosting-deploy.yml`, `tools/beta-baseline.json` |
| Identity | Firebase Auth project `tester-teaching` | Firebase web config hard-coded in `faculty-access.js`, `faculty-admin.js`, `teaching-assignments.js`, `timetable.js`; `bulk-import-ui.js` falls back to it |
| API origin | `paws-api-origin.js` → temporary Cloudflare tunnel | single shared constant, loaded by every page |
| API | University Node API (`server/src/runtime/university-api.js`) on `ITAPPVETOPSDB01`, loopback-only, Windows auth | `deploy/windows/*`, `sql-connection.js` msnodesqlv8 mode |
| SQL | `VetMed-Ops` (real faculty data) | migrations hard-require `DB_NAME() = N'VetMed-Ops'` |
| Legacy | ACA Functions app `paws-sql-beta-api-260926` + Azure SQL lab `teaching-assignment-lab` (loaded from the real workbooks) | `azure-beta-aca-deploy.yml`, `docs/azure-sql-migration.md` |

**`tester-teaching` is not a test environment.** Despite its name, the site calls the University API, which reads and writes the real `VetMed-Ops` data. The legacy Azure lab database also contains real faculty records, so it can't be reused as the Testing database without being wiped.

## 2. Classification of requested functionality

| Requirement | Status | Notes |
|---|---|---|
| Environment identity (server) | **Missing** | No `PAWS_ENVIRONMENT`; `/api/health/runtime` always reports `authority: vetmed-ops-sql` |
| Environment-specific frontend config | **Missing** | API origin and Firebase config are constants in source; 4 files duplicate the Firebase config |
| Separate Testing deployment | **Missing** | Only one Hosting target, one API, one DB |
| Cross-environment guards | **Missing** | Nothing stops a test API from pointing at `VetMed-Ops` |
| Write capability gates | **Implemented** | `write-gates.js`: 20 env-var gates, default off. They can be set per environment |
| Identity switching | **Partially implemented** | Developer Support (`support-service.js`, `developer-support.js`, migrations 033/034): developer-only, 30-minute server-side context, real actor in `SupportContext`/`SupportOperation`/`AuditEvent`, capture triggers + undo. **It writes real data**, so it isn't a sandbox, and it isn't environment-aware |
| Top-nav environment switcher | **Missing** | `developer-support.js` already injects a header button and a top strip on every page; reuse that injection point |
| Test data seed/reset | **Partially implemented** | Workbook importer is for real data only; the synthetic generator and LocalDB harness from the 2026-10-14 test session (outside the repo) work end to end |
| GitHub Environments testing/production | **Missing** | Releases are manual `workflow_dispatch`; no `environment:` approval gates |
| Frozen-runtime protection | **Implemented** | `beta-freeze.js` / `beta-api-freeze.js` compare shipped bytes with the baseline commit. Every runtime change needs a separate governance promotion commit |

## 3. Design

1. **One explicit environment identity everywhere.** `PAWS_ENVIRONMENT` must be `production` or `testing`; anything else, including unset, refuses to start.
2. **The database declares its own identity.** A Testing database carries `paws_env.EnvironmentIdentity` (`testing` + a UUID). The Testing API refuses to serve unless that row matches `PAWS_TESTING_ENVIRONMENT_ID`. The Production API refuses to serve if the table says `testing`. Testing config also rejects SQL servers on a production deny-list. There is no fallback in either direction. A misconfigured deployment fails closed instead of guessing.
3. **The frontend environment is fixed at build time.** `config/environments/{production,testing}.json` (non-secret: environment, label, API origin, Firebase web config, peer site URL) is rendered into `paws-api-origin.js` by `tools/render-environment-config.js`. The committed file stays the production rendering, enforced by test. All Firebase consumers read the config instead of hard-coding it. Nothing in the browser can switch the API or database at runtime.
4. **The switcher only navigates.** A new shared `paws-environment-nav.js` shows the persistent environment strip and buttons on every page. "Open Testing Environment" navigates to the separately deployed Testing site, passing only the page path (allow-listed), never a token. Testing requires its own sign-in, because it uses a separate Firebase project.
5. **Testing personas reuse Developer Support.** When the server environment is `testing`, `support-service.js` lets developer and administrator roles start a context. They can never assume a role above their own. The real actor stays on every operation and audit row, and the 30-minute expiry and "Return to myself" keep working. Production behaviour is unchanged: developer only, same checks.
6. **Testing writes.** These are set by the Testing deployment's own gate values (all implemented gates on), not by code. Business rules stay untouched.
7. **Testing DB tooling.** `tools/testing-db/` holds a deterministic synthetic generator, a Node reset runner (tedious/Azure SQL or msnodesqlv8/LocalDB), the marker, the migrations with the documented test-only adaptations, the seed and verification. The runner refuses any database without the testing marker, unless the database is completely empty.
8. **CI/CD.**
   * The build creates both artifacts from the same commit and checks environment configuration and freezes on both.
   * New `paws-testing-deploy.yml` (GitHub Environment `testing`) deploys automatically after a green main build.
   * Production release workflows gain `environment: production` (required reviewers) plus environment-identity checks.
   * Existing provenance checks are kept unchanged.

## 4. Risks

* **Freeze governance.** Every frontend or API runtime change needs a reviewed baseline promotion. This branch carries the product commit plus a separate governance commit, both for review.
* **Production entry point now needs `PAWS_ENVIRONMENT=production`.** The University API Windows service and any ACA app must set it before the next deploy, or they refuse to start. Fail closed is intentional; the deploy docs and template are updated.
* **Migrations aren't fully reproducible on an empty database** (003 invalid, 006 single-batch, 015 hard-coded principal, 007 live-state check). The Testing runner applies documented adaptations without changing the production migration files.
* **Infrastructure needs the owner** (Firebase project, Azure SQL, ACA app, GitHub Environments and secrets). This branch ships templates and exact steps; live deployment can't be claimed until those exist.
* **The Developer Support write path** could only be exercised on LocalDB with the legacy ODBC driver, which failed with a driver-level error. It must be re-validated on Azure SQL.
