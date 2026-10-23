# PAWS Demo alignment — living assessment

Updated 2026-10-23. Repository: Alex1122341/Teaching-assignment-azure. Current fetched main: `9734d2d9ba6cd927dbec3585838689f235ed0e9f`. Open PR136 is separate Phase1 at `0baedfefc35dd35be4f146e49e3615351f35ebb7`; PR125 is unrelated Testing infrastructure at `e584d42b42a53f142f58ee1c932961908ec9881d`. Recheck these mutable facts before integration. No merge or deployment is authorized by this UI initiative.

## Reference inspection and reuse

All four files in the supplied PAWS_Interactive_UI_Source.zip were inspected: HTML mounts, CSS foundations/responsive tables/drawers, app routes/renderers/event dispatch/save handlers, and README. The Demo is a 12-view local mock. Its default `overview`, fictional workload calculations, localStorage records, generated audit history, simulated approvals, unrestricted command search and all-access administrator are **not production contracts**. Adopt grouped navigation, contextual page actions, compact filtering, readable tables and responsive detail composition. Retain UCalgary red/gold, navy, existing light/dark tokens and the shared Last name, First name formatter.

The earlier public Timetable reference was inspected in the browser. Adopt dated weeks and compact filter controls, without copying its wrapping week rows or its data. Actual reference screenshots stay private. All committed acceptance screenshots must contain synthetic records only.

## Current inventory and priorities

| Area / entry point | Current status and reusable code | Demo improvement / next slice | Permissions and risks | Priority / acceptance |
|---|---|---|---|---|
| Teaching Schedule: index.html | Complete week/day/month/list, academic calculations, course multiselect, search/month/type filters, exports; Phase1 compact controls | Single dated week strip, independently removable content chips, period-preserving clear; then adaptive navigation | Existing authenticated session scope; do not alter filteredSessions/export AND/OR, My Timetable or session mutations | P0 in progress; dated keyboard weeks, independent course removal, no duplicate requests, 390–1920 widths |
| Global shell across five real HTML routes | Existing route buttons, shared faculty-access helpers, account/status/theme and Workspace Tasks | 224px expanded / 64px compact navigation, overlay when narrow; move existing authorized nodes rather than clone handlers | University API/SQL profile remains authoritative. Each route adapter must use current capabilities; no global confidential prefetch | P0 staged; Calendar remains normal entry for every role, preserve intentional routes |
| HICC–CC / VISC: Schedule dialogs | PR136 adds bounded keyword search, sort, clear; effective dates/status/public projection already present | Reuse existing dialog; don't build a second directory | Authenticated read-only public leadership fields; no DOE/email/UCID | Already improved in PR136; retain exact behavior |
| CCC Schedule: Schedule dialog | Existing year/search/refresh and date-range viewer | Consistent page/dialog header after shell | Existing authenticated API and complete-source replacement gates | P1; no migration/reimport |
| Faculty Dashboard: faculty-admin.html | Lookup, Availability, Summary, Roles, Trainees, DOE Overview/List/Rules, AFC Records tabs | Dense filters, consistent tables and existing detail views | Self mode allows only lookup/trainees/availability. Existing CSS depends on .tabs ancestry; moving tabs can expose UX and break guards | P1; authorized populated screenshots before edits |
| Roles & Appointments: Dashboard tab | Effective-period editor and SQL rowversion concurrency already implemented | Refine table/detail composition; reuse editor | Do not replace rowversion, stale-data errors or accepted scopes | P1; stale save remains rejected |
| AFC: Dashboard records + Schedule self-service | Existing upload/download/PDF/request and audit modules | Unified authorized records/create/document navigation | Other faculty never receive medical/reason details; confidential PDF gates remain | P1; test own/other scope and artifact access |
| Teaching Assignments: teaching-assignments.html | Queue/contributions/published/releases/publication views | Consistent page actions/search/statuses; preserve workflow views | Existing package lifecycle and version checks | P1; not a new flat mock assignments table |
| DOE: Dashboard tabs | Engine/worksheet/rules/overrides already present | Numeric alignment, units, denser filters | Do not copy demo formulas or browser policy writes | P2; server values and audit unchanged |
| History: Schedule dialogs, Changes, Dashboard History | Existing keyword/advanced filters/pagination/CSV | Consistent density and actions | Teaching history and administrative audits have different scopes | P2; do not widen history endpoint access |
| Conflicts: Workspace Tasks | Existing authorized issues/review/version/cursor handling | Better shell placement, overlay when content squeezed | No fake resolve action or leaked AFC reason; existing review is not conflict resolution | P0 layout / P2 detail; retain real controller |
| Reports / saved views | Existing scoped exports; no general report-builder backend | Preserve current exports; advanced builder is separate scope | No arbitrary SQL, mock saved views or new grants | P2 deferred; no empty menu entry |
| Overview / My Work | Existing task panel supplies useful authorized actions | Optional later role-aware composition | No fabricated badges or broad preload; never home | P3 deferred |
| Administration: user-management.html / password.html | Existing accounts, groups and credential form | Shell adapter later | Existing narrowly authorized role/account operations; no widened legacy role mapping | P1/P2; password handling unchanged |

