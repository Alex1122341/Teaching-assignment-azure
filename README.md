# PAWS Beta

Faculty teaching assignment, timetable and workload administration for UCVM. This is the controlled Beta repository, not the Experimental track.

## Repository map

| Directory / entry | Contents |
| --- | --- |
| [frontend/](frontend/README.md) | Browser pages, scripts, styles and public form templates |
| server/src/ | University Node API, authorization and business-domain logic |
| server/test/ | API and SQL-domain tests |
| database/ | SQL schema, migrations, permissions and rollback evidence |
| tests/ | Browser, build, security and immutable-release regression tests |
| test-support/ | Shared test harness and source-contract helpers |
| tools/build/ | Shared static packaging and source-path utilities |
| tools/ | Operational, migration and release tools; inspect each runbook before use |
| deploy/windows/ | University-hosted runtime and recovery setup |
| docs/ | Architecture, operations, accepted designs and historical evidence |
| agent.Ai/ | Agent continuity and decision records, not runtime code |
| .github/workflows/ | CI and separately authorized release workflows |

## Development

Use Node.js 22. Install locked dependencies with `npm ci`, `npm ci --prefix server` and `npm ci --prefix swa-api`. Run `npm test`; `npm run test:emulator` includes Auth/Firestore security tests.

- `npm run build`: the Firebase static application in `.deploy-static/`.
- `npm run build:release`: the existing combined CI artifact.
- `node tools/verify-beta-candidate.js`: immutable static/API checks.

These commands do not publish a release. Serve the generated static folder, not `frontend/pages`, because production URLs intentionally remain flat.

## Deployment boundary

The active path is Firebase Hosting + Firebase Authentication -> University Windows Node API -> VetMed-Ops SQL Server. Firebase configuration stays at the root for CLI compatibility. The Azure retirement and directory cleanup do not authorize database changes, API upgrades or publishing.

The historical `swa-api/`, `deploy/aca/` and `.azure-production` build contract remains pending a separate non-DB Azure deployment migration; it is not a recommendation to deploy new Azure services. See [SETUP.md](SETUP.md), [AGENTS.md](AGENTS.md), and [the Azure audit](docs/azure-frontend-retirement-audit-20261022.md).

The repository layout changes source locations only: all 95 public paths and file contents are preserved (current count per `tools/static-assets.json`; 85 was the PR133 checkpoint count). No source aliases or duplicate frontend files remain at the root.
