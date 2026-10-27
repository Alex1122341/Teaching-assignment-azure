# Agent Update — PR148 multiple-role grant foundation

**Date:** 2026-10-27  
**Repository:** Alex1122341/Teaching-assignment-azure  
**Task status:** PARTIAL

## Goal and starting breakpoint

Continue same PR148 on feat/effective-access-20261026, local01fb042 after pure-policy5e0f9a1; pushed8311e99 was the earlier accepted single-base-role candidate. Owner explicitly approved Tim retaining Faculty, HICC/CC only505 and VISC onlyBovine by year/dates. Latest owner instruction additionally authorizes creating an account for a suitably scoped existing Faculty if actually necessary for testing, then handing over credentials. No such account has been created; Tim remains the first choice. Do not create fake teaching grants or modify real business packages merely to obtain a green test.

## Work performed

- Added pure buildLeadershipGrantIntent with13 behavioral tests: ready Owner and linked active self-service target, closed change input, canonical definitions, source person/year/kind/course matching, explicit default provenance, recorded date coverage without gaps/overlap, exact managed revocation, overlap rejection, version-bound order-independent intent hash and sanitized authority evidence. Observed missing-module RED before implementation; a later corrupt legacy-end-date RED was fixed with explicit validation.
- Found actual035 schedule schema already has ScheduleVersion; SQL061 now reuses it rather than adding an impossible second rowversion. Prerequisite marker-null check is fail-closed. Source signature includes canonical CourseId.
- Added retained authority epoch to pure effective-access fingerprint and repository snapshot. Empty→grant→empty invalidates old context; observed failing ABA test before fix. SQL reader snapshot includes an epoch even when it returns no assignee and rejects absent/mixed epoch states. Two new reader tests failed before implementation then passed.
- SQL061 development foundation adds versions to six existing graph/source tables, a disabled additional-role state, source-approval/operation storage and read-only functions. Fixed-object triggers on authority tables plus Faculty/Course/Schedule update only the epoch, never their business values. No real identity/grant is seeded. Actual SQL execution remains pending.
- Added marker-guarded disposable SQL foundation tests for preserved profile values, ScheduleVersion reuse, legacy same-kind paths versus explicitly approved additional roles, dual canonical course/area descriptors, year/end-exclusive dates, definition/schedule/deletion ABA, source/profile revocation and used/unused rollback. New launcher reuses every existing060 proof and fresh inspected Docker resets; it has no school connection argument or fallback. Account Access workflow now calls it and requires061 markers in addition to all060 markers.

## Verification and limits

Focused Node22 checks:52/52 pass (new policy/reader plus existing account/collaboration). PowerShell parser accepted the new disposable launcher. git diff --check passes (normal Windows LF/CRLF notices only). Full local root/server processes started, exact results pending at this checkpoint. No Docker/sqlcmd is installed locally; do not call source/JS tests real SQL acceptance. The Draft push is intended to execute the SQL workflow. Build freeze drift is expected from unfinished added runtime files; do not advance cb4298c anchor or claim a current green release.

## Rulings

Ruling: use one retained authority epoch in addition to rowversions — rowversions on surviving rows cannot detect deletion back to an empty list — unrelated authority edits may conservatively invalidate another pending preview.

Ruling: keep SQL foundation independently testable before the Owner command and consumers — accepted earlier8311 evidence cannot verify new SQL syntax — no production061 application until actual isolated foundation/command/recovery acceptance and final review.

## Exact next work

Collect local test logs and actual Draft SQL workflow result; correct reproduced SQL defects. Complete Task2 Owner grant command/repository/API, transactional source/date/scope rechecks, response-loss replay and audit/recovery. Then Task3 workflow/SWAP, Task4 self/guard/UI/collaboration, exact Tim preview, independent product/governance, new exact-head/main acceptance and coordinated release. The original workbook has already been updated to the pending status; do not repeat authoring just for this checkpoint.

## Live changes

None during this continuation. No SQL061 application, Tim grant, Auth account creation, production restart, gate activation, Hosting/rules release or merge. Prior SQL060/IAM installation and old candidate/production versions remain as recorded in2026-10-27-service-acceptance-and-multiple-roles.md; verify mutable live facts before acting. No Codex memory edit.
