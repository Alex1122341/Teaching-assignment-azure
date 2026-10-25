# Agent Update — approved540 migration complete; history09–11 next

**Date:** 2026-10-16 (America/Edmonton)
**Repository:** Alex1122341/Teaching-assignment-azure
**Task status:** COMPLETE automatic migration stage; manual UI acceptance remains

## Goal / starting breakpoint

Finish original541-minusRemoteWork1 exact migration, retaining256AFC/4departed exclusions/12Away needs-review rows, then owner-prioritized09–11history. Started fix/calendar-commit-preflight-20261016 after read-only identity performance diagnosis. No questions; recommended decisions and human-only steps recorded/skipped per latest owner request. Current desktop cwd Teaching-assignment-main is a separate repo; continue the explicitly selected Beta repo.

## Code / tests / integration

- PR111 merged9394db68e8cb7f7ac4ae32f4aa7ea31c8c7fcb2b fromde7608bb9fa4d0c330c67c39c8e5cabee731599a. SQL046 only materializes complete identity evidence once per raw BIN2 name; exact045 rollback and all transaction/authorization/predicate/audit/recovery behavior preserved. Independent static review Ready.
- Test-firstfb8b761 SQL38990381610 meaningfully RED. Runner fixture-source collision fixed via fresh guarded schema/no earlier acceptance, then unchanged038–041 once. Regression RED→GREEN. SeparateTABLE declaration syntax corrected. FinalSQL38998721612 GREEN: actual540/47 command7692ms, inactive identity rejection, protectedfingerprints,receipt/recovery/replay,rollback/reapply andexisting two-connection races.
- CandidateBuild38998721614/Migration38998721617 and exact-mainBuild38999106281/Migration38999106256 all success. CIroot876/927+51skip,server616/620+4skip,emulator909/927+18skip,governance65/65,0fail. Localroot876/927+51skip,server617/620+3skip,0fail.
- Candidateartifact12088735137/66a515d2896ab95b884d79d620b119e4f2045620c6b23414e1ee7cb521519188 andmain12088745798/a18c2cd61222a9e7450a2a351e800ab55ae95490b09a10b4b08f8b5ac40b13a0: all153rawfiles match eachother/released9287. Static75/API76+1build+2inputs freeze retains3d983cf. No runtime redeploy required; only SQL046 published. Explicitly fetch origin main:refs/remotes/origin/main because this clone's fetch refspec does not update tracking main on a plain `git fetch origin main`.

## Actual live writes / recovery

- GuardedSQL046 applied remote20824: Commit19C5A732D9ABD432A96BCAAEE5462CA71B43A42D5172EF9F800914D5B3EB3CE1, resolutionD748unchanged;28protectedfingerprints/counts unchanged; liveAPI9287/3dSQLhealthy/newpublicgatesfalse. Apply-script listenerinventory failure mock RED→GREEN; no grants or memberships.
- Samebatch2a0718fe-3f30-4fd4-8df1-de84d2beec2e refreshed remote24616, exactsource4FDB517F…3E2DF, C62FEEA344269077B5254836F79419893421D01CB2E8FA64FB568D0F5B8FEEAB manifest, version0000000000008072. IDs/versions/dates equal savedoriginal541minusRemote245, counts540/256/4/12, originalabnormaldates/issues preserved. Preview16547ms.
- NormalauthenticatedAPIcommit remote10256 reused original saved key after explicit controlledversion rebind and immutablefirst-attempt backup. Commit succeeded2026-10-17T03:39:12.4827494UTC (Oct16Edmonton), receipt743D9E51-EC04-469F-B634-2E0E8CBE3AE8. Actual540Calendar/1receipt/540recoveryrows/0remainingexactAFC/0RemoteWorkactivities. Do not resubmit or create a newkey.
- Initial accepted exporter was denied: trustedWindowsprincipal is existingdb_owner but not explicitrecovery-role member/dbo context. No permanentpermission changes. Existingdb_owner+dboimpersonation capability verified; independently reviewed equivalenttrusted Finish-Away-Recovery.ps1 uses same encryptedintegratedconnection, sessionEXECUTEASdbo, acceptedExportproc with actorfromcommittedreceipt, then explicitREVERT/finallydispose. No commit/recover-write calls. Owner's current-account exception applies; browser/runtime access unchanged.
- Recovery remote35932: actualUTF16LEwithoutBOM file529712bytes, SHA256FD02F92FBA63798F597C9520B8F4F49824031F49E8ACB7578EADF6A64B9DF5BE,540uniqueoriginalIDs, receipt/source/manifestbinding, SQLhash/privatefilereadback/repeatedSQLexport allmatch. ACLinheritanceoff/currentowner/SYSTEM/Adminonly. Protected28fingerprintsunchanged, private18789closed/authfileremoved. Privateproof migration-v2-verified.json exists. Recoveryfile stays onlyP:/PAWS/Runtime/Private/CalendarMigration-20261016/recovery-743D9E51-EC04-469F-B634-2E0E8CBE3AE8.json.
- Read-onlyactualdataacceptance24908 passed:540activities,7categoryfilters,540date-only/NeedsReview,sourcefieldsunchanged,8weekendstarts preserved,individualfacultyAPI47rowsmatchesexpectedscope,publicnewgatesfalse/privateportclosed. Private data-acceptance-v2.json exists.

