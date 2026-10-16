# Agent Update — Calendar activity UI and acceptance checkpoint

**Date:** 2026-10-14  
**Repository:** Alex1122341/Teaching-assignment-azure  
**Task status:** PARTIAL — Tasks1–6 complete; Task7 acceptance/review/release pending

## Goal and breakpoint

Owner approved the design and seven-task implementation plan, with root sequential implementation and one independent whole-branch review. Branch `feat/calendar-working-activities-20261014`, draft PR98; approved documentation ancestry PR97. Continue Beta, despite the unrelated default Experimental workspace.

## Work performed

- Tasks4/5 now accepted: eleven actual two-connection SQL races passed; unknown working time takes priority over known conflicts and blocks Owner overrides. SQL041 proves proc-only roles, private-data denial and protected cascade checks under minimal metadata visibility. Internal lock/metadata helpers use their owner only for the narrow closed operation and receive no direct runtime execute grant.
- Task6 complete at `8f103d8`: original date-range lane below teaching grids, SQL CCC toggle/category filtering, authorized faculty schedule and administrator migration preview. Missing time/course/room/group remains Not provided. New activity range data never enters timed-grid Sessions, session selection or DOE calculations.
- Task7 self-check corrected short academic-year context (`2026-27`), stale/reopened import receipt handling, invalid upload retaining an old preview and existing test runtime inventories. New faculty schedule/import helpers stay in their new modules; the existing Dashboard controller remains below its unchanged 60KB guard. Dependency graph now has exactly two added Dashboard scripts and three added static assets; no retired modules or Firestore SDK returned to Dashboard.
- Browser fixture uses real demo Firebase Auth emulator identity and actual authenticated activity API/router with synthetic repository/parser data and an explicit file-hash stub for synthetic upload. Existing unrelated timetable Firestore accesses are disabled only in the fixture; no real Firebase/University business data is written. Actual source hash/parser and real SQL transaction/race boundaries are accepted separately.

## Validation

- Disposable SQL run38643556361, product14867ba: all038–041 foundation/commands/recovery/SWAP/least-privilege checks and eleven actual wait proofs passed.
- Full server `npm test --prefix server`: 589 total, 588 passed, one local SQL skip. Initial simultaneous root/server execution triggered one real parser deadline under resource contention; independent server rerun passed with the production ten-second deadline unchanged.
- Task6 focused45/45; latest closure/compatibility suite99/99; artifact inventory plus academic/UI checks21/21.
- Full root run at14867ba:826 total,776 passed,32 skipped,18 failed. Twelve non-freeze failures were old runtime inventories/CCC-source expectations or identified UI regressions, now covered by focused passing checks. Six immutable baseline/count checks remain expected pending independently reviewed freeze promotion. Do not claim full root suite green yet.
- Chrome desktop1440x1000 and mobile390x844 fixture covers toggles, day/week/month/list ranges, faculty/admin scope, preview/quarantine/exclusion, explicit confirmation, stale refresh and same-key lost-response retry. Browser HTTP503/409 console entries are intentional injected failures; no unexplained application exception is accepted. Screenshots live outside Git under the local Temp paws-calendar-qa-20261014 directory.

## Live actions and remaining work

No new live schema/data/role/gate change, merge or deployment. Prior known release remainsca465bf/trustfb2c625; do not repeat Canton archive or retained source additions. Course Calendar replacement remains capability-only.

Continue Task7: inspect final browser evidence; independently review the exact whole product branch, fix important findings once with regressions, then independently review separate freeze governance anchored to the accepted product SHA. Complete full suites, artifact attestation, actual live module hashes, dedicated least-privilege runtime/recovery-storage proof and fresh source preview. Merge/SQL/API/Hosting release and exact permanent source migration need separate concrete owner approvals. Do not mark module complete before those actions are accepted.

Authoritative recovery ledger: `.superpowers/sdd/2026-10-14-calendar-working-activities-implementation-plans/progress.md`; Task7 is in progress. Preserve the externally appearing untracked race-wait-observe fixture untouched and outside commits. Preserve all ledger rulings and costs before any scratch cleanup.
