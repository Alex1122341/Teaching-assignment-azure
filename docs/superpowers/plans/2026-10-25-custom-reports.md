# Custom Reports23–25 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement sequentially. Native execution and final independent whole-branch review follow the owner's existing selection. Steps use checkbox syntax.

**Goal:** Owner/admin can select report families, columns, typed filters and sorting, preview paginated results and download matching CSV/Excel.

**Architecture:** Approved server registry and trusted existing SQL/API read adapters produce separate, bounded result tables. One private10-minute snapshot drives preview/page/export, with current auth checks. Dashboard lazily loads a vanilla Reports controller; no SQL schema or business writes.

**Tech Stack:** Existing vanilla HTML/CSS/JS, Node22/CommonJS, Firebase token + SQL profile, existing SQL repositories/History API/DOE Worksheet, deferred existing ExcelJS.

**Spec:** `docs/superpowers/specs/2026-10-25-custom-reports-design.md`.

## Global constraints

- First release Owner/admin only, selected academic year current records; History independent. Keep legacy role helpers and support-route denial.
- Preserve source identity/evidence, DOE math/write gates, audit/approval/SWAP contracts, no Firestore fallback or SQL DDL/DML/import.
- Names use existing server/frontend formatters; no UCID/email/raw UUID/audit metadata columns.
-32 columns/source,20 conditions/source,50-row pages,5000 result rows/source,10000 total result rows,200000 selected cells,6MiB snapshot/export,10-minute TTL,2own/8global snapshots,2global/1own queries,1export globally. Source normalization itself fails above10000 rows/source; no silent truncation.
- Query edits invalidate preview; CSV current table, Excel all selected tables, copy current page. No arbitrary SQL/joins or generic numeric aggregation.
- Work time defaults are display-only; role DOE is whole-appointment and not additive across validity periods; incomplete DOE remains null/Needs Review.
- Base published mainc0970caf;93static/119API. Reuse existing isolated worktree under new branch feat/custom-reports-20261025 and preserve prior publication documentation. Fresh exact-base CI40258712593 and identical-tree local serial1235pass/0fail/53skip are baseline evidence; do not rerun broad baseline before any new behavior.

## Review focus

- Unknown/missing filters cannot broaden a confidential query: strict closed schemas, typed predicates and explicit blank operators.
- A faculty with multiple teaching roles/periods must not cross-multiply workload counts or DOE; stable IDs only, no display-name matching.
- Changing source/columns/year or identity while query/export is pending cannot expose an old snapshot.
- Partial dates/times/DOE stay missing/review, and repeated period DOE never becomes an implied sum.
- Source failure/over-limit and XLSX serialization delay cannot return a truncated or newly unauthorized artifact.

## Task1 — Registry and pure typed query kernel

Files: create `server/src/reports/report-definition.js`, test `server/test/report-definition.test.js`.

Interfaces: `catalog()` returns sources/fields/defaults/operators/limits; `validateDefinition(input)` returns canonical `{academicYear,start,end,datasets:[{source,columns,search,match,filters,sort}]}` or typed400 error; `runTable(source,rows,definition)` returns `{source,label,columns:[{id,label,type,unit}],rows:[][],total,coverage}` with only selected fields. Fields live in this registry only; output is not raw source objects. Use canonical academic-year helper and strict literal values.

- [x] RED a worked example selecting facultyName/remainingDoe, numeric>=0 with unknown null excluded, tokens across canonical names, AND/OR, column order and stable sort. Assert literal expected rows; test empty vs0.
- [x] Implement minimum catalog/validation/predicate/projection. Add RED malformed year, unknown/duplicate fields/keys/operators, zero columns,21 filters, oversized columns, invalid dates/numbers and output limits; GREEN each slice.
- [x] `node --test server/test/report-definition.test.js` passes; commit kernel.

## Task2 — Trusted source adapters / cardinality

Files: create `server/src/reports/report-sources.js`, test `server/test/report-sources.test.js`; extend only the read signature in `server/src/data/sql-session-repository.js`, test `server/test/report-source-scope.test.js`.

Interface: `createReportSources({dashboard,sessions,activities,worksheetService,historyApi})` returns `load({definition,uid,token}) -> {tables:{[source]:{rows,coverage}},expiresAt?}`. Readers use existing parameterized repository methods and actor-scoped activity list with admin mapping. Per-query promise cache shares reads across selected families; no cross-user raw-data cache. Historical reads call existing authorized History query/page, not raw audit rows. Catch source failure as a complete-query failure.

