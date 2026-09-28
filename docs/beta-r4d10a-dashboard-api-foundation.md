# BETA-R4D-10A — Dashboard Azure SQL read API foundation

**Branch:** `feature/beta-r4d10a-dashboard-api-read`
**Base:** `main` @ `7c0d857ed48ca5864aea78e58502066b568004d1` (post R4D-9J2 merge)
**Scope:** backend only. The Dashboard frontend is **not** switched in this change.

## 1. Why

The Dashboard currently reads Firestore. BETA-R4D-10A establishes the Azure SQL
read foundation the Dashboard will eventually sit on, without touching the
frontend. This step is deliberately additive: new routes, new repository, new
grants, new tests. Nothing that exists today changes behaviour.

## 2. Routes

All three are **GET only**, `authLevel: anonymous` at the Functions layer so the
API itself owns the 401 (an anonymous-layer bind is how every existing PAWS Beta
route is registered).

| Route | Authorization |
|---|---|
| `GET /api/v1/dashboard/summary` | administrator **or** faculty-scoped (self-scoped) |
| `GET /api/v1/dashboard/faculty` | administrator only |
| `GET /api/v1/dashboard/faculty/:facultyId` | administrator any id; faculty-scoped only its own id |

Any other method on any of these paths returns **405** with `Allow: GET`. An
unknown path returns 404, so the wrapper's ownership boundary is observable.

### Why the routes are bound to every common method

This is load-bearing, and it was found on the live deployment rather than in
review. Azure Functions' route matcher resolves a request whose method was not
bound to the function to **404**, before any handler executes. Binding the three
Dashboard routes to `GET` only therefore produced `POST /api/v1/dashboard/summary
→ 404` over the wire, which contradicts the reviewed contract.

The fix binds the Dashboard routes to `GET, POST, PUT, PATCH, DELETE, HEAD,
OPTIONS` and lets `swa-dashboard-functions.js` produce the 405 itself. The 405
verdict is now the runtime's, not the host's, and it carries the `Allow: GET`
header the host would never have set. The three timetable routes stay `GET`-bound
because their reviewed contract is unchanged and a 404 there is not a regression.

Test `N2` pins this binding so a future "tidy up to GET" edit cannot silently
reintroduce the 404.

Optional query string: `academicYear` (validated `YYYY-YYYY`, default
`2026-2027`), plus `search` and `limit` on the roster route (limit clamped
1–500).

## 3. Authorization model

| Role | Class | Behaviour |
|---|---|---|
| `owner` | administrator | full Dashboard read |
| `administrator` | administrator | full Dashboard read |
| `adfa_general` | administrator | full Dashboard read |
| `adfa_regular` | administrator | full Dashboard read |
| `admin` | administrator | full Dashboard read |
| `faculty` | self-service | own summary and own faculty record only |
| `hicc` | self-service | own summary and own faculty record only |
| `visc` | self-service | own summary and own faculty record only |
| `viewer` | denied | 403 `ROLE_DENIED` on every Dashboard route |
| anything else | denied | 403 `ROLE_DENIED` |

`other_office` is **not introduced**. It is asserted against explicitly so a
future addition cannot silently become a Dashboard role.

Additional gates, applied in order before any SQL is touched:

1. profile missing or `active !== true` → 403 `PROFILE_REQUIRED`
2. `mustChangePassword === true` → 403 `PASSWORD_CHANGE_REQUIRED`
3. role not in the supported set → 403 `ROLE_DENIED`
4. faculty-scoped role with no linked FacultyId → 403 `FACULTY_LINK_REQUIRED`
5. faculty-scoped caller requesting another FacultyId → 403 `ROLE_DENIED`
   (deliberately 403, not 404, so the response cannot confirm that an unrelated
   FacultyId exists)

Scope is enforced as a **server-side SQL predicate**
(`sa.FacultyId = @facultyId`), never by hiding fields in a response the caller
already received.

## 4. Repository

`server/src/data/sql-dashboard-repository.js` — new, read-only.

* reads `paws.vCalendarSession`, `paws.SessionAssignment`, `paws.Faculty`;
* never references `staging`;
* never emits a mutation verb (statically asserted);
* binds every caller-supplied value as a parameter (`@facultyId`,
  `@academicYear`, `@search`); no value is spliced into SQL text;
* returns `null` for a malformed or unknown FacultyId without querying.

Dashboard data comes **exclusively from Azure SQL**. There is no Firestore read
anywhere on this path, and that is statically asserted.

## 5. SQL permissions

`database/azure-sql/004_swa_beta_permissions.sql` is extended, not relaxed:

```sql
GRANT SELECT ON OBJECT::paws.Faculty
    (FacultyId, RecordType, PreferredFirstName, PreferredLastName, DisplayName,
     Ucid, Email, Stream, Rank, Fte, ReportsToFacultyId, Active)
    TO [paws_swa_beta];
```

