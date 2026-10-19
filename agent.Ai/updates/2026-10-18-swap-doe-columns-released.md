# Agent Update — SWAP DOE columns released

**Date:**2026-10-18  
**Agent/model:**Codex  
**Repository:**Alex1122341/Teaching-assignment-azure  
**Task status:**COMPLETE for implementation,technical acceptance and Beta release;manual acceptance retained

## 1. Goal

Requested ADFA outgoing Current DOE,Course DOE,Projected DOE(after SWAP);replacement Faculty,Availability with allowed explanation,Contract DOE,Current DOE,Remaining DOE,Projected DOE.

## 2. Starting breakpoint

Previous main55813f81b8fe2d7a1f6fd95178e79a993e3953c5/anchor d7e4887cb413667fef0d992105148defb19f856c live withSQL050/051. Isolated startup-recovery-20261017 worktree,branch feat/swap-doe-columns-20261018. See2026-10-18-swap-doe-columns-candidate.md.

## 3. Work performed

Implemented bounded request test-first,reused approved seams,obtained separate independent product/governance reviews,ran fullroot/server and exact-head CI,verified artifacts,merged PR117,passed exact-main CI,compared all raw candidate/main files,prepared93-file runtime,staged/cutoverAPI,publishedHosting,verified publicfiles/auth/CORS/SQL,gates and protected data. Updated originalExcel and school/desktop recoveryconfig.

## 4. Files / components changed

Product894090c5204f8df97671b0dc4588f661534bad32:adfa-swap-panel.js,swap-workflow-sql.css,server/src/swap/swap-api.js,server/src/doe/doe-workflow-preview-service.js and two tests. Separate governance1dfd7f9e9be2e4bac1c4509c07be273a4de8f45c;docs-only head24c4fa3ba1f1a0102c2d37ccaf0816cac7ca54cd.

## 5. Architecture / invariants affected

University SQL/API remains authority;no browser DOE arithmetic,role/approval/gate/schema/dependency changes. Static79/API95/98protected and school93-source inventory unchanged. Exact2static/2API changes only. Prior History promotion pinned to immutable a3a3efa. Existing540 migration not replayed;CCC commitfalse.

## 6. Data / algorithm changes

Contract DOE is raw target.contractTeachingDoe,never effective/override fallback. Missing staysnull,zero preserved. Remaining DOE is current pre-SWAP worksheet balance;projected DOE remains existing server calculation with all reserve logic. Course DOE explicitly means the saved credit of the exact session assignment. Public escaped timetable conflicts may explain unavailable;private AFCdetails restricted;Needs Review blocked. Selection/search/pagination/async guards retained.

## 7. Tests / CI evidence

- RED→GREEN observed for missing contract API value,requested table headings/values and safe availability explanation.
- Local root971total919pass0fail52environment skips;server704total701pass0fail3skips. UI/client/dialog19/19.
- Independent product Ready:19UI+17API/workflow/override tests. Governance Ready:8tests including manifest/report attack rejection,all79canonical Gitblob hashes and exact2static/2API delta.
- Exact-head CI39136916172 and exact-main39137313144 success. Both root971/919pass52skip,server704/700pass4skip,emulator971/952pass19skip,final65/65;all0fail. No SQL path changed;no migration workflow required.
- Candidate SHA256 aedf3afa01ead31709a4ebccf912c9182be2ee9cf71f65ddf8b45ac2b9215ef5. Main SHA256374770db3cdd1f4f7d6975f54c8891d4ca85eb80d9dcaaf09f79f6da058616f6. All176 rawfiles identical,80app/96API.
- Chrome synthetic actualclient/API/workflow/worksheet/calculation:outgoing12.00/current,0.42/savedcourse,11.58/projected;incoming18.00contract,5.00current,15.00remaining,effectivetarget20.00,5.42projected. Selection,search,publicconflict,restrictedunavailable,NeedsReviewblocked,missingcontract and390px inspected;no consoleerror. No realSWAP submitted.

## 8. Live operations

### Performed

