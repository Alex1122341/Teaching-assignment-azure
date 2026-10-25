# Rotation Calendar workspace implementation plan

> Execute sequentially with superpowers:executing-plans; the owner has delegated routine recommended decisions. Independent product/governance review remains required.

**Goal:** Place dated Rotation/CCC in Calendar, route remaining work to a Dashboard tab, label default08:30–16:30, publish after acceptance and update the tracker before clarifying reports23–25.

**Architecture:** Pure read-only projection over existing sanitized CalendarActivity responses; reuse timetable rendering, scoped cache and Dashboard/API authorization. No backend mutation or import.

**Tech Stack:** Vanilla JS/HTML/CSS, Node22 node:test, existing Firebase Hosting/Auth and University SQL API.

**Spec:** `docs/superpowers/specs/2026-10-25-rotation-calendar-workspace-design.md`.

## Global constraints

- Preserve all119 backend inputs, SQL, Firestore rules, gate values, DOE, identities and original time evidence.
- UI default08:30–16:30 is labelled, not saved as verified source time.
- Never turn annual Rotation appointment dates into a full-year working schedule.
- Faculty self-only scope remains enforced by the API, with no admin mappings fetched for self views.

## Review focus

- Rapid year/range/identity changes cannot display previous authorized rows.
- Rotation is exclusive even when teaching, CCC and other activity types exist.
- Projection IDs never reach teaching edit, selection, SWAP or bulk-write flows.
- Month/list windows preserve source inclusive dates and bound expansion; malformed ranges fail visibly.
- Default time is consistent in blocks/details/exports without silently granting DOE or verified availability.

### Task1: Shared activity placement projection

Files: new `frontend/scripts/calendar-activity-placement.js`, `tests/calendar-activity-placement.test.js`; later register in both page source orders and static manifest.

Interface: `isScheduledActivity(row)`, `projectSessions(rows,{start,end,maxRows})`, `otherActivities(rows)`, `matchesYear(row,selectedYear)`;08:30/16:30 constants. Preserve source row and readonly/timeDefaulted flags.

- [ ] Write failing range/time/category/year tests, run RED, implement minimal pure helper, run GREEN, commit.

### Task2: Calendar integration

Files: timetable.js, calendar-activities.js, calendar-search.js, index.html, Calendar styles; timetable integration and selection tests.

Interface: cache raw scoped rows; schedule rendering uses teaching plus current-scope derived rows, while loading/errors stay visible without duplicate range tables. Actual view selection remains existing day/week/month/list.

- [ ] Write failing exclusive-year, async-scope, details and read-only tests.
- [ ] Implement projection loading/rerender plus Rotation Year button, preserve search cancellation recovery and selection limits.
- [ ] Verify projection/default-time export semantics and current teaching flows; commit.

### Task3: Independent Dashboard other-work tab

Files: faculty-admin.html/js, calendar-activities.js/styles; Dashboard controller tests.

Interface: read-only module/controller using existing authorized range APIs, academicRange, shared formatter and own-scope loading. Keyword/category/count/Retry work without source changes.

- [ ] Write RED tests for exclusion, self-only queries, stale-tab/user/year responses, filters and errors.
- [ ] Implement, run GREEN, verify existing profile/trainee/lazy boundaries; commit.

### Task4: Review, freeze, release and tracker

- [ ] Browser verify common desktop/narrow, long names, defaults and explicit times, empty/error, exclusive Rotation, actual session actions, two-role readonly smoke.
- [ ] Independently review product; commit product then separately review shared static/API promotion, retaining historical receipts and union coverage.
- [ ] Full CI/root/server/emulator/build/freeze; merge after green, exact-main official artifact, Hosting-only publish, raw hashes/API27gates/recovery and actual browser acceptance.
- [ ] Update original progress workbook without changing human signoffs; do not mark broad tasks complete from this slice alone.
- [ ] Inspect tasks23–25 and ask the owner the remaining report data/fields/privacy/filter/export decisions before report implementation.
