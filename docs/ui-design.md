# PAWS UI design and staged audit

## Scope and delivery boundary (2026-10-23)

The comprehensive UI brief is implemented in coherent reviewable phases. This first phase establishes shared tokens and improves the Teaching Schedule filter region and HICC–CC / VISC directories. It does not claim a completed visual audit of every authorized dashboard tab. Five actual HTML routes and their source components were inspected; rendered verification is recorded separately below. The repository is `Alex1122341/Teaching-assignment-azure`, branch `feat/paws-office-ui-20261023`, based on accepted main `9734d2d`. Open PR #125 is isolated infrastructure work and must not be mixed into this UI branch. Firebase Hosting/Auth → University API → SQL remains the architecture. No automatic merge or production deployment is authorized by this UI brief.

## Capability audit

| Capability | Available and used | Limitation |
|---|---|---|
| Frontend design | Product Design audit and frontend-testing-debugging skills | No separate `frontend-skill`; equivalent installed skills used, no installation |
| Product Design | Screenshot-first audit, existing context preflight | No saved product design context; this brief and actual sources are authoritative |
| Figma | Connection identity check succeeded; figma-use loaded | No PAWS file URL/key supplied; no library created or modified, no real faculty data uploaded |
| GitHub | Git CLI + GitHub connector; current branch/main/open PR inventory | CI is release-specific; local tests do not substitute for a green required check |
| tldraw | Available | Simple route inventory needs no extra diagram; not invoked |
| Browser | CUA in-app browser; synthetic local fixture harness using generated assets | Chrome page reads timed out twice; no claim of complete authenticated all-page visual acceptance |
| Accessibility | Semantic DOM, keyboard, focus, responsive and contrast inspection | axe-core / Lighthouse not installed; no full WCAG certification claim |
| Performance | Node timing and visible browser response | No Lighthouse trace; no speculative virtualization/debounce |

## Actual page inventory and existing feature reuse

| Route / feature | Existing implementation | Audit status and next concern |
|---|---|---|
| `index.html`: Schedule, week/day/month/list, session detail, filters | timetable controller; scheduling/data-index modules; existing view controls | Rendered synthetic baseline/after; this phase changes filter layout only |
| HICC–CC / VISC | leadership-directory.js / CSS; authenticated public projection, effective dates | Rendered audit and implementation in this phase; preserve two business columns |
| CCC Schedule | ccc-schedule.js / CSS dialog; year/search/Refresh | Source inspected; populated visual audit pending, preserve complete-year replacement workflow |
| LAB detail / SWAP | lab-session-detail.js; swap-workflow-sql.js | Source inventory only; preserve rotations, permission, authoritative availability and DOE previews |
| My Change History / Changes / exports / conflict panel | change-history.js / CSS, selected export, workspace task panel | Source inspected; history has search, advanced filters, page size and download already; no new report builder invented |
| `faculty-admin.html`: Lookup / profile, Availability, Teaching Summary, Roles & Appointments, Trainees | faculty-admin and lazy feature modules; shared name formatter | Source inspected; populated authorized visual audit pending. Reuse lookup selection and period status, do not duplicate |
| DOE Overview / List / Annual Rule Book | existing DOE modules and rule book stylesheet | Source inspected; numeric alignment and units require a separate rendered pass; formulas and override rules unchanged |
| AFC Records / Create / Upload / PDF | existing lazy AFC modules and confidential artifact workflow | Source inspected; validation/download states need a separate authorized rendered pass, no document interpretation change |
| Dashboard History / Edit Faculty | native dialogs and existing authorized edit/history modules | Source inspected; no new editor or history API |
| `teaching-assignments.html` | queue, package detail, contributions, published, release history, publication view | Source inspected; distinct work queue should not be forced into a table; populated visual audit pending |
| `user-management.html` | accounts, linked faculty, bulk preview, HICC groups | Source inspected; potentially dangerous operations retain existing confirmation/permissions; populated visual audit pending |
| `password.html` | existing labelled password form and auth status | Source inspected; password submission is outside this visual change and not exercised |

Reuse report before runtime edits:

