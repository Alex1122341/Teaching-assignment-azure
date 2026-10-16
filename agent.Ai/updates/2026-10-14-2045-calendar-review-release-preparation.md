# Agent Update — Calendar review and release preparation

**Date:**2026-10-14 20:45 America/Edmonton
**Agent/model:**Codex primary; independent GPT-6.1 Sol / extra-high reviews
**Repository:**Alex1122341/Teaching-assignment-azure
**Task status:**PARTIAL — review/preparation accepted, live release/source operation pending

## 1. Goal

Resume the approved sequential Calendar working-activity plan. Owner confirms dedicated Windows service account is not ready and asks to finish review/release preparation first.

## 2. Starting breakpoint

- Main base0d4b4d9ea2e658719e87f16ef5132b82544bc6c1; branch feat/calendar-working-activities-20261014.
- Prior update2026-10-14-1610-calendar-activity-ui-acceptance.md; Tasks1–6 complete, Task7 pending review/acceptance.
- Draft PR98: https://github.com/Alex1122341/Teaching-assignment-azure/pull/98 .
- Actual worktree: Desktop/Teaching-assignment-azure-worktrees/afc-record-management-20261013. Default Teaching-assignment-main is the other repository; do not use it for this task.

## 3. Work performed

- Independent whole-product review through72b238b:82/82 focused tests, no Critical findings. Executor graded and fixed two Important issues in one TDD pass: full exact AFC target-set revalidation and category context before destructive confirmation. Accepted runtime product7526e86f295de062c228fb1ddee2f007706285c2.
- Added two exact AFC-lock races (13 total) and guarded empty/populated rollback rehearsal. Runner cleanup follows ImportRow→ImportSheet→ImportWorkbook→ImportBatch. SQL Server CREATE OR ALTER metadata padding alone is normalized; parameters/body and SET flags stay strict.
- Separate governance review fd50c2c..9f4290d independently checked74 immutable hashes and no lost coverage;11/11 focused checks, no actionable findings. Only constant/report/count expectations changed. CI exposed one further old current-anchor literal in deployment test; observed RED,9202ad0 changes only expectation,14/14 GREEN.
- Final builds/inventory/freeze acceptance and Chrome synthetic UI acceptance completed. Full review and exhaustive rulings preserved in docs/calendar-activity-review-20261014.md. Task7 workspace remains because release/data phases are incomplete.
- University preflight was SELECT-only: procedure hashes and aggregate counts. No SQL/account/data/gate mutation, merge or publication.

## 4. Files / components changed

Product Tasks1–6 and final fix7526e86 are summarized in review/release documents. This checkpoint refreshes docs/calendar-working-activities-release-20261014.md, docs/calendar-activity-governance-20261014.md, new review record and continuity memory. Governance9202ad0 corrects only tests/azure-deployment.test.js current anchor literal.

## 5. Architecture / invariants

Firebase identity → University API → University SQL remains intact. No Firestore business fallback, protection bypass, new drift allowance or live role/gate exception. Dedicated least-privilege identity blocks this new release. Old AFC/LAB baseline remains pinned in its historical regression.

## 6. Data / algorithms

Commit now rechecks complete current matching AFC cardinality/IDs/versions with retained locks before receipt/activity changes, refusing a late duplicate atomically. Preview shows row category and accepted/source category totals. No inferred dates/times/courses/years/groups. OPA/leave/travel remain AFC. Current workbook read-only parse812/541/255/12/4, zero formula rows, unchanged approved hash. These totals do not authorize541 live deletions. Two deferred minors are documented: formula rows quarantine instead of whole-workbook pre-stage rejection; Reset does not restore the new activity controls.

## 7. Tests / CI evidence

Verified candidate9202ad0736543205f6717860363614cbfd2adcef; CI PR merge53019d8fb5cec31ece484d0e723a6ce0df1b2274 into main0d4b4d9.