- [x] RED real-shape DTO fixture: two assignments for same teacher/session count once,2 role periods keep gaps and same non-additive whole-role value, one Locum and opaque mapped work identity, null Worksheet values, differing recorded/engine totals. Exact expected summary/details/period rows.
- [x] Implement only selected sources using stable IDs; normalize approved fields, actor-scoped bounded activity cursors, selected academic year overlap, canonical names and missing values. Preserve work evidence/default-time labels; no credit/hours from defaults. No source mutation.
- [x] RED unmapped identity, malformed source/cursor,>10000 source rows, outside-year/unknown date coverage and History field expansion/raw From-To preservation. GREEN; commit adapter.

## Task3 — Authenticated snapshot / export API

Files: create `server/src/reports/report-api.js`, `report-export.js`, `server/src/runtime/swa-report-functions.js`; tests `server/test/report-api.test.js`, `report-export.test.js`, `report-functions.test.js`.

Interfaces: `createReportApi({verifyToken,findUser,loadSources,clock?,randomId?,renderExport?})` exposes `catalog(token)`, `query(token,definition)`, `page(token,{snapshot,source,offset})`, `export(token,{snapshot,format,source?})`. Responses follow existing `{status,body}`; exports use History-style bounded base64 artifact transport. API page size50, UUID handles, current UID/role binding, TTL/min History expiry, cache/query/export caps. `createReportFunctions({api})` mounts `/api/v1/reports/catalog` GET, `/query` POST, `/page` GET, `/export` GET; closed query keys/duplicate rejection, no-store, bounded JSON,405 for wrong verbs.

- [x] RED anonymous/Faculty/office/inactive denied before reader; authorized Owner/admin succeeds. Mutation/unknown request values rejected; source exception creates no snapshot. GREEN smallest API.
- [x] RED UID/role replacement during await, cross-owner handles, expiry, bad offsets/table, concurrency, eviction/memory caps and after-render authorization changes. GREEN; preserve safe limited/busy errors without weakening auth failure clears.
- [x] RED CSV quoting/formula-prefix/negative typed numbers, nullN/A and correct column order; actual ExcelJS readback sheets/types/rows, no excluded fields,6MiB/cell limits. GREEN; export service requires existing ExcelJS lazily.
- [x] Run three tests and definition/source regressions; commit.

## Task4 — Runtime and client transport integration

Files: modify `server/src/runtime/swa-sql-runtime.js`, `swa-api/index.js`, `frontend/scripts/paws-data-client.js`; tests `server/test/report-runtime.test.js`, `tests/report-client.test.js`, existing runtime suites.

Interfaces: trusted runtime wires source loader to existing dashboard/session/activity repositories, DOE Worksheet service and shared History API. Do not expose data API writes or alter their gates. Client methods `reportCatalog`, `reportQuery`, `reportPage`, `reportExport` use current authenticated request wrapper and existing artifact validation. Query POST is read-only; no SQL mutation.

- [ ] RED exact reports path dispatch and source wiring with denied-role/no-write assertions. Add source to existing Functions packaging route declarations; preserve runtime health/gate count and support denial.
- [ ] Implement minimal wiring and bounded client transport. RED malformed artifact/base64/oversize/unsupported query fields and Unicode columns; GREEN. Run runtime/dependency graph tests and commit.

## Task5 — Lazy admin Reports builder

Files: create `frontend/scripts/faculty-reports.js`, `frontend/styles/faculty-reports.css`; modify `frontend/pages/faculty-admin.html`, `frontend/scripts/faculty-admin.js`, `asset-loader.js`, `tools/static-assets.json`; tests `tests/faculty-reports.test.js`, `faculty-reports-integration.test.js`.

Interfaces: `PAWS_REPORTS.mount(host,{api,getUser,getAcademicYear}) -> {refresh?,destroy}`; loader `createReportEntry(options)->{open,clear}`. Catalog drives controls, types, default columns and dataset choices; implementation owns no SQL/DOE rules. New admin-only reports tab and panel; not added to self-mode allowed list. Auth/tab reset clears private state and any late module/query/download completion.

