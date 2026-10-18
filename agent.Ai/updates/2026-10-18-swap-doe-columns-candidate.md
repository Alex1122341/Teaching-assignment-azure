# Agent Update — SWAP DOE requested columns

**Date:**2026-10-18  
**Agent/model:**Codex  
**Repository:**Alex1122341/Teaching-assignment-azure  
**Task status:**PARTIAL — implementation/product review complete; CI/release pending

## 1. Goal

ADFA outgoing:Current DOE,Course DOE,Projected DOE(after SWAP). Replacement columns:faculty,availability(reason if unavailable),Contract DOE,Current DOE,Remaining DOE,Projected DOE.

## 2. Starting breakpoint

Existing isolated startup-recovery-20261017 worktree; new branch feat/swap-doe-columns-20261018 from main55813f81b8fe2d7a1f6fd95178e79a993e3953c5. Previous History/PDF/template release remains live; its local continuity closeout is included here. Last update2026-10-18-history-record-originals-released.md.

## 3. Work performed

Bounded change using user's specified columns and standing no-questions/recommended-implementation/release authorization. Read existing API/workflow/target semantics, then observed RED→GREEN for raw contract field,requested UI columns,and safe availability explanation. Reused exact approved UI/API/SQL test seams and existing server DOE services.

## 4. Files / components changed

adfa-swap-panel.js,swap-workflow-sql.css;server/src/swap/swap-api.js;server/src/doe/doe-workflow-preview-service.js;two corresponding test files. Separate7-file governance1dfd7f9 pins independently accepted product894090c5204f8df97671b0dc4588f661534bad32. No schema/dependency/manifest change.

## 5. Architecture / invariants affected

Authoritative University API/SQL,ordinary faculty privacy,roles,gates,approval and stale-request checks preserved. No browser DOE calculation or write behavior added. Static79/API95/98protected paths unchanged.

## 6. Data / algorithm changes

Allowlisted contractDoe comes only from worksheet.target.contractTeachingDoe and survives the existing workflow summary. Effective target/override not relabeled as contract;missing isnull,zero preserved. Current Remaining DOE uses current worksheet;Projected DOE uses existing server preview. Course DOE label explicitly identifies exact saved session assignment credit,not annual course aggregate. Public timetable course/time conflicts escaped;other unavailable details restricted;Needs Review cannot select. Six candidates/page and search remain bounded.

## 7. Tests / CI evidence

Executor UI/client/dialog19/19;fullserver704total701pass3environment skips0fail. Newgovernance2/2. Independent product reviewer Ready,no actionablefindings,independently19UI and17API/workflow/override tests. Rootfulltestrunning at this checkpoint. Browser actualclient/API/workflow/worksheet/calculation synthetic fixture:12.00 outgoing/0.42 savedcourse/11.58 projected;incoming18.00contract/5.00current/15.00remaining/5.42projected/effectivetarget20.00. Selection,search,publicconflict,restrictedunavailable,NeedsReviewdisabled,missingcontract and390px layout inspected;no console errors. No requestsubmitted.

## 8. Live operations

None in this SWAP task yet. Live remains main55813f8/anchord7e4887 and SQL050/051. Previous completed540 migration and actualCCC replacement not rerun. CCCcommitfalse.

## 9. Current state after task

Product894090c,governance1dfd7f9;fullroot/governanceindependentreview/PR/exactheadandmainCI/artifact/API/Hostingreleasepending. Existing runtime source93files remains93;newAPI delta2files from55813f8,noSQLmigrationrequired.

## 10. Blockers / unresolved questions

No new user question required. Human actualmulti-role acceptance remains distinct. Contract/source unknown values are not inferred.

## 11. Exact current breakpoint

Finish root/npm tests and governance review,then create scopedPR with current head,CI/artifacts,authorizedmergeandexact-mainrelease. Temp scripts/evidence:paws-progress-workbook-20261015/swap-doe-*. Syntheticserver38217/session11312;Chrome tabs707482554/707482557. Close own fixture/tabs after acceptance.

## 12. Next safe action

ExactheadCI/artifactverification →merge →exactmainCI/artifacts →93file schoolsource prepare/cutover with all27gates identical and SQLhealthy →Hostingonly →79public bytes →recoveryconfigrepin →originalExcelupdate. NoSQLschemaapply needed.

## 13. DO NOT REDO

540migration,SQL050/051,CCCcommit,realPDF uploads/testdatawrites. Do not weakenfreeze/authorization or exposeAFCreasons. Do not overwritemanualExcel signatures. PreserveuserChrome tabs.

## 14. Rulings / review boundary

Standing no-questions instruction supplies recommended bounded implementation choice without another brainstorming approval menu. Risk:CourseCOE typo could have meant a different aggregate;UI explicitly says saved assignment credit. No full-course aggregate is invented. Previous approvedseamsUI/API/SQL reused. Productreview declined liveSQLdata,browserlayout and release readiness;executor browser evidence recorded,release separatelygatedbelow.