## Browser / Excel

Chrome4 remains connected. Newacceptancetab707482486 authenticatedADFA; reload shows11actualworkrangesinOct12–16week, sourceinclusive dates, needs-review andmissingtime/course/room/group. Native/locator/coordinate clicks onTaskclose/picker stillproduce no statechange; consoleonlyFirebasepersistencewarning. Fullmanualinteraction is not signed off. User instructed skiphumansteps, so keepC01/C05open and advance09–11. No ordinaryfaculty credentials invented.

OriginalExcel C:/Users/xinyu.zhu1/Desktop/PAWS进度管理/outputs/paws-20261015/PAWS任务进度.xlsx savedusingestablishedArtifactToolbuilder,58authoredcells; formula cachesrecalculated; nativepackage/formulas/styles/tables/validation/dimensions/manualfields independentlypreserved.25tasks/18checks=9passed/8open/1N/A. C02/C03/C04passed; C01/C05manualpending. Task 13E deployed / F partially accepted / G deployed pending acceptance;Task16partialfullcoverage. CCCfullreplacement/Task12upload/Task15CourseCalendar untouched.09–11expandedownerqueue inrows17–19. Workbookbuildercleanupnativeexit1073740791after savedtrue is known; independentpreservationvalidationpassed. Previewsinspected. Sameoperationmarker alreadyran once; do not rerun marker for this continuation.

## Next safe action / avoid redo

Create history feature isolation fromorigin/main9394db6, preserving owneruntrackedpaws-doe-local-preview.html and currentcontinuitydocs. Nativeworktreetool is implicitly bound to DesktopProductionrepo, so cannot safely targetBeta; use explicitBeta gitworktree fallback if needed (already ignored.worktrees/). No repeatedapprovalquestions per owner. Read originaldirectiveattachment755f… lines493–588: Task09ownaffectedhistory/export7fields;Task10allauthenticatedfacultysee sanitizedpublictimetablechanges acrosstheCalendar;Task11course/topic/VISC/faculty/date/type/yearfilters+CSV/XLSX/allfiltered parity. Latestuser addsDashboardLookup/AFC/DOERuleBook history. Distinguish selfprivatehistory from publictimetablechanges; neverlimitTask10 toownonly. NoFirestoreauthority or fabricatedoldhistory. Need sourceproducer/audit/lookup coverage audit, writtenrecommendedspec/plan, sequentialTDD, oneindependentwholebranchreview, separatefreeze/governance andcandidate/mainreleaseacceptance.

DO NOT rerun110release/046apply, stage/commitapprovedbatch, issuefreshkey, overwritebaseline/firstattempt/recovery, exportprivatecontents toGit/Hosting, or claim fullfourthyear/CCCdatasetreplacement. Keep acceptedprivateproofs. Localops/scripts/logs in Temp/pr103-acceptance-20261016;CI/workbookhelpers in Temp/paws-progress-workbook-20261015. Currentmacroledger .superpowers/sdd/2026-10-16-calendar-commit-preflight-performance/progress.md is locally ignored via gitinfoexclude.
