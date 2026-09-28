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
| `server` | 40 pass / 0 fail |
| root | 357 pass / 1 fail / 29 skipped |
| Python | 64 pass / 0 fail |

The single root failure is the pre-existing environment-only
`spawnSync pwsh.exe ENOENT` in `tests/hosting-boundary.test.js` (no `pwsh` on
this machine), present on the base commit as well.

## 7A. Live finding — the 405 contract needed a binding change

PR #22 CI was green, but the live deployment surfaced something the PR-time
tests could not: `POST /api/v1/dashboard/summary` returned **404**, not 405.
Azure Functions' route matcher answers a method the function was not bound for
with 404 before any handler runs, so binding the Dashboard routes to `GET` only
made the reviewed 405 contract unreachable over the wire.

Fix: bind the three Dashboard routes to `GET, POST, PUT, PATCH, DELETE, HEAD,
OPTIONS` and let the wrapper own the 405 verdict (with its `Allow: GET` header).
The three timetable routes stay `GET`-bound. Test `N2` now pins the binding.

Lesson worth carrying forward: a wrapper-level unit test cannot see an
Azure-Functions host-level routing decision. Only a live probe can.

## 7B. Deployment

| Item | Value |
|---|---|
| Merged `main` | `983e6ab577054162e1cbd0bc7de8c9c1d4443c24` (true merge, PR #22) |
| Main build run | `36369400775` SUCCESS |
| ACR publish run | `36369556506` SUCCESS |
| Image | `pawssqlbetaacr.azurecr.io/paws-sql-beta-api:983e6ab577054162e1cbd0bc7de8c9c1d4443c24` |
| Image digest | `sha256:e5488e2b1bd337ce5796fb91be2879db898ef70ae9473c3c0bc29243d32934bf` |
| ACA revision | new revision, Healthy/Provisioned, 100% traffic |
| SWA | not deployed |

Live probes: `health/sql` 200; `/api/v1/sessions` 401; `/api/v1/dashboard/summary`
401; `/api/v1/dashboard/faculty` 401. The first `health/sql` on the new revision
was 503 after a 15 s SQL handshake (ACA cold start), 200 in 48 ms immediately
after.

## 7C. Live finding — the runtime principal is not the reviewed principal

This is the most consequential finding of R4D-10A, and it was only visible from
the live database.

The reviewed permission contract addressed a contained database user named
`paws_swa_beta`. Querying `teaching-assignment-lab` directly showed that
principal **does not exist**. The database contains only `dbo`, `guest`,
`INFORMATION_SCHEMA`, `sys` and **`paws-sql-beta-mi`** (an `EXTERNAL_USER`), and
the deployed runtime authenticates as that managed identity.

Its live permission set was exactly the R4D-9J2 set — `CONNECT`; column-scoped
`SELECT` on `paws.UserProfile` (`FirebaseUid, DisplayName, BaseRole, FacultyId,
Active, MustChangePassword`) and `paws.SessionAssignment` (`SessionId,
FacultyId`); whole-object `SELECT` on `paws.vCalendarSession`; `DENY
INSERT/UPDATE/DELETE/EXECUTE` on `SCHEMA::paws`; `DENY SELECT/INSERT/UPDATE/
DELETE/EXECUTE` on `SCHEMA::staging`; zero role memberships; 19 rows in total.

**`paws.Faculty` was not granted at all.** So the Dashboard `faculty` and
`faculty/:id` routes would have failed at runtime with a permission error, and
the `GRANT … TO [paws_swa_beta]` the reviewed script contained would have been
inert — it would have granted to a principal nobody authenticates as.

Remedy:

1. parameterize `004_swa_beta_permissions.sql` and the read-only proof on
   `$(PAWS_API_PRINCIPAL)` (default unchanged, so an unparameterised run behaves
   exactly as reviewed);
2. update the Node test `P` and the Python contract tests to **require** the
   binding and reject a hardcoded principal;
3. add `apply-dashboard-grant.ps1` — an additive-only, fail-closed operator
   wrapper that proves the principal's properties, supports an offline
   `-SkipConnection -SnapshotPath` rehearsal and `-EmitSql`, and refuses to stack
   a grant on any unreviewed permission surface;
4. verify the 12 granted columns against the live `paws.Faculty` definition.

Lesson worth carrying forward: a permission script that names its principal by
literal can pass every static test and CI check while being a **no-op** on the
real database. The principal name is a fact about the deployed environment, not
about the repository — it has to be read from the environment.

## 7D. Live finding — PowerShell 5.1 param block placement

`apply-dashboard-grant.ps1` initially failed to parse with `Unexpected attribute
'CmdletBinding'`. The cause was not the `-WhatIf` logic: PowerShell 5.1 requires
`[CmdletBinding()] param(...)` to precede **every executable statement** in a
script. Having `Set-StrictMode -Version Latest` / `$ErrorActionPreference` first
made the param block unparseable. Minimal reproduction confirmed it
(`param` first → 0 errors; one statement first → 2 errors).

Fix: `Set-StrictMode` / `$ErrorActionPreference` now follow the param block.
A secondary trap in the same file: a backtick line-continuation inside the
comment header.

## 8. Open items

* apply the additive `paws.Faculty` grant to live `paws-sql-beta-mi` and re-run
  the read-only proof against that principal;
* authenticated live acceptance for Account A (`adfa@ucalgary.ca`) and Account B
  (`xinyu.zhu1@ucalgary.ca`) — both are `adfa_general`, `Active=True`,
  `MustChangePassword=False`, and neither carries a `FacultyId`;
* re-run the full local suites on the merged `main`.

## 9. Out of scope, deliberately

Dashboard frontend switch, SWA deployment, `other_office`, Firestore fallback,
and any UI change.