1. **Unchanged:** shared person formatter, role/access helpers, status/date classification, API loading/authentication, schedule filter state, native details, sticky table headings, existing error/Retry and audit modules.
2. **Central extension:** workspace spacing/control/radius/focus tokens. Existing component families are not globally rewritten; apply verified tokens first to schedule/directory selectors.
3. **Consolidation:** schedule search/select/details can share one scoped visual rule. No unsafe cross-page selector consolidation or unrelated deletion.
4. **Preserved behavior:** AND/OR semantics, academic years, inactive/upcoming population, raw labels, permissions, DOE, writes, lazy/deferred module boundaries and identity-switch invalidation.
5. **Actual gaps:** directory keyword query, explicit sort and clear action; add these inside the existing controller over its already authorized bounded response.
6. **Risks:** legacy CSS order, dark-mode variables, narrow filters, select keyboard focus, unknown dates and stale asynchronous loads. Existing tests and browser checks must cover them. Screenshots use only synthetic records, remain outside shipped assets, and never carry credentials.

## Direction and pattern references

Considered: (A) spacious enterprise (easy reading, fewer visible records); (B) compact academic administration (chosen: existing font sizes, denser layout, aligned controls); (C) card-based modern academic (poor record comparison and higher rewrite cost). This is a code-native lightweight exploration; no Figma concept artifacts were created without a PAWS file.