The reviewed-contract guard in the same script is extended with the matching
allow-list, so **any** unreviewed permission on this principal still throws
`51002`. In particular `SourceImportBatchId` and `SourceRow` are deliberately
excluded from the `Faculty` grant, and DOE / creditable-hour columns on
`SessionAssignment` remain unreadable.

The schema-wide `DENY INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::paws` and
`DENY SELECT, … ON SCHEMA::staging` remain in force, so the change widens the
read surface without widening the mutation surface.

### Read-only proof

`database/azure-sql/004_swa_beta_permissions_readonly_proof.sql` — new. Run as
`db_owner` after applying the grant script. It throws on the first violation and
prints `READ_ONLY_PROOF_OK` only when:

* the principal holds no `INSERT/UPDATE/DELETE/MERGE/EXECUTE/ALTER/CONTROL`
  grant anywhere;
* there is no `SELECT` grant of any kind on `staging`;
* the mutation `DENY` rows and the `staging` `SELECT` `DENY` row are present;
* the principal holds no database role;
* `HAS_PERMS_BY_NAME` returns 0 for every mutation verb probed (this is the
  effective check — it accounts for role and `DENY` inheritance);
* every granted whole-object `SELECT` is the single reviewed view.

The file itself performs no mutation.

## 6. Tests

`server/test/dashboard-api.test.js` — new, 18 cases labelled A–P matching the
task acceptance matrix: admin access, the exact administrator role set,
self-service scoping, `viewer` denial, `other_office` denial, the
`FACULTY_LINK_REQUIRED` gate, predicate-not-filter scoping, roster
administrator-only, own-record-only detail access, 404/400 handling without SQL,
401 before SQL, inactive and password-change gates, 503 without leakage, 405 with
`Allow: GET` for six methods on three routes, static read-only/staging/Firestore
scanning, and the permission-script contract.

`tests/python/test_beta_sql_runtime_contract.py` gains four contract cases:
repository read-only/SQL-only, column-scoped grant, proof-script shape, and the
no-mutation-verb scan.

`tests/beta-runtime-artifact.test.js` gains assertions that the three new routes
ship in the release artifact and that no non-GET method is registered.

### Results

| Suite | Result |
|---|---|
| `server` (`node --test test/*.test.js`) | **40 pass / 0 fail** |
| root (`node --test tests/*.test.js`) | **357 pass / 1 fail / 29 skipped** |
| Python (`unittest`, 12 modules) | **64 pass / 0 fail** |

The single root failure is the pre-existing environment-only
`spawnSync pwsh.exe ENOENT` in `tests/hosting-boundary.test.js`; `pwsh` is not
installed on this machine. It is unrelated to this change and present on the
base commit too.

The frozen-baseline check (`tools/verify-beta-candidate.js`) still reports zero
protected drift: no protected frontend asset was touched.

## 6A. Live deployment

| Item | Value |
|---|---|
| Merged `main` | `983e6ab577054162e1cbd0bc7de8c9c1d4443c24` (true merge commit, PR #22) |
| Main build run | `36369400775` SUCCESS |
| ACR image | `pawssqlbetaacr.azurecr.io/paws-sql-beta-api:983e6ab577054162e1cbd0bc7de8c9c1d4443c24` |
| Image digest | `sha256:e5488e2b1bd337ce5796fb91be2879db898ef70ae9473c3c0bc29243d32934bf` |
| ACR publish run | `36369556506` SUCCESS |
| ACA revision | new revision, `Healthy` / `Provisioned`, 100% traffic |
| SWA | **not deployed** (this step is backend-only) |

Live probes:

| Probe | Result |
|---|---|
| `GET /api/health/sql` | **200** `{"status":"ok","service":"paws-beta-sql-runtime"}` |
| `GET /api/v1/sessions` (no token) | **401** `UNAUTHENTICATED` |
| `GET /api/v1/dashboard/summary` (no token) | **401** `UNAUTHENTICATED` |
| `GET /api/v1/dashboard/faculty` (no token) | **401** `UNAUTHENTICATED` |

Cold-start note: the first `health/sql` call on the new revision returned 503
after a 15-second SQL pool handshake; the immediately following call returned 200
in 48 ms. This is the known Azure SQL cold-connection behaviour on a scaled-to-
zero ACA revision, not a regression — the second call is the steady state.

## 7. What this change does NOT do

* does not switch the Dashboard frontend to the SQL API;
* does not deploy SWA;
* does not add or use `other_office`;
* does not add a Firestore fallback;
* does not carry any Design or UI change;
* does not modify any protected runtime asset.

## 8. Follow-up

ACA deployment and live acceptance (health 200, unauthenticated 401, Account A
`adfa@ucalgary.ca`, Account B `xinyu.zhu1@ucalgary.ca`) follow the merge, on the
exact merged `main` SHA.
