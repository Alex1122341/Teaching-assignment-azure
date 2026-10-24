# PAWS Demo alignment — living assessment

Updated 2026-10-23. Repository: Alex1122341/Teaching-assignment-azure. Fresh GitHub main: `8bb40c60370bcce3d0135efd4327d42fba657903`, advanced from the inspection's `9734d2d9ba6cd927dbec3585838689f235ed0e9f` through merged PR137/138 (Role & Appointment SQL rowversion repairs). Open PR136 remains separate Phase1 at `0baedfefc35dd35be4f146e49e3615351f35ebb7`; PR125 is unrelated Testing infrastructure at `e584d42b42a53f142f58ee1c932961908ec9881d`. This phase is stacked on PR136, not an integrated latest-main candidate. Preserve those new role/API/migration changes and reconcile governance before integration. Recheck mutable facts before acting. No merge or deployment is authorized by this UI initiative.

## Reference inspection and reuse

All four files in the supplied PAWS_Interactive_UI_Source.zip were inspected: HTML mounts, CSS foundations/responsive tables/drawers, app routes/renderers/event dispatch/save handlers, and README. The Demo is a 12-view local mock. Its default `overview`, fictional workload calculations, localStorage records, generated audit history, simulated approvals, unrestricted command search and all-access administrator are **not production contracts**. Adopt grouped navigation, contextual page actions, compact filtering, readable tables and responsive detail composition. Retain UCalgary red/gold, navy, existing light/dark tokens and the shared Last name, First name formatter.

The earlier public Timetable reference was inspected in the browser. Adopt dated weeks and compact filter controls, without copying its wrapping week rows or its data. Actual reference screenshots stay private. All committed acceptance screenshots must contain synthetic records only.

## Current inventory and priorities

| Area / entry point | Current status and reusable code | Demo improvement / next slice | Permissions and risks | Priority / acceptance |
|---|---|---|---|---|
| Teaching Schedule: index.html | Complete week/day/month/list, academic calculations, course multiselect, search/month/type filters, exports; Phase1 compact controls | Implemented single dated week strip, independently removable content chips, period-preserving clear and adaptive navigation | Existing authenticated session scope; filteredSessions/export AND/OR, My Timetable and session mutations retained | P0 implemented and independently reviewed; synthetic browser acceptance at390–1920, real-role acceptance remains |
| Global shell across five real HTML routes | Existing route buttons, shared faculty-access helpers, account/status/theme and Workspace Tasks | Schedule adapter implemented:224px expanded /64px compact, overlay when narrow, existing authorized nodes moved with handlers intact | University API/SQL profile remains authoritative. Other route adapters must use current capabilities; no global confidential prefetch | Schedule P0 implemented; Calendar home contract retained; four cross-page adapters remain next scope |
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

**Selected execution:** latest owner directive requests demo-guided safe incremental implementation now, superseding the earlier design-only pause. P0 Schedule product is implemented on `feat/paws-calendar-workspace-20261023`, based on PR136's exact head. Final product `64477000a17ae885776f664a93480af0aaaf110f`; separate reviewed governance `6381fc87c1f08ff81c9f885ee5ae2a3449dcf3cb`. Keep stacked/separate and reassess after PR136 merges. No merge/deploy authorized by this brief.

**Delivered review:** draft [PR139](https://github.com/Alex1122341/Teaching-assignment-azure/pull/139), targeting PR136's feature branch. Published and attached to the task; no merge/deployment. PR136 and PR125 remain separate. Current-main integration and real-role acceptance remain required as described above.

Implementation reuses actual timetable state, pickers, date helpers, view/export predicates, route buttons, role helpers, account/theme controls and the existing Workspace Tasks controller. Two small presentation modules add no data authority, persistence, dependencies, global business requests or new routes. The prototype and Demo mock logic are not shipped.

Independent product review identified stale same-range filters, modal stacking, resize/inert and focus-return defects; these were corrected with regressions. Browser acceptance additionally found the Month selection stale-render defect and dark-theme text/date-header contrast; both fixed and re-reviewed. Final independent product and governance reviews report no outstanding concrete findings.

Evidence and explicit limits: [Phase2 screenshots and browser report](../ui-evidence/phase2/README.md). Seven matched widths, light/dark, content filters, ALL/NONE, four Calendar views, keyboard and narrow-modal behavior inspected. All source/artifact freezes pass for89 static assets and115 API runtime files plus3 build inputs. Final corrected Node22 root suite:1101 total,1048 pass,0 fail,53 skip, exit0;95 focused checks pass. Test-only compatibility corrections committed4a55faf; interrupted intermediate runs are not accepted evidence. Real authenticated role/API acceptance and native200% text zoom remain incomplete. This is isolated-stack acceptance, not current-main/release readiness.

**Next highest-value iteration:** add the same shell through guarded adapters for Faculty Dashboard and Teaching Assignments, then improve dense tables with existing search/counts/actions. Keep Dashboard self-mode, authorized tab sets and route-local business controls intact; do not turn mock Reports/Overview into empty production destinations. This is later work, not included in the current Schedule slice.

Follow-up inspection confirmed concrete reuse boundaries: Dashboard's existing `enterSelfMode` / `enterAdminMode` decide the visible panels and `activeTab` controls Lookup, Availability, Summary, Roles, Trainees and DOE views. Preserve those controls and lazy entry cleanup; a shell must not make hidden tabs reachable. Teaching Assignments already owns separate queue/contributions/published views plus server write capabilities, submitted/working revisions, HICC proposal, VISC decision, ADFAD finalization and immutable release state. Move existing page-level links/actions through a route adapter; retain the workflow's current authorization and state-machine checks. The new main role-period serialization repair belongs in the integrated source before inspecting/editing that table. No cross-page adapter has been implemented in this phase.
