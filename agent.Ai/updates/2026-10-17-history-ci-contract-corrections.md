# Agent Update — History final CI contract corrections

**Date:** 2026-10-17 America/Edmonton  
**Repository:** Alex1122341/Teaching-assignment-azure  
**Task status:** PARTIAL — final build CI retry

## Goal / breakpoint
Continue PR11209–11 acceptance, authorized merge and release preparation. Branch feat/faculty-change-history-20261016 at95ad477, accepted product0798408, previous update2026-10-17-faculty-history-candidate-and-release-blocker.md. Prior540 migration completed; never replay.

## Work and root cause
Final candidate Linux Build39035901918 reached npm test:936tests/874pass/10fail/52skip. All10failures were pre-history contract expectations: old3d freeze anchor,75asset count,20local/22total Dashboard scripts, client key allowlist missing3historyGETmethods, VM harness still mounting legacy history. Actual runtime remained accepted0798408.

Eight test files now pin the exact accepted surface (77assets,21local/23total scripts,3read methods,079anchor). Harness mounts shared SQL history, throws on legacy access and verifies destroy on close. Added no-Firestore proof for the new history module. Existing privacy, legacy writer prohibitions, artifact byte checks and immutable governance remain intact. No product edits. Plan task1–3 checkboxes now reflect completed evidence.

## Verification / review
Affected8file local execution119/119pass,0skip. Same independent reviewer accepted correction-only delta Ready, independently60/60pass. Full root npm test launched; canonical Linux retry pending. Both95ad477 synthetic SQL suites completed success:39035901914 Calendar Activity SQL Acceptance,39035901902 Azure SQL Migration Tests. Expanded SQL includes047schema/scopes/rollback. Separate governance review previously Ready,77static/81API+3inputs84protected; noexceptions.

## Live / release
No live SQL/API/Hosting changes. Last remote check school device offline. Schema047→UniversityAPI→Hosting remains required. Owner authorizes acceptance/merge/publish and waives dedicatedruntimeaccount prerequisite; skip unavailable human steps, no questions. Workbook original09–11 already updated验收中/待发布; refresh final CI/merge/package when known. Preserve9originalchecks passed/8open/1N/A until actual evidence.

## Next safe action
Finish full root suite and inspect failures honestly, commit/push correction-only delta, require candidate Build+SQLsuccess, verify downloaded immutableartifact, markPR112ready and merge exacthead. Verify exact-mainpushCI/artifact. Defer actual SQL047/API/Hosting until Universitydevice reachable. Update original workbook and continuity with exact final states.
