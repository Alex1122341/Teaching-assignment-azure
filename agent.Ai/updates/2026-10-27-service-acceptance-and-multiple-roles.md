# Agent Update — service acceptance and approved multiple teaching roles

**Date:**2026-10-27

**Repository:**Alex1122341/Teaching-assignment-azure

**Task status:**PARTIAL / new scope in implementation / not merged or published

## Starting breakpoint and completed work

PR148 feat/effective-access-20261026 resumed from6318aa7. Calendar product6ea5a64/a94c3c/cb4298c implements teaching-only defaults, explicit work/Rotation opt-ins and compatible identity/content resets. Independent product review found one reset P2, reproduced/fixed. Independent separate governance review found no issues: cb4298c anchor,96 static hashes, two changed static files,127 API plus3inputs unchanged. Governance d76aa7e. Scope/history records06a8302; test-only bootstrap contract correction8311e99 retains actual privacy ordering.

Exact8311e999427d1b49beb3ab2a7d97acae6ceb01af all7 workflows passed. Build40543447287/job122327639282: root1308pass/55skip; server934pass/8skip; emulator1344pass/19skip; extra62pass, all0fail. Six SQL runs40543447303(Migration),40543447294(Calendar),40543447359(Faculty),40543447302(CCC),40543447354(MASTER),40543447382(Account). Local governance71/71, Calendar/bootstrap47/47. Counts overlap. Official PR artifact12752511137, ZIP8a91a8075256318422c9f3ae078852c547ceeb3bc30db25976dd15a96ab9e0c0, downloaded/digest verified on workstation and school server; downloaded static/API freezes pass. Old06a8302 Build failed only an outdated direct-reset source assertion; preserved RED8/9 thenGREEN47/47, runtime unchanged by that test fix.

## Live changes actually performed

Existing CurrentUser DPAPI credential authenticates as paws-beta-firebase-verifier. Earlier ADC-only absence inference was wrong; parent cleanup follows passing the credential to child. Owner logged into Cloud Console and explicitly confirmed the exact five-permission custom Firestore role. Created pawsSqlCollaboration, default database-only condition; original Auth roles/other principals retained. Existing named-app bounded group/info/audit reads now pass. No key, token or plaintext credential file created or printed.

SQL060 installed at2026-10-27T16:52:24Z after exact-head SQL acceptance.15 existing profile business values match before hash; access operations/audits0. Feature role bound only to current UC Windows runtime principal; pre-existing db_owner unchanged and not claimed least privilege. Receipt and source hashes private under P:\PAWS\Runtime\Staging\EffectiveAccess-20261027-8311e99. Do not rerun060; unbinding and guarded rollback would be separate recovery, not a normal continuation.

Stage125 exact source/package files from verified official API artifact plus immutable package inputs. Old installed lock differs only CRLF; downloaded immutable LF package inputs to candidate and verified all125 raw hashes. Existing dependency tree reused through candidate node_modules junction; original tree not changed. Candidate8311 runs loopback18789, all prior27 gates preserved, new accountAccess/collaboration false. Candidate temporary Cloudflare PID2756, origin recorded privately; production ingress unchanged. Candidate CORS additionally permits only http://127.0.0.1:19064 for preview.

Production remains APIe7d3ffec/anchoref2d053/27gates, SQL health200. Recovery CheckOnly RUNTIME_AND_ORIGIN_MATCH, no processes started. Fresh Hosting release1793054270493000/version9bf5c7cba086fb4d;95/95 captured assets match PR149 anchor19d504. Comparing to older ef2d found exactly3 PR149 files; this was resolved by immutable95/95 comparison, not unexplained drift. Current rule source backed up: ruleset7dcc6e4d-3b95-497d-a0d6-9cc51d00ad7e, SHA7258aa2eaecab8936feb7aa450bee223a22d1c6798ddfe08964cb3358f358e6a. Original API launcher/source manifest/recovery config also backed up privately. Current production launcher is the P-drive CustomReports staging launcher referenced by recovery config; C:\PAWS\Runtime\Start-PAWSApi-Temporary.ps1 is an older registered task launcher, not the current release source. Do not revive it.

