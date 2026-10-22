# PAWS Beta CCC Schedule — 2026-10-21 code review and release gate

Repository: `Alex1122341/Teaching-assignment-azure`; PR #130; branch: `feature/ccc-schedule-readonly-20261021`.
Review entry HEAD: `9250b9614293d5b0ca32c2da14c9ea97a7a5fc81`.
Current product correction: `dcb5b9779edafd33e19970ad65abbbadd9ac9008`.

## Corrections committed

- `ccc-schedule.js`: render a distinct error state instead of silently showing a successful empty schedule after rejected, malformed or unavailable reads. Reject malformed source rows rather than silently dropping staff assignments. Clear the open modal on Firebase signout and refetch when the authorized profile updates.
- `rollback_057_ccc_schedule_read.sql`: reject rollback unless the installed procedure definition SHA-256 equals an independently captured approved before-image. Require the expected SQLCMD variable `PAWS_CCC_SCHEDULE_DEFINITION_SHA256`, refuse nonstandard grants, explicitly revoke permitted EXECUTE, and use a transaction for the DDL removal. Nothing about this script has been tested against SQL Server.
- Added focused source regression assertions. The previous executor's 23 PASS, root955 PASS/18 FAIL/52 SKIP, server829 PASS/4 SKIP and emulator33 PASS/0 FAIL were on earlier HEAD `9250b96`; they do not validate these changes.

## Release blockers verified

- PR #130 is Draft, without independent GitHub reviews or governance approval. Active immutable anchor is `370c30a21d99ae7227f97f1e0cb781864c674768`. Static/API drift and root freeze assertions must be resolved through separate independently approved promotion; do not hand-edit the anchor.
- GitHub Actions runs on prior HEAD fail before any steps; no successful current-head CI or authorized PR-specific substitute.
- SQL 057 has not been rehearsed on an independently identified disposable SQL Server, and guarded rollback has no actual SQL execution proof. The official SQL harness resets a synthetic DB and **must never** run against production ITAPPVETOPSDB01.
- The only currently online Remote Desktop Commander device is University machine `ITAPPVETOPSDB01`. The executor's uncommitted local workstation modifications and tests cannot be retrieved from that host; its `C:\PAWS\Teaching-assignment-azure` checkout is an older live release, not PR130.
- University server reports Firebase configuration absent and does not show an available Firebase executable in standard PowerShell command lookup. No authenticated user/Faculty browser acceptance for PR130.
- Full source/application/environment artifact evidence on new head is unavailable, and independent product approval / deployment credentials remain unavailable.

## Actions explicitly NOT performed

No PR merge, protected freeze promotion, production SQL migration/rollback, University API build/cutover/restart, Firebase Hosting deploy, changes to DOE/Availability/CCC source business records, or synthetic SQL testing on University SQL. Prior production remains untouched.

## Next release readiness action

Obtain complete current-source validation (Node22 targeted/full server/root/emulator/build), disposable SQL057 & rollback proof including definition hash; independent product/security review and approved freeze governance commit; PR130-specific CI alternative approval if GitHub Actions still cannot start; authorized Firebase login and Admin/Faculty live integration plan. After these succeed, bind reviewed product SHA, merge per repo policy, verify exact-main artifact, coordinate SQL procedure + API + Hosting-only deploy, preserve rollback and smoke test.

Do not claim deployment complete merely because the user requested direct deployment. These are hard external security/release conditions.