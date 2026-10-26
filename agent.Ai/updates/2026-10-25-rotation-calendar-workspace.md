# Agent Update — Rotation Calendar / Other work Dashboard

Date:2026-10-25. Status:PARTIAL, release preparation.

## Goal and starting breakpoint

User requests exclusive Rotation under Calendar Year alongside1–4, CCC/Rotation removed from the old lower work lane, other work in an independent Faculty Dashboard tab, and absent times displayed08:30–16:30. Update the original Excel after completion. Ask report23–25 questions before implementing reports.

Isolated branch `feat/rotation-calendar-workspace-20261025` starts at published main62dfa3c; protected downloaded workspace is untouched. Prior PR139 delivered via140;140–144 are merged/live per private exact-main receipt, superseding older repository checkpoints. Previous official artifact12609642735/Hosting3f8a1259cf686e8a, static92. University API c2c1de4/trust50e7e5c and27 gates stay unchanged.

## Performed

Design/plan committed6a0dab2; pure placement helperd9cc565; integrationa21d4e5; reviewed fixes5826454. Two independent spec/standards reviews found Month hidden overflow and contiguous search; both fixed with RED→GREEN and independently rechecked. Browser exposed an existing time-grid positioning override; minimal CSS correction restores absolute blocks. See docs/ui/rotation-calendar-acceptance-20261025.md for source reuse, screenshots and limits.

The optional clarification about unallocated work had no response after reasonable opportunity; standing user authority chooses recommended meaning: work outside CCC/Rotation/teaching, even if faculty assigned. No person without identity is invented. Remote work stays AFC. CCC Locum remains scheduled. Dates come from existing CalendarActivity records, not annual MASTER appointments. Default time is display-only; raw time evidence and Needs Review/DOE policies remain authoritative.

## Verification

Initial targeted133total/131pass/0fail/2skip; reviewed fixes57/57. Explicit RED had3 failures/18 before fix. Two independent reviewers report no further actionable product findings at5826454. Synthetic1440×900 and390×844 acceptance covers exclusive Rotation, explicit/default time/details, search/category, own-scope identity, error recovery, empty rows and122-row paging. No full production visual audit/native200%zoom claim.

Bounded SQL reads only: CCC413; Rotation41total/33 currentAY; other338total/327 currentAY. SQL053 permission contract inspected; own-scope tab never requests administrator mappings. All119 API inputs remain unchanged; no server/SQL/rules/dependency modifications.

## Current checkpoint / next safe action

Prepare separately reviewed frozen-runtime promotion5826454, static93 with only one new asset and prior union preserved, API119 unchanged. Complete root/server/emulator/build/freeze CI, open/merge reviewed PR, exact-main official artifact and Hosting-only release, public93-file verification/API27gates/native recovery and real Faculty/Admin read-only smoke. Update original progress workbook with source/release evidence and preserve human signoffs. Then inspect and ask owner requirements for custom reports23–25; do not implement reports by assumption.

## Live operations / do not redo

No production business-data mutations, reimports, SQL migration, API restart, permission change, approval requests/emails or DOE writes. No merge/deploy yet for this branch. Do not repeat prior540-row migration/413-slot CCC replacement or roll back live API. Private browser fixtures and evidence remain outside Hosting; committed screenshots contain synthetic data only.

## Final real-role correction / promotion

Real Faculty browser acceptance found the new tab initially lacked an academic year because this role has no administrator summary. Productf4690b1 reads the authorized own-detail year only for this tab; producta28f02d also recovers when the tab was opened before detail arrived. Both were RED→GREEN and independently rechecked with no further findings. Faculty real own-scope read returns0 other ranges for2026–27; this is an honest empty sample, not a populated-domain claim. Final shared anchor is a28f02dc7f0fcd965b963f6c31a5d0890ec71210;93static/119API unchanged in scope. One server-side test assertion now expects the requested display default and verifies original source evidence is unchanged; no server runtime changed. Full CI and release remain pending.
