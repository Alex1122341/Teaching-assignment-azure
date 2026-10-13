# Agent Update — AFC record management and grouped LAB candidate

**Date:** 2026-10-13  
**Agent/model:** Codex  
**Repository:** Alex1122341/Teaching-assignment-azure  
**Task status:** PARTIAL — product candidate; PR/release verification pending

## 1. Goal

Enable AFC creation according to server capabilities, hide visible UID/GUID, allow administrator row cancellation when travel changes, and reshape LAB details into the approved reference table.

## 2. Starting breakpoint

- Base: origin/main, 3f8db17f1b821454b8665044eb5f6c01234317d1.
- Branch: fix/afc-record-management-20261013 in the isolated azure-worktrees checkout.
- Prior context: 2026-10-12 DOE rule selections update.
- User explicitly selected this Beta repository on 2026-10-13 despite Experimental AGENTS context in the task's original directory.
- Public health was read earlier: live API a9b80615f07761964eef12c50a024ea9167eddf8, trust22a4734b3ebcdb1aa4ccd6349e8c69adb9436b7d, AFC single/batch enabled. These are point-in-time reads, not candidate release evidence.

## 3. Work performed

Product code/tests and release instructions prepared. Read-only code review found one SQL-list token mapper omission; fixed with repository-to-API regression. Synthetic Chrome LAB preview inspected and saved privately under output/lab-preview.png. No live writes or deployments.

## 4. Files / components changed

Dashboard controller, new faculty-admin-afc-records helper, authenticated client capabilities/cancel route, Dashboard API adapter/repository, default-off gate, migration036 and rollback acceptance script. New lab-session-detail helper, timetable modal/CSS, script allowlist and regression harnesses. Details: docs/afc-record-management-lab-release-20261013.md.

## 5. Architecture / invariants affected

Firebase identity -> University API -> SQL business authority preserved. No Firestore fallback/rule changes. Independent AFC cancellation added under owner approval; exact SQL admin validation and trusted audit identity preserved. Separate reviewed immutable freeze promotion follows product commit.

## 6. Data / algorithm changes

Names replace visible internal IDs; ambiguous faculty names remain rejected. Active-only AFC default; Delete sets Active=0, keeps history, locks and verifies rowversion, audits atomically, repeated cancellation is idempotent. LAB grouping uses only authorized cached rows with exact course/date/year/academic-year scope. Unknown groups, time and room remain explicit. DOE and approval algorithms unchanged.

## 7. Tests / CI evidence

At product preparation: `npm test` under server passed509/509; targeted Dashboard/client/LAB suite121/121; new LAB controller/helper suite6/6, including original-row action routing, closed edit gate and pending status. Full root/freeze final evidence will be recorded in the follow-up governance/PR update. Local candidate is uncommitted at this checkpoint; do not treat these as hosted or exact-main evidence.

## 8. Live operations

Only public health read. No credentials used/stored, SQL writes, migration execution, gate/permission change, Firebase mutation, merge or deployment.

## 9. Current state after task

Candidate prepared in isolated feature branch. Product and governance commits/PR will be recorded by follow-up checkpoint. Existing live release remains unchanged by this task.

## 10. Blockers / unresolved questions

Live SQL compilation, imported/stale/concurrent acceptance and runtime permission binding require the approved release environment. Existing source has no real rotation groups. No fabricated values were added.

## 11. Exact current breakpoint

Finish full root tests, commit reviewed product, independently promote static/API anchor to that product with canonical reporting hashes and governance review, verify repository/artifact freezes, then push/open PR. Require final-head hosted CI. Release requires concrete owner authorization and directed coordinated SQL/API/Hosting steps.

## 12. Next safe action

Follow the release document after reviewed PR and exact-main CI. Keep cancellation closed until SQL acceptance and narrow membership verified.

## 13. DO NOT REDO

Do not recreate a second frontend, import Experimental code/data, rerun historical SQL imports/migrations, expose internal IDs, invent groups/time slots, hard-delete AFC history, or assume the candidate is deployed.
