# Owner-directed current MASTER DOE reconciliation

- Repository: Alex1122341/Teaching-assignment-azure (Beta / University SQL).
- Base: main `beca0d901660144120f907fd2f15c6faf3a99315`.
- Branch: `fix/doe-master-reconciliation-20261030`.
- Owner authorizes PAWS corrections and required exports. SharePoint workbook stays read-only. Owner explicitly selected verified assignment/teaching details over erroneous Excel aggregate formulas; report source formula issues separately.
- Approved local source: Downloads `Teaching Assignments 2026 27 MASTER - Copy.xlsx`, SHA256 `92d32ddbf38d78511f7cbf6ce4a8b65d8612c0dd0198740aea916cc06f3948f3`. Private copied snapshot and formula/cache extraction are outside Git/Hosting. Current saved desktop workbook was identified but live Excel connection was unavailable; owner directed use of the downloaded copy.
- Current PAWS report exported normally in authenticated Chrome: 119 faculty, 2,716 teaching/work rows, 202 appointment-period rows. SQL read snapshots: 121 faculty including archived, 198 roles, 149 schedules, 111 pre-correction targets, 116 supervision snapshots, 4,972 assignments, 58 Active policy rules. Native source has 33 sheets including hidden historical sheets. Do not treat historical hidden MASTER as the current displayed DOE summary.
- Five preferred/HR-name differences resolved with exact UCID crosswalk from the existing Faculty Master List. 111 current source faculty compared; two owner-archived people excluded. No fuzzy name matching or source identity writes.

## Committed data operation: DO NOT REPLAY

At `2026-10-30T16:19:07.7713580Z`, one guarded SERIALIZABLE transaction applied **20 explicit effective-target overrides + 30 manual DOE assignments** (8 signed reductions and 22 missing explicit early-career/special-activity allocations). Contract values retained; two previously absent targets retain unknown contract DOE. Existing manual allocation retained. Exactly 50 DoeAuditEvent rows, normal manual stored procedure reused. Rollback preview passed first (20 targets / 30 manual / 50 audits, then rollback). No policy publication, teaching/role deletion, DDL, Auth, grants, gates, API restart or deployment.

- Plan SHA256: `acc6f8deed559e33e199736059a7dbff1fc6915ab9c2248a84ee3a7ed297a649`.
- Server applied receipt SHA256: `9ed76e250abb83226421920bf24ac40bc99cfc13375e561a348ce3f8dacf0208`.
- Private server evidence: `P:\PAWS\Runtime\Acceptance\DOE-Reconciliation-20261030`.
- Private local evidence: `C:\Users\xinyu.zhu1\Documents\PAWS-private\DOE-Reconciliation-20261030`.
- Independent fresh SELECT at 16:21 UTC reports 113 targets / 31 manual rows. Refreshed live Reports visibly returns the new targets and manual totals. Broader reconciliation remains unfinished.
- Importer refuses replay, changed target timestamp/contract/override, changed manual set/revision, identity drift and duplicate scope. Private before/after JSON exists on server and locally. No staff rows or UCIDs belong in this repository.

## Remaining work

1. Finish independent readback of all 50 planned values and retain current browser proof.
2. Three exact role DOE differences, one existing rotation misclassified as coordinator, source dates/periods and Active policy provenance remain to reconcile. Preserve valid same-person aliases; never remove a valid appointment merely because Excel SUMIF misses an alias.
3. Current detail comparator resolves 3,828 exact unique assignment links and seven source-backed hours/DOE correction candidates. 111 other source facts remain held rather than guessed. Source annotations/external sessional names require further classification. No teaching corrections applied yet.
4. Current reserve implementation allows flexible transfer and caps supervision by target minus assigned teaching. Source Calculator/Dropdowns caps by initial contract reserve and applies signed reductions afterward. Confirm and implement source-backed annual policy behavior with regression tests, leaving other years unchanged. Do not force worksheet totals with balancing adjustments.
5. Annual policy changes require new Draft + validation/impact/review/publication; preserve historical Active version and immutable calculations. Existing Drafts must not be overwritten.
6. Produce final stable-ID comparison, applied-changes list and source-issues register. Do not claim workbook parity or policy completion yet.

Graphify guide and existing raw graph consulted before dependency investigation; source is authoritative. No merge performed, so no post-merge graph refresh yet. Desktop Commander reported 95% monthly usage during this task; minimize repeated remote inventory calls.

## Second committed data operation: DO NOT REPLAY