- PR117 merged to d9a200ade6ff7c664fbab4ef7c022277853c3014;remote main reverified before release.
- Downloaded exact-main package and source/blob protection checked. School93files attested,exact2API changes,locked dependencies reused. Private stage18789 verified and closed;liveAPI18787 switched to d9a200a/anchor894090c withSQL healthy. Previous launcher retained for rollback.
- Firebase deploy --only hosting --project tester-teaching from exact-main app.79/79 protected public files match. PublicAPI source/anchor,SQLhealth,CORS and unauthenticated refusals(History,CCC,AFCoriginals,SWAPpreview) passed.27gates byte-equivalent;CCCcommitfalse.
-32 protected-table fingerprints and business/audit counts captured before and compared after cutover:unchanged. AFC263,manualAFC13,Calendar540,recovery540,audit37,DOEaudit33,originalPDF0,recordlinks0 at capture. No business/audit writes from this task.
- School recovery config repinned and CheckOnly RUNTIME_AND_ORIGIN_MATCH/siteReady=true;desktop publiccopy updated. LauncherSHA256F7FADF00BD93EE975229BA7201337E49BD5AE4460DC15B0F58DA3D852D553FF6;manifestSHA25641C06951CF71DC0126E9B2F89B80BE93DDF87C6D244049BC494E4B81B3F1AAD6.
- Original PAWS任务进度.xlsx updated and independently verified:29checks15pass13open1N/A. Added S04 technicalpass;S01/S02 manual/fullworkflow statuses preserved. NativeZIPparts/styles/validations/formulas/unrelatedmanualcells preserved;before/after previews inspected.

### Explicitly NOT performed

NoSQLmigration,540replay,realSWAP/testbusinessrecord submission,actualCCC replacement,realPDFupload,DOEpublication/recalculation,rule/firewall changes,account provisioning,scheduled-task installation or reboot. Renderer exported/rerendered workbook successfully but encountered knownWindows teardown exitfault;independent OOXML/nativeparts/value/cache verification passed after preservation. This is not human sign-off.

## 9. Current state after task

Main/live d9a200ade6ff7c664fbab4ef7c022277853c3014,anchor894090c5204f8df97671b0dc4588f661534bad32,SQL050/051 unchanged. PR117 merged/released;no accepted-but-unreleased portion of this update. OriginalExcel current. Worktree retains post-merge continuitycloseout locally for a future docsPR.

## 10. Blockers / unresolved questions

Real authorized ADFA/SWAP end-to-end human acceptance remains S01/S02;existing13manual/data checks retained. OriginalCourseCOE interpreted as CourseDOE exact saved session assignment credit,clearly stated inUI;no whole-course aggregate invented. Known pre-existing CCCtargetfacultyGUIDlabel minor remains outside scope. Recoverytask installation/reboot and fixedhostname remain human prerequisites.

## 11. Exact current breakpoint

This requested update is fully implemented,reviewed,technically accepted and published. School evidence P:\PAWS\Runtime\Acceptance\SwapDoe-20261018;scopedlocal proof/builders/evidence in paws-progress-workbook-20261015/swap-doe-*. Resume with user-selected next task or manual acceptance;do not replay release scripts blindly.

## 12. Next safe action

UseS01/S02 to validate real authorized data and fullSWAP workflow. Do not treat S04's verified read-only DOE presentation as completeTask01 approval. ExistingF02/H01/C07/O01 and remainingmanualitems stay open.

## 13. DO NOT REDO

540migration,SQL050/051,PR117 product,CCCcommit,syntheticliveSWAPwrites. Do not weakenprivacy/freeze/approval boundaries or substitute effective target for ContractDOE. Keep previousversions/launcher for rollback. Do not overwritemanualExcel signatures.

## 14. Review boundary and rulings

Standing no-question/recommendedimplementation authorization used for bounded requestedcolumns and priorapproved UI/API/SQL seams. CourseDOE meaning explicitly exposed to prevent confusing saved assignmentcredit withfullcourse totals. Reviewers declined live data/browserlayout/release;executor separately supplied actualChrome,32table invariants,CI/package/source/API/Hosting evidence. No unresolved product/governancefindings.
