# Agent Update — PR130 product corrections and CCC freeze promotion

**Date:** 2026-10-21
**Repository:** Alex1122341/Teaching-assignment-azure
**PR:** 130 (still Draft) — branch `feature/ccc-schedule-readonly-20261021`
**Task status:** PARTIAL — product corrected and freeze promoted locally; CI, SQL acceptance, independent review and release remain blocked.

## Start and end state

- Verified remote head at start: `10edf4682ef6b95e6fe675419323bbcce3323762`, base main `a46c3bd9075af146177b7a0b614a4955e829c2fd`, mergeable, Draft, 8 commits, 22 files, +559/−4.
- Product commit produced this turn: `5b135dfc91332a6fad29376d1d88d9acd33fd62a` (pushed).
- Freeze governance commit anchored to that product commit (see below), static anchor `370c30a…` → `5b135df…`.

## Two product defects corrected

1. **Whole-year 503 from one long faculty name.** `sanitizeEntry` rejected `facultyName` longer than 256 characters, but the SQL contract that produces it allows 260: `CONCAT(PreferredFirstName,' ',PreferredLastName)` over two `nvarchar(128)` columns is up to 257, and the `DisplayName` fallback is `nvarchar(260)`. Any such row threw and the API answered 503 for the entire academic year. The ceiling now matches the contract (260) and remains a hard bound.
2. **Dead CCC button when `firebase.auth()` is not ready.** `ccc-schedule.js` registered `firebase.auth().onAuthStateChanged` during module evaluation. That call throws until another script has run `initializeApp()`, and the throw aborted the rest of the IIFE, so `window.PAWS_CCC_SCHEDULE` was never defined and the top-bar button did nothing. Setup is now guarded; sign-out still closes the viewer from `timetable.js` and profile changes still reload through the `paws-profile` listener.

`057_ccc_schedule_read.sql` now also requires `paws.Course`, which the reader joins for `courseCode`; without it the procedure created successfully and only failed at read time.

## Regression coverage added

- Server: 260-character name returns 200 with the name intact; 261 returns 503; every table the reader joins is asserted to be in the 057 prerequisite block.
- Browser: the viewer is now driven against a minimal DOM instead of only being pattern-matched — it must render a row with the Half day badge, clear on close, and show the error state (not an empty schedule) when the read fails.
- Both new suites were negative-controlled: reverting each fix makes the matching test fail.

## Freeze promotion

- `tools/beta-freeze.js` `BASELINE_COMMIT` → `5b135df…`; `tools/beta-baseline.json` regenerated for all 85 manifest files.
- Measured delta versus `370c30a…`: static 83 → 85, added exactly `ccc-schedule.css` and `ccc-schedule.js`, removed none, changed exactly `index.html`, `paws-data-client.js`, `timetable.js`. API 107 → 110, added exactly the three new CCC runtime files, removed none.
- `node tools/beta-freeze.js` → `{"ok":true,"protected":85}`; `node tools/beta-api-freeze.js` → `ok:true, runtimeFiles:110, drift:[]`. Built artifacts (`.deploy-static` 85 files, `.azure-production/api` 110 files) reproduce the same source drift set and add no artifact-only drift.

## What is still blocked

- **GitHub Actions never starts jobs.** Every run since 2026-10-21T02:45Z fails in about 3 seconds with zero steps; the annotation is "The job was not started because recent account payments have failed or your spending limit needs to be increased". Last successful run: `Azure Beta Build` #39533553204 at 2026-10-21T02:32Z. There is no exact-head or exact-main CI available.
- **No disposable SQL Server.** No Docker, no local SQL instance; `sqlcmd` exists but there is no isolated target. SQL 057 execution, permission and rollback acceptance cannot be performed here.
- **No independent reviewer** for the product commit or the governance commit.
- **No production SQL credential** for `ITAPPVETOPSDB01 / VetMed-Ops`, and the University API cutover is owner-side.

## DO NOT REDO

Do not replay 001–056, do not re-import or replace the 413 CCC slots, do not alter the 27 write gates, do not merge while the PR is Draft, do not deploy without exact-head CI or the expressly authorized equivalent.
