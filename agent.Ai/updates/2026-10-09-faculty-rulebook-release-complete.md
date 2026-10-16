# Agent Update — Faculty UI and DOE Rule Book release complete

**Date:** 2026-10-09  
**Agent/model:** Codex  
**Repository:** Alex1122341/Teaching-assignment-azure  
**Task status:** COMPLETE

## 1. Goal

Deliver reference-like Faculty Lookup/Edit and structured DOE Rule Book administration; publish under the owner's explicit authorization.

## 2. Starting breakpoint

Continued fix/doe-sql-draft-clone-20261009 at bdf12e84980a5c339cc1065b305758e93fbc6f06. Prior update: 2026-10-09-faculty-rulebook-deployed-and-sql-hotfix.md. PR77 had released c5f7106; PR78 hotfix release was pending in the durable checkpoint.

## 3. Work performed

Faculty profile/editor sections, expandable course details and AFC history delivered. Rule Book typed editors, categories/groups/tabs, references, validation/impact/history, same-year clone and cross-year copy delivered. Signed manual adjustments remain separate.

Live SQL compilation exposed invalid nvarchar(8000) declarations. Repaired six declarations, made clone creation/content/audits atomic, repaired the guarded publication checksum SELECT and synchronized the loaded version selector. Product and governance reviews accepted the changes.

Merged PR78, completed exact-main CI, attested 60 runtime source files, performed guarded API cutover with rollback available, and completed the 62-file Firebase Hosting-only release. Inspected the live original six-rule Draft and saved screenshots. Final public runtime and SQL health reads both returned status ok.

## 4. Files / components changed

Faculty admin JS/HTML/CSS; structured Rule Book JS/CSS; SQL policy, assignment and target-override repositories; runtime freeze/reporting metadata. This closeout updates only continuity documentation and the completed plan.

## 5. Architecture / invariants affected

Preserved SQL authority, canonical identity, privacy, revision guards, immutable Active versions and negotiated manual DOE separation. Existing dated DECISIONS.md records the owner-authorized admin scope. Deployment does not activate annual rules or recalculate allocations.

## 6. Data / algorithm changes

Clone now commits version, content and audit together. No source import, rate invention, deferred-target fill, annual activation or allocation recalculation during this release.

## 7. Tests / CI evidence

No new tests or local test suites run. Syntax/build/freeze checks succeeded. Existing automatic PR CI37947427258 succeeded at bdf12e84980a5c339cc1065b305758e93fbc6f06; exact-main CI37947990687 succeeded at 2b48f7d4131d562a9b3e3ac29e9d88ab4ebb737a. Existing root, SQL-auth, emulator, release/Docker and governance checks completed successfully. Read-only SQL NOEXEC compilation diagnostics succeeded after repair.

## 8. Live operations

### Performed

API deployment on ITAPPVETOPSDB01, device d37ae8da-eb73-4984-bb2c-e1d3dcd102ea, PID31700 at 127.0.0.1:18787. Runtime P:\PAWS\Runtime\Versions\2b48f7d4131d562a9b3e3ac29e9d88ab4ebb737a\server; launcher and cutover evidence P:\PAWS\Runtime\Acceptance\DoeDraftHotfix-20261009. Hosting-only deployment to tester-teaching completed with exit0.

### Explicitly NOT performed

No schema migration, source reimport, business-policy publish/recalculate/archive, credential change or Firestore rules/index/Functions deployment. Hotfix preserved write gates and existing scoped roles.

## 9. Current state after task

PR77 and PR78 merged. Live main release 2b48f7d4131d562a9b3e3ac29e9d88ab4ebb737a; trust/product anchor902a6cc6a876e24badf12df1deb7853fc0cc2993. Public Faculty page https://tester-teaching.web.app/faculty-admin.html. Public API https://radar-languages-shopper-corporate.trycloudflare.com. Frontend policy asset canonical SHA2566527c369d862c68d8e1b690f8aa186259f909b6f2327fce6aad4c97419ab6479 matches the product blob.

Post-release SQL reads: legacy Active E867DB29-CB36-40E7-9BC7-32539F8FF7A2 has0 rules; original normalized Draft A607A73D-ED99-40E4-A9D3-81DDF6D1E327 has6 rules; older failed clone327C6669-C49B-4B7C-9238-B3D25A59CDAD remains0 rules/revision0. ManualDoeAssignment0; DoeAssignmentFact0.

Screenshot evidence: C:/Users/xinyu/Documents/Codex/2026-08-31/outputs/faculty-rulebook-20261009/faculty-edit.png, faculty-lookup.png, doe-rulebook.png and doe-rulebook-table.png. Rule Book table screenshot was inspected after hotfix deployment.

## 10. Blockers / unresolved questions

No blocker to the authorized UI/code release. Existing failed empty clone remains untouched; select the original normalized Draft to see six rules. Server C drive has0 free bytes; current release, temporary files and logs use P. Disk capacity needs a separately scoped operational follow-up. Deferred contract targets remain unfilled as directed.

## 11. Exact current breakpoint

Release complete and publicly healthy. Final closeout documents are on the feature branch; they require no runtime redeployment. Continue only from a new concrete instruction.

## 12. Next safe action

Use the deployed Faculty page. If instructed to manage annual policy, select the intended version and use guarded validation/impact/publication controls.

## 13. DO NOT REDO

Do not repeat imports, deployment, migration, scoped role binding or clone creation. Do not silently populate/archive the old failed clone or fill deferred targets. Preserve the P rollback launcher Start-Previous-FacultyRulebook.ps1 and existing DPAPI credentials.
