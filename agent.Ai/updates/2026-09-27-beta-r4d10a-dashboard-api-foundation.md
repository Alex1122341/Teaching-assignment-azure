# Agent Update — BETA-R4D-10A Dashboard Azure SQL read API foundation

**Date:** 2026-09-27
**Repository:** `Alex1122341/Teaching-assignment-azure`
**Task status:** IMPLEMENTED ON BRANCH / TESTS GREEN / PR PENDING

## 1. Goal

Establish the read-only Azure SQL foundation for the Dashboard API without
switching the Dashboard frontend: three `GET` routes, a server-authoritative
role/scope model, least-privilege column grants, and a full acceptance test
matrix A–P.

## 2. Starting breakpoint

- base branch: `main`
- base SHA: `7c0d857ed48ca5864aea78e58502066b568004d1` (true merge commit of PR #21 /
  BETA-R4D-9J2)
- working branch: `feature/beta-r4d10a-dashboard-api-read`
- prerequisite satisfied: Phase A (R4D-9J2) committed, validated, merged, and
  fresh `origin/main` confirmed before any Phase B work started.

## 3. Work performed

- added a read-only Azure SQL Dashboard repository;
- added the Dashboard API handler with the administrator / self-service / denied
  role model and the ordered pre-SQL gates;
- added a Dashboard HTTP wrapper that owns 405-vs-404 and `Allow: GET`;
- extended the least-privilege permission script and its reviewed-contract guard
  for the `Faculty` column allow-list;
- added an effective-permission read-only proof script;
- added acceptance tests A–P plus Python and release-artifact contract cases;
- wired the three routes into the Functions entry point.

## 4. Files / components changed

New:

- `server/src/data/sql-dashboard-repository.js`
- `server/src/data/dashboard-api.js`
- `server/src/runtime/swa-dashboard-functions.js`
- `database/azure-sql/004_swa_beta_permissions_readonly_proof.sql`
- `server/test/dashboard-api.test.js`
- `docs/beta-r4d10a-dashboard-api-foundation.md`
- `agent.Ai/updates/2026-09-27-beta-r4d10a-dashboard-api-foundation.md`

Modified:

- `server/src/runtime/swa-sql-runtime.js` — mounts the Dashboard wrapper for
  `/api/v1/dashboard/` and delegates everything else to the unchanged timetable
  wrapper.
- `swa-api/index.js` — registers three `GET` Dashboard routes.
- `database/azure-sql/004_swa_beta_permissions.sql` — column-scoped
  `paws.Faculty` `SELECT` grant plus the matching guard allow-list.
- `tests/python/test_beta_sql_runtime_contract.py` — four new contract cases.
- `tests/beta-runtime-artifact.test.js` — route registration assertions.

## 5. Architecture / invariants affected

* The reviewed timetable wrapper (`server/src/runtime/swa-functions.js`) is
  byte-identical; the Dashboard surface is a sibling, not a modification.
* `tools/beta-baseline.json`, `tools/static-assets.json`, and every protected
  runtime asset are untouched. The frozen-baseline check still reports zero
  protected drift.
* No `other_office` role is introduced anywhere.

## 6. Authorization decisions worth recording

* `GET /dashboard/faculty` is administrator-only. A faculty-scoped caller is
  denied rather than silently rewritten to its own record — silently narrowing
  would make the route's contract ambiguous and could mask a UI bug.
* A faculty-scoped caller requesting another FacultyId receives **403**, not
  404, so the response never confirms that an unrelated FacultyId exists.
* The `FACULTY_LINK_REQUIRED` gate fires before any repository call, asserted by
  call-count checks.

## 7. Tests / CI evidence

| Suite | Result |
|---|---|
| `server` | 39 pass / 0 fail |
| root | 357 pass / 1 fail / 29 skipped |
| Python | 64 pass / 0 fail |

The single root failure is the pre-existing environment-only
`spawnSync pwsh.exe ENOENT` in `tests/hosting-boundary.test.js` (no `pwsh` on
this machine), present on the base commit as well.

## 8. Open items

* push the branch and open the PR;
* wait for green CI;
* merge with a normal merge commit;
* deploy ACA on the exact merged `main` SHA (no SWA deployment);
* live acceptance: health 200, unauthenticated 401, and authenticated reads for
  Account A (`adfa@ucalgary.ca`) and Account B (`xinyu.zhu1@ucalgary.ca`).

## 9. Out of scope, deliberately

Dashboard frontend switch, SWA deployment, `other_office`, Firestore fallback,
and any UI change.