- [ ] RED source/columns/order/filter AND-OR/sort query construction, no empty-column execution, definition edits disable previous export, source tabs/page counts and explicit CSV/Excel scope. GREEN; native accessible controls, escaped data, numeric alignment.
- [ ] RED identity/role/year/tab changes during catalog/query/export, stale responses, empty/error/Retry,50-row paging, copy current page and safe artifact download. GREEN; preserve AFC/PDF/Trainees/approval lazy boundaries.
- [ ] Run related Dashboard/auth/asset tests; adjust exact allowlists/counts only for reviewed additions, retain Firestore/privacy/deferred guards; commit product.

## Task6 — Browser, independent review and governance

- [ ] Build static preview. Use CUA actual shipped component fixtures with synthetic data, desktop/narrow, long names, multi-period, null/0, loading/error/empty, large pages, keyboard, actual CSV/Excel values. Save comparable before/after; no real confidential screenshots in public Git.
- [ ] Independent full branch spec/standards reviews through installed code-review skill; reproduce/fix actionable findings RED→GREEN and recheck. Product commit first.
- [ ] Separate independent freeze promotion to exact reviewed product, full static union/new API dependency closure, historical receipts pinned; algorithms unchanged. Full root/server/emulator/build/source+artifact freeze and necessary isolated SQL regression CI; no production test data.

## Task7 — Controlled coordinated release / tracker

- [ ] PR merge only after review and full exact-head checks. Verify exact-main push CI, official ZIP digest/safe extraction/all freezes; save prior approved artifact/runtime/recovery configuration for rollback.
- [ ] Stage University API on isolated loopback port using reviewed scripts and current27 gates. Validate runtime manifests, normal Owner/admin report reads/CSV/XLSX, denied Faculty and existing health/critical read routes; no writes.
- [ ] Coordinated API + Hosting release using reviewed official artifact; update recovery manifest/config atomically as required by existing runbook, not trust-anchor bypass. Verify public files, exact API SHA/trust/input manifests, gates/API/SQL/401/CORS/native RecoveryCheckOnly and real read-only UI; rollback if failed.
- [ ] Update original progress Excel23–25, preserve styles/formulas/human signoffs and existing counts; record exact acceptance boundaries and outstanding user signoff. Refresh repository continuity.

## Execution rulings / checkpoint

- Ruling: add optional canonical `academicYear` predicate to existing SessionRepository.list, preserving ordinary range callers — otherwise a date-only reader silently loses undated sessions, while reading all years delivers unnecessary rows. Validate canonical year and bind it as @academicYear; no new SQL schema/write path. Work range dates continue to use overlap, not annual appointment metadata.

- Reuse existing linked worktree, create new branch at verified published main; no second worktree or dependency reinstall. Prior post-release notes are preserved and included as continuity, not runtime changes.
- Existing support-service allowlist denies `/reports`; do not broaden it just to make impersonation work. Normal supported Owner/admin sessions can query; return to real identity for reports.
- Preview freezes selected authorized results for download, not a serializable cross-domain database snapshot. No past-state reconstruction is promised.
- Plan self-check: requirements23/24/25 map to kernel+sources/API+UI and release; each review-focus case has an explicit test task; names/interfaces above are fixed. Technical defaults follow standing recommended-option authority; continue sequentially without routine confirmation loops.

Task1 checkpoint: pure registry/query kernel completed with observed RED→GREEN cycles (module absent; missing catalogs; strict schema; predicates/sort).6 tests pass. No runtime wiring, API/SQL/production changes yet. Remaining tasks2–7 continue sequentially.

Task2 checkpoint:14 foundation tests pass; existing repository/session-write26 regression tests pass. Observed RED→GREEN for source absence, empty periods, wrong-year Worksheet, History loading and unsupported category. Parameterized academicYear session reader preserves undated records; ordinary range behavior remains verified. Empty appointment periods are represented as an explicit No effective periods metadata row (period=null), not a fabricated interval. Current adapters remain unmounted; no production reads/writes or publication.

Task3 checkpoint:29 targeted tests pass, including private snapshot concurrency/expiry, all-selected XLSX scope, projection memory limits and actual Excel numeric alignment RED→GREEN. Target clarification resolved by owner on2026-10-26:continue Teaching-assignment-azure/Beta/SQL. The downloaded AGENTS repository/architecture note was corrected at owner request. No report runtime wiring or deployment yet.