## Navigation architecture decision

Three working local alternatives were inspected on the actual generated Schedule with synthetic data: A expanded dock, B compact/adaptive drawer, C on-demand drawer. Prototype captured on local branch `prototype/paws-ui-phase2-20261023`, commit `487bcbe`. It is not merged into production source.

Recommend **B**: expanded224px on wide screens, compact64px at1366/1440, overlay below1100. At1440, prototype A left1167px for Calendar, B1319px, C1383px. B preserves visible navigation while leaving152px more Calendar than A. At1920 with both panels docked the prototype retained1329px; at1440 both panels overlay rather than reducing Calendar width. Production width must use actual available content, not only viewport breakpoints.

Calendar stays first and remains the universal normal landing page. Existing faculty-access.js already retires automatic admin landing. Intentional Dashboard/Assignments/User Management/password URLs remain valid. An optional Overview is not introduced by P0.

Teaching group uses existing Schedule, Assignments, CCC, HICC–CC and VISC entry points. Faculty initially exposes the existing authorized Dashboard destination. Roles/Summary/DOE are existing Dashboard tabs, not new pages; defer global deep links until a whitelisted tab adapter respects self-mode and current guards. Workflows reuse SWAP, AFC Request and My Change History. Administration reuses User Management only where currently permitted. Session edit/create/select, views, My Timetable and exports stay Calendar-local.

## Six design rules

1. Keep UCalgary wordmark, red selected/primary states, gold separators and existing navy/white/light/dark tokens; no teal rebrand.
2. Use consistent36px controls,12px labels,13px body and18–20px headings with normal letter spacing and4/8/12/16px spacing.
3. Make Calendar the home; distinguish global destinations, existing dialog launchers and contextual operations.
4. Keep period selection separate from content filters; display real active state and make removal predictable without moving the academic period.
5. Use one dated scrolling week row with explicit selection, full accessible labels and keyboard/focus support.
6. Preserve content width and truthful scope: overlay panels before compressing the timetable, and never preload confidential data for navigation.

## Three priority problems and measured lessons

1. Fragmented global buttons and local actions make repeated navigation difficult. A single shell needs page adapters, not a second router or copied controls.
2. Week numbers hide dates; filters lack a visible removable summary. Reuse weekStart and the actual closure/picker state, preserving course/type OR within categories and AND between categories.
3. Both side panels and inherited CSS can consume or overlap Calendar space. The prototype exposed legacy relative top32px on the filter wrapper and max-content grid overflow. Explicitly reset the offset and use minmax(0,...) tracks; both are acceptance cases.

## Verification and limitations at inspection

Prototype: actual browser screenshots at1920/1440/1366/1024; one week row, no page overflow at1024(client1009/scroll1009/Calendar969px),1366 and1440;1920 two-panel Calendar1329px andclient1905/scroll1905. Multiple course removal, period-preserving clear, Previous/Next/week-key synchronization and drawer Escape checked. Prototype-only destination demos and disabled business actions do not prove real navigation or authorization.

Leadership sorting investigation: existing API sorts course/scope with numeric locale comparison, then role/name/date; missing scopes last. The earlier unsorted preview was a fixture problem. Two targeted server sorting tests and15 directory tests pass; no unrelated sort change needed.

Existing Calendar baseline suites:13 pass/0 fail/2 optional browser skips. Baseline full npm test on unchanged Phase1 runtime:1026 pass/4 fail/53 skip; failures include Git EPERM, historical coverage count drift during process failures, and PowerShell timeout. Earlier exact-head Phase1 CI was green. Diagnose/rerun these checks with reduced concurrency; do not claim this local run passed or alter frozen evidence to silence it.

Chrome authenticated reads previously timed out. Current visual evidence is synthetic local rendering; real-role/API positive/negative acceptance and production performance are not yet complete. Figma connection exists but no target file was supplied; no design file or real data was uploaded. No new dependency or backend infrastructure is required.

## Iteration status

**Selected execution:** latest owner directive requests demo-guided safe incremental implementation now, superseding the earlier design-only pause. Implement P0 as small reviewable slices with tests; do not merge/deploy. Current product branch `feat/paws-calendar-workspace-20261023` is based on PR136's head and must remain stacked/separate. Reassess after PR136 merges. Next: test and implement Calendar week/chip interaction, then the authorized Schedule shell; broader page adapters follow independently.