Pattern research: [Carbon data tables](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines) groups search/filter/actions in a table toolbar and uses consistent row density. [SAP Fiori compact density](https://www.sap.com/design-system/fiori-design-web/v1-71/foundations/visual/cozy-compact) reduces control spacing for mouse/keyboard work without shrinking type. Apply those patterns to the existing PAWS components, retaining PAWS branding.

## Scope and existing implementation reuse

Teaching Schedule and its HICC–CC / VISC dialogs, starting from released main9734d2d. Reuse vanilla HTML/CSS/JS, UCalgary wordmark and red/gold language, `timetable.css` and `workspace.css` theme variables, existing year/semester/week/course/month/activity filters, Reset, keyboard modal handling, and the authenticated leadership-directory API. Leadership already receives canonical Last name, First name labels from the shared server formatter: display those escaped labels directly, as required by the constitution.

Change only the schedule filter layout and leadership controls/table presentation. Add in-memory keyword filtering and ordering to the already authorized directory response. Preserve role/date/academic-year rules, result population, Show inactive/upcoming, Refresh, identity-switch invalidation and all writes/permissions/DOE interfaces. No new runtime asset, dependency or backend route.

## Six concrete design rules

1. Keep the current office palette and typography. Use a 20px page/dialog heading, 13px table/body and 12px labels/secondary text; normal letter spacing for names and values.
2. Use a 4/8/12/16px spacing rhythm and consistent 36px controls. Align labels and control edges; let filters wrap at smaller widths instead of making the page scroll sideways.
3. Keep frequently used search, result count and clear actions together. A query is visible, clearable and matches all entered words across permitted names/course/role/date/status fields, independent of name word order.
4. Keep red for the principal action or selected state, neutral borders for secondary controls, and a contrast-aware blue focus outline (lighter in dark mode). Gold remains the brand separator. Status uses a word plus a restrained marker, with dates as tabular numerals.
5. Preserve the directory's two-column business structure and sticky headings. Use responsive width and compact row spacing; align name/status within the Faculty cell on wide screens and wrap on narrow screens. Keep long names/scopes readable.
6. Keep data truthful and security boundaries intact: names from the canonical API, ISO dates, explicit unknown dates, no invented values or confidential IDs. Sorting makes a copy, keeps unknown end dates last, and never changes source records.

## Three priority problems and daily impact

1. The expanded schedule filter region stacks year, semester and two week rows above another tall filter row. At normal desktop heights it pushes the calendar down, requiring extra scrolling during repeated comparisons.
2. The leadership dialog has no keyword search or ordering. Finding a person or course among 91 appointments requires repeated scrolling; names are hard to compare across several appointments.
3. The fixed 860px dialog and stacked status lines spend substantial height per row, while the surrounding desktop is unused. The small-window capture showed only about four complete rows. A wider responsive shell and compact rows should expose more comparable records while preserving long-text wrapping.

## Prioritized evidence ledger

| Priority | Component / reproduced evidence | Daily impact | Fix and acceptance |
|---|---|---|---|
| P2 | Schedule: baseline screenshots show year/semester/week stacked above a second filter band | Less timetable visible during repeated checks | Scoped grid/wrapping; same controls and selections, calendar starts higher at normal desktop widths |
| P2 | Directory: baseline contains only Show inactive / upcoming and Refresh | Scroll to find one of many repeated appointments | Labelled keyword query, visible count, clear, faculty/end-date sort; match all entered words in allowed display fields only |
| P2 | Directory: 860px shell and stacked names/status leave desktop unused | Harder side-by-side comparison and fewer visible rows | Responsive 1120px shell, compact rows, shared sizes, all long text visible; unknown dates remain explicit |
| P3 | First iteration: schedule details controls had unequal heights | Labels and comparison edges did not align | Common 36px fields, labels above, single border; verify screenshot again |
| P3 | First iteration: empty/loading directory resized vertically | Search moved while refining a query | Stable responsive shell height; clear loading and Retry states |

No P0/P1 visual defect is asserted without corresponding evidence. Source-only concerns above remain pending, not verified findings.

### Representative screenshot pairs (synthetic records only)

1440×900 viewport, same fixed Fall Week12, same fixture/status population and scroll position. These screenshots are documentation assets only; they are not in the shipped static allowlist.

| Surface | Before | After |
|---|---|---|
| Teaching Schedule | [Baseline](ui-evidence/schedule-before-1440.jpg) | [Compact filters](ui-evidence/schedule-after-1440.jpg) |
| HICC–CC directory | [Baseline](ui-evidence/leadership-before-1440.jpg) | [Searchable compact list](ui-evidence/leadership-after-1440.jpg) |

## Evidence and limits

### Freeze promotion for this candidate (not a deployment)

Product `16027769c774367c65d5dd68fc1a8002a052589e` changes exactly `index.html`, `leadership-directory.js`, `leadership-directory.css`, `workspace.css`. A separate governance commit pins that immutable product, retains all87 static paths and all115 API runtime paths (118 with repository/build inputs), and recomputes reporting hashes. The API tree, dependencies, SQL, Firestore rules and runtime origin are unchanged. Prior name governance is checked against its fixed accepted main9734d2d; historical receipts are not rewritten. `tests/office-ui-governance.test.js` guards the exact new delta and active full freeze. These are candidate build checks, not permission to merge or publish.

Local read-only preview at `http://127.0.0.1:19038/after/` uses the actual generated page/modules/styles with synthetic fixtures; `/before/` preserves accepted main9734d2d. It removes production initialization and all fixture writes/network access. The fixture harness and generated comparison artifacts live outside the repository and are not shipped.

Comparable baseline/after screenshots are saved privately under `PAWS-DOE-Preview/name-acceptance-20261023/ui-evidence/` at 1920×1080, 1440×900, 1366×768 and 1024×768. Additional 768/640px screenshots cover long names/scopes and dark mode; a 720×450 viewport checks the available area equivalent to 200% reflow from 1440×900. This is not proof of native browser text zoom, which remains unverified. Actual saved screenshots were opened and reviewed; only accepted stable captures are used. A transient first capture during concurrent static build tests was rejected, and preview serving was isolated to a stable generated candidate artifact.

Fresh 1440×900 DOM measurements: calendar top 530.1875px before / 461.578125px after (68.609375px more calendar area); 9 complete directory rows before / 12 after with identical 24-record fixture and default status filter. Search `elodie muller` returns the one matching `Müller, Élodie`; explicit status toggle shows 24/24, faculty sorting preserves source order in memory, and unknown dates remain last. Large fixture has 900 total entries, 600 in HICC/CC; its query `mary 200` shows 15 matching authorized fixture records.

Browser checks exercise search/sort/clear, empty/error/Retry, loading/disabled Refresh, status populations, long text, dark mode, focus wrapping/Escape, schedule collapse, schedule query and Reset. Independent design/code review identified a real P2 focus escape when a focused Refresh became disabled. A red/green VM regression and actual browser retest confirm focus moves to Search before disabling Refresh, then Tab reaches Sort inside the dialog. No backend writes, SQL, credentials, data mutation, permissions or DOE changes are part of acceptance.

Pure 900-row keyword+faculty-sort benchmark on Node22: 30 iterations, median21.09ms / max41.25ms on this machine. No debounce, virtualization, cache or extra network request is introduced. This is a transformation benchmark, not an end-to-end performance certification.

Verification: targeted directory suites15/15; governance4/4. Final local `npm test` completed1083 tests:1030pass,0fail,53skip (Windows, no local emulator); the earlier pre-promotion18freeze failures are superseded. Exact-head CI40002951608 at46e6ed0 passed: root1031/0fail/52skip; Server843/0fail/5skip; Auth/Firestore emulator1064/0fail/19skip; supplemental61/61, combined build/container and all source/artifact freezes. Sequential local rebuild and source/artifact freezes also pass. The final documentation-only receipt commit requires fresh current-head CI before readiness is claimed; consult PR136 for that result. Authentication/security rules were not modified; real-role production acceptance is not inferred from synthetic results. Other populated application pages remain unverified, as listed above.
