# Agent Update — Custom Reports 23–25 published

**Date:** 2026-10-26 MDT  
**Agent/model:** Codex  
**Repository:** Alex1122341/Teaching-assignment-azure (completed Beta slice)  
**Task status:** COMPLETE for implementation, technical acceptance, publication and tracker; human business signoff remains open.

## 1. Goal

Deliver selectable annual report sources, typed filters, columns, sorting, pagination and matching CSV/Excel for Owner/administrator, preserving existing business rules and privacy.

## 2. Starting breakpoint

Published base main c0970cafddb53187906ba3257cfa81c9d31293eb; feature feat/custom-reports-20261025, followed by fix/custom-reports-theme-20261026. PR146 and PR147. Earlier implementation checkpoint in PROJECT_STATE/TASK_CHAIN is historical.

## 3. Work performed

Four independent selectable sources: annual faculty workload, teaching/work details, appointment periods and History. Server-owned field catalog, typed closed-schema conditions and authorized bounded private previews drive pages/downloads. Lazy Dashboard Reports uses existing theme and role helpers. Separate product and governance reviews completed. Fixed all actionable review findings with observed RED→GREEN regressions, including duplicate raw JSON keys, unresolved instructor evidence, canonical names, keyboard focus and dark-mode contrast.

Actual normal administrator and Faculty authentication tested through API and published UI. No business-data mutation. API and Hosting release actions are listed below.

## 4. Files / components changed

- server/src/reports/: definition, trusted adapters, private snapshot API and export.
- Existing SQL readers: bounded slim report roster and report-specific unresolved instructor projection; ordinary assignment behavior retained.
- frontend/scripts/faculty-reports.js and frontend/styles/faculty-reports.css: lazy query builder and shared-theme presentation.
- Runtime/client/asset integration and separately reviewed static/API governance.
- Original progress workbook tasks23–25 and appended business acceptance R01–R03; continuity and implementation plan.

## 5. Architecture / invariants affected

Completed under the previously explicit Beta/SQL authorization. No Firestore fallback, DOE policy/engine modification, support permission expansion or write-gate change. Latest user-supplied Desktop/Teaching-assignment-main AGENTS now specifies Alex1122341/Teaching-assignment, Pages and vista-teaching-lab. Its local note was aligned to that exact instruction. This historical Beta release is not permission to start additional Beta work or silently transfer the reports feature into Pages; inspect the latest target before new development.

## 6. Data / algorithm changes

Read-only report predicates/projection/export only. Separate sources avoid cross-products; non-additive whole-appointment DOE stays non-additive, missing values remain N/A, source default times are not actual hours. Source identity/history evidence preserved. No migration/import, AFC deletion or DOE recomputation.

## 7. Tests / CI evidence

- PR146 head713093e7328efd68e26e7779e4c8314444f42fb2, Build40342586436: root1248pass/0fail/52skip; server902/0/5; emulator1281/0/19; supplemental62/62, build/four freezes pass. Earlier failed fixture run is superseded, not accepted evidence.
- PR147 headc5251584a232a04b45375a501f8b84c2351e5924, Build40364026611: root1252pass/0fail/52skip; server902/0/5; emulator1285/0/19; supplemental62/62.
- Exact final main e7d3ffec1609fef4b5b503ff92a21df6a8a4fafe, Build40364636235/job121718893721 SUCCESS: same final totals; build and repository/artifact freezes pass.
- Official artifact12670375863, ZIP SHA256658bd3e50ead7ee7c5db8d1df429435a508c13ddea7cf56b8dbbc3c550c492b5. Final head and main trees equal8e0e3ecd182440e115cf9cda4b3c58e903ce48a8.
- Desktop/narrow synthetic component rendering, empty/error/large results, null/zero, query invalidation and actual CSV/XLSX readback verified. Native200% zoom is not claimed.
- Published administrator:119 workload faculty,2710 teaching/work rows,201 appointment periods; restricted changed-on History11 rows. Unbounded History413 capacity guard, not silent truncation. CSV201/7 readback, four-sheet Excel,50-row pages, source deselection and reset verified.
- Actual Faculty catalog/query/export403; no visible Reports tab, no loaded Reports module or private panel contents. Anonymous401. Both accounts signed out.

## 8. Live operations

### Performed

Versioned University API cutover from digest-verified official artifact;119 installed source/package inputs verified; shared anchor ef2d053ff9963aad972c22ec6c3fa8fc53bcb149. Recovery configuration updated atomically with prior config/runtime/artifact preserved. Hosting-only release1793035279588000/version5e4d032f63f916d8 at2026-10-26T17:21:19.588Z. Public95/95 raw application files matched accepted artifact at17:23:38.698Z. SQL/API/401/CORS healthy; all27 gates retained. Final recovery CheckOnly exit0 at17:34:25.3790385Z, config SHA256C0159BC1B1F069F6F43AD389B8FC684FEA0062390B71FEA840C21ABDC8116BBB. Owned temporary candidate stopped.

### Explicitly NOT performed

No SQL migration, reimport, business-data/DOE/audit mutation, account provisioning, permission/gate expansion, Firestore rules/indexes/Functions deployment, real approval request or email.

## 9. Current state after task

PR146 merged25720f98be54b81bab9dd6680b87e64b21e21d0b; PR147 merged finalmaine7d3ffec. Beta published, previous rollback retained. Original PAWS任务进度.xlsx tasks23–25: 已上线 / 已通过 / 已上线待验收. Appended R01–R03 remain 待验收, human signature/date cells blank. Totals39tasks/46checks/16passed/29open/1N/A. Artifact-tool export plus read-only independent preservation check passed before atomic replacement; all original cell styles, formulas except four extended counters, validations, conditional formats and human signoffs preserved. Backup original-before-reports-release.xlsx.bak retained privately.

## 10. Blockers / unresolved questions

Human business acceptance R01–R03 remains pending. No remaining technical release blocker in this slice. Wider native200% zoom audit is unclaimed. New development must follow the latest user target instructions rather than this completed release's historical repository selection.

## 11. Exact current breakpoint

Release and original workbook writeback are complete. PR146/147 descriptions now carry final published evidence. Local documentation checkpoint branch docs/custom-reports-publication-20261026 is separate from deployed main; its documentation-only changes do not require a runtime redeployment.

## 12. Next safe action

User can accept R01–R03 in the existing workbook using an authorized administrator account at the published Beta. Before another development item, inspect the latest task/target and Pages checkout under the newly supplied AGENTS; do not synchronize architectures implicitly.

## 13. DO NOT REDO

Do not repeat540-row activity migration,413 CCC replacement, API cutover or Hosting deployment. Do not rerun old ledger modes, alter human signoffs, expose private receipts/screenshots/credentials, weaken freeze algorithms or replace this final95-file receipt with older evidence.