- Beta Build38671919004 success: root831 total799 pass32 emulator skips0 fail; Linux server590 total588 pass2 skips0 fail; full Auth/Firestore emulator831/831 zero skips; baseline/deployment56/56; container and all repository/artifact freezes passed.
- SQL acceptance38671919009 and migration38671918997 success.13 actual two-connection proofs, atomic/recovery/SWAP/minimal roles and populated-refusal/empty-restore rollback accepted.
- Local Windows server590 total589 pass1 SQL skip0 fail. Windows ACL test actually runs locally; Linux skips it. Local Java unavailable; CI covers all32 emulator tests.
- Local root9f run831 total798 pass32 skips1 fail is retained RED evidence of old deployment literal. Corrected candidate CI and14/14 local deployment suite passed; do not call the old local run green.
- Six plan build/freeze commands exited0;74 static paths,73 API runtime paths+Dockerfile/two package inputs=76. Generated app75 files/API74 including inventory.74 Hosting assets byte-identical across generated outputs, no private payloads. Worker and locked dependencies present.
- CI uploaded artifact11943529836, digest e90cf030116e7387806c74c83af149d1ec49f37f766146ef4ef07476603e2465. PR merge artifact only,7-day retention; future exact-main artifact required.
- Chrome1440/390 widths: real demo Auth with synthetic repository/parser/hash hook. Dates/categories/profile scope/import/409/503 retry/Needs Review denial passed. Three expected injected HTTP errors; no JS exception. Screenshots Temp/paws-calendar-qa-20261014; owned Auth emulator stopped.

## 8. Live operations

### Performed

SELECT-only University module-definition/hash/SET flags and aggregate-state preflight. Git commits/pushes on the feature branch and PR documentation updates.

### Explicitly not performed

No merge, deployment, SQL migration, live writes/import/delete/recovery, role binding, account creation, gate enablement, archive repeat or source-file modification.

## 9. Current state

- Runtime product7526e86; reviewed governance9f4290d plus test literal correction9202ad0. Documentation follow-up does not change runtime.
- Draft PR98 remains unmerged; use its latest-head CI status for the final documentation checkpoint.
- Prior released runtime remains unchanged. Preflight found1937 Sessions/4970 assignments/119 active+2 inactive faculty/803 active imported AFC/1 manual AFC/0 requests/0 Calendar objects. Time-bound only.

## 10. Blockers / unresolved

Dedicated Windows service account not ready; current principal remains db_owner. Private University recovery destination/ACL proof not complete. Fresh source/live target preview, exact role/gate/runtime acceptance and separate merge/release/source-operation authorizations remain required. Other full-directive work remains outside this module. Minor formula policy caveat must not be claimed as a passed Review Focus.

## 11. Exact breakpoint

Tasks1–6 complete; Task7 pre-release code, review and artifact preparation accepted. Retain the ignored plan ledger/workspace and prepared artifacts. Await dedicated principal/recovery setup and concrete future authorization before integration or destructive source cleanup. Read full release manifest and review record; do not restart implementation/review.

## 12. Next safe action

Read latest PR98 head/checks. Once the dedicated domain account is available, prepare/review its exact minimal grants and private recovery destination without enabling gates; regenerate live preflight and a concrete coordinated release request. Do not stage/delete real AFC yet.

## 13. DO NOT REDO

Tasks1–6 implementation, completed whole-product/governance reviews, previous departed-person archive, retained row812 insertion, PR94/95 release. Do not touch unrelated18788 process or untracked server/test/fixtures/calendar-activity-race-wait-observe.sql. Do not clean the plan workspace or move Beta work to the Experimental repository.

## 14. Suggested next-agent prompt

Continue PR98 from the review/preparation checkpoint. Respect preparation-only instruction, validate exact latest head and prerequisites, keep Calendar gates disabled, and request no duplicate design/plan/account confirmation. Release and source migration remain separately authorized operations.