## Actual acceptance

Normal-password Owner and Tim Faculty-only API GET matrix passed (Owner15accounts/1group/4sanitized candidates/empty announcements, Faculty management403, anonymous401). Both normal browser roles passed actual candidate User Management; Owner search and groups load, Faculty sees only own summary. Actual Calendar initial6/8 types and no default work activities. Both accounts signed out; old private state cleared. Native Ctrl+plus did not change IAB viewport/DPR, so native zoom remains unverified. No real account grant/group/announcement/assignment was modified as a fixture. Probe credentials traveled only transient stdin; the probe process was stopped after receipt, no password/token persisted.

## Newly approved scope — do this next

Owner explicitly says use Tim, who is Faculty, HICC and VISC, and approved this same PR extending actual multi-role authority: retain Faculty; HICC/Course Coordinator only VTMD505; VISC only Bovine; academic year/effective dates enforced. This is no longer a missing-HICC-login blocker. Read-only SQL found AY2026–27 Course Coordinator505 with missing legacy dates; VISC Bovine has schedule2026-05-01..2027-04-30. Tim has no TeachingResponsibilityAssignee. Only existing505 responsibility found is historical P2 acceptance; do not reuse/relabel it. Legacy Firestore group Bovine owner is someone else, Tim is a member; do not transfer ownership to manufacture access.

Specs/plans2026-10-27-effective-multiple-teaching-roles.md now define reuse of the existing responsibility/course/group/assignee graph, effective role descriptors alongside BaseRole, versioned Owner grant preview/commit/audit, scope-aware Teaching Assignments/SWAP and preserved collaboration ownership. Use the prior explicit default2026-05-01..2027-04-30 for a newly approved CC grant with default provenance; do not rewrite legacy appointment/DOE values. User already approved bounded scope and chose sequential implementation with final independent review; no grilling or repeated execution-method question.

First pure policy module server/src/access/effective-teaching-access.js and9 tests added locally. Observed MODULE_NOT_FOUND RED then9/9 GREEN. deriveEffectiveTeachingAccess({profile,assignments,academicYear,asOfDate}) produces baseRole,effectiveRoles,responsibilities,scopeVersion; canUseTeachingResponsibility checks exact canonical course/group. Covers dual roles, expiry/year/other person/scope, unknown dates, global roles, version changes and sanitized descriptors. This module is NOT wired to SQL/API/UI yet. Task1 remains partial. New schema061, grant command, exact Tim preview/application, integration, whole-branch review, new freeze/CI and release remain. Do not represent8311 CI as proof of these later bytes. Keep cb4298c frozen anchor until an independently reviewed new product promotion; current added runtime module is expected drift while development is unfinished.

## Original workbook

Updated original C:\Users\xinyu.zhu1\Desktop\PAWS进度管理\outputs\paws-20261015\PAWS任务进度.xlsx, SHA7c32bd5220ab6173ed989fbb740cd8e25a065ebd6cfa1283d671e80b8d1a9d43.19 actual changed cells,0style changes,39tasks/46checks/16passed/29open/1N/A.26 baseline current;27 still partial/under acceptance, new multi-role gap and approval recorded. All native features/formulas and human signatures preserved. Backup original-before-access-progress-20261027.xlsx.bak, do not overwrite old26 backup. Marker ran exactly once for this edit. Artifact Tool exported then native-fast-failed; verifier completed every assertion and atomic original copy, then only printing failed due cp1252. Separate UTF8 readback verified exact candidate/original bytes, preserved signatures/counts and19changes. Do not rerun authoring/marker or verifier blindly. Private existing builder/state/verifier in ledger-update-20261024 were patched for accurate current status, no old reports mode run.

## Exact breakpoint

Current pushed PR head8311 remains Draft, all7green, staged candidate read-only. Local new multi-role spec/plan/policy/tests and this update are unfinished work. Continue Task1/2 of the new plan: explicit trusted SQL authority loader and versioned/audited grant command, then workflow/SWAP/UI. No new real Tim grant yet; no production API restart, new gate activation, Hosting/rules release, data import or merge. Full deployment authorization persists after acceptance. No Codex memory edit.
