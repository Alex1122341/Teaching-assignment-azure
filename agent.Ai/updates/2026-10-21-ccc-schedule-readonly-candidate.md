# Agent Update — CCC Schedule read-only viewer

**Date:** 2026-10-21
**Agent/model:** GPT-6
**Repository:** Alex1122341/Teaching-assignment-azure
**Task status:** PARTIAL — coded, Draft PR; acceptance/deployment pending

## Goal and start
Create an all-user read-only CCC schedule window immediately next to the Faculty Dashboard, from current authoritative CCC staffing rows, without DOE or availability changes. Inspected 1,011-file full tree and relevant identity/SQL/runtime/UI/CCC replacement/DOE governance. Base main: `a46c3bd9075af146177b7a0b614a4955e829c2fd`. Open unrelated environment PR125 remains.

## Work performed
- Added read-only SQL `paws_api.ListCccSchedule` and guarded drop migration `057`; live source is `paws.CalendarActivity`, plus current faculty name, course and verified day-time evidence. Read actor is checked in both API and SQL; grant is EXECUTE to `paws_runtime_read` only.
- Added independently scoped authenticated GET `/api/v1/ccc-schedule?academicYear=YYYY-YY`, sanitized return values, length limits, plus University API routing and browser client.
- Added top-bar CCC Schedule button; 1100px max-width floating modal, year/search/refresh, keyboard, escape, focus containment, responsive layout. Refresh when opened, while visible every 60s and on tab return. No persistent copied schedule.
- Added focused server/browser source tests and static build allowlist entries. Did not broaden the self-only `ListCalendarActivities` procedure or its permissions.
- Half day is displayed only with an explicit CCC label or single-day verified short (<=300 minute) timing evidence; annual DOE deductions are never used.

## Files
See Draft PR #130, with 15 source/test/docs paths modified. Product commits `d7abb23f803cd65a057b0bb6ccbb5a2d830e3811` and `8a31a6d65ec180e078500023ca89816bd095605f`.

## Architecture and invariants
Maintains SQL business authority, Firebase identity, supported-role checks, existing CCC replacement semantics, and separate availability/DOE systems. New reader has no write methods; role self-scope restrictions elsewhere remain unchanged. No source workbook replay or new table.

## Testing and release
- Inspected head and compare; commit 8a31a6d is two commits ahead, no behind at comparison time, 15 changed files.
- Node v22.16.0 and Git available in isolated container, but GitHub DNS is unavailable; private repo cannot be cloned. No runnable full repo checkout; **no local full tests, SQL acceptance, or CI success claimed**.
- Static/API immutable freeze is not promoted. Independent review, Node22 root/server/emulator/build, SQL057 real acceptance, baseline governance promotion and exact-head artifacts remain mandatory.
- No SQL migration run, no Firebase deploy, no production API changes, no merge, no DOE/AFC/availability mutation.

## Current checkpoint
Branch `feature/ccc-schedule-readonly-20261021`, Draft PR #130 opened. PR125 remains open and has an unrelated environment-isolation change. Do not merge this draft or deploy directly. Close gaps in actual code/test verification before promotion. Latest main may move independently.

## Next safe action
Review SQL procedure with disposable SQL runner (especially 2500-entry ceiling and half-day evidence), run focused server and UI tests plus full build, correct failures, conduct independent product/security review, reconcile main/PR125, then separately promote the immutable static/API anchor with exact-head and exact-main CI. Only then permit verified SQL/API/Hosting rollout.

## DO NOT REDO
Do not reimport or replace 413 CCC slots; do not replay old 540 AFC migration; do not alter DOE policy or 27 write gates; do not promote or deploy without acceptance. Existing draft branch and PR should be updated, not duplicated.