At `2026-10-30T16:55:02.0761274Z`, a separately previewed guarded transaction committed seven exact teaching hours/DOE corrections, four role amount/type corrections, one explicitly removed source assignee, and 49 appointment intervals. Twelve DOE audit rows plus 49 period audit rows. Original source and all earlier audits preserved; before/after recovery receipts exist on server and locally. Plan SHA256 `43da70ac7b99ba89d34c131989cdc1b9a3b0804b12e7c0a064a10844d3c6450b`; applied server receipt SHA256 `cd89dbbb51d33999c32754019abcad6cee194d6ff0b5c77841f67865129429ea`.

One period update was held because its source is referenced by an existing approved teaching-leadership grant; its source metadata and authority were preserved. Two source notes incompletely describe replacement intervals, so their recorded intervals were retained. The exact removal required zero linked leadership grants and preserves its original row/schedule in private before-image and the immutable DOE audit. No permission rows, gates, source workbook, API, policy publication or deployment changed.

## Runtime candidate and independent review

Initial product `bcaa76edaf17214b254f0a3eb6b5b6e319e5947d` adds optional annual `contractReserveCap`, contract-basis calculation, SQL parameter transport and Draft/browser-patch preservation. Independent product review found one Important legacy fallback regression: adding an absent optional key with `undefined` made historical source policies invalid. Reproduced RED with repository-to-worksheet test; fix copies fallback keys only when present. New regression covers absent mode and explicit annual zero end to end. Latest focused server 24/24 and browser-controller 12/12 pass; earlier full server 1,017 pass / 0 fail / 7 skip. Do not use the pre-fix generated artifact. Final review/freeze/full-check and new annual Draft/impact remain pending; existing Active policy is unchanged.

## Owner missing-value ruling, independent readback and policy Draft

Owner answered **keep unavailable** for Archer's source HICC allocation and Pfau/Weller contract Teaching DOE. Retain those gaps; Excel's external lookup zero is not a confirmed contract zero. No SharePoint edit.

Product fix `09ae583` closed independent product review; separate governance `a7cc4d3` closed independent review without findings. Protection remains 96 static / 133 API plus three inputs; all 96 reporting hashes and 232 protected source files were independently checked against accepted immutable blobs. Full governed tool/suite checks are separate ongoing evidence.

Fresh read-only independent verifier at `2026-10-30T17:12:58.275Z` confirmed 20 targets, 30 manual allocations, seven teaching corrections, four role corrections, one exact deletion, 49 periods, one held permission-linked source unchanged, and all 111 audits. Current SQL has 197 roles, 195 period records, 113 targets, 31 manual rows and 116 supervision snapshots. All 195 numeric source role details match by verified identity/type/scope. Original source SHA256 reverified unchanged.

New annual policy Draft `0FFAECE8-3152-498D-9FDB-43B286E4270F`, revision 2, cloned the actual Active without overwriting other Drafts. It contains the approved annual cap and four exact source-role exceptions. Structure validation passes. Impact `695a637a-eafb-44b6-8474-273b0f2ba877` has 107 review rows: 105 supervision source snapshots have empty required counts, one teaching source lacks hours, one HICC allocation is explicitly missing. No policy publication or recalculation performed. Existing Active remains `EF8506FF-CB21-E5F8-42C0-9FFF24327E49` revision 2.

Separate 119-faculty annual preview changes 24 known totals. Proposed assigned total is unavailable for ten rows (including the two unknown contracts); twelve rows have review status overall, including nonblocking issues. Raw-line delta zero is not an annual-total result. Do not claim parity based on that raw impact value.

Private six-tab workbook `PAWS-DOE-Reconciliation-2026-27.xlsx` includes applied changes (111), faculty comparison (111), numeric roles (195/195 match), source issues and policy review rows (107), with formula-safe CSV companions. Source aggregates remain diagnostic because owner selected verified details. 111 held source teaching facts remain unresolved; no guessed identities/session links. Chrome debugger detached during final Dashboard navigation; final real-site screenshot/report acceptance remains incomplete. No merge, API restart or Hosting release.

Final first parallel server run: 1,014 pass / 5 parser-timeout failures / 7 skip. All 35 tests in the three affected files passed under concurrency one. Final complete serial server and root partition/governance checks are running; never count a running or failed run as passing.

Final serial server run completed: **1,019 pass / 0 fail / 7 skip**, 1,026 total, 426,842 ms. The complete combined artifact rebuilt successfully at governance `a7cc4d3`. Source static/API and artifact static/API freeze tools all exited zero against immutable product `09ae583` (96 static; 133 API plus three inputs). Root tests are partitioned to avoid repeating the already-running long historical baseline file; both partitions must finish before reporting root pass. This is local verification, not GitHub Actions CI. Seven server environment-dependent skips remain skips.
