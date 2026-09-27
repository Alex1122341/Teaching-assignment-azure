# Agent Update — BETA-R4D-9G Runtime Commit G + Governance Commit H

**Date:** 2026-09-27
**Repository:** `Alex1122341/Teaching-assignment-azure`
**Task status:** IMPLEMENTED — full test suite run; freeze green

## Scope

Fix a frontend visibility defect in which sessions could disappear from Day and
Week view with no user-visible trace. Promote the reviewed Runtime Commit G as
the new immutable frozen Beta baseline.

No session time was corrected. No AM/PM was inferred. No SQL, importer, workbook,
ACA, Firebase, CORS, or network configuration was touched.

## The defect

R4D-9F-B proved that two independent predicates decided what a user saw, and they
were mutually exclusive but **not jointly exhaustive**:

- `unpositionedSessionsHtml()` admitted a session only when
  `scheduling.validateInterval(...).status !== 'valid'`.
- `layoutDaySessions()` kept `status === 'valid'`, after which the renderer
  clamped the interval to the 07:30–17:00 grid and **silently `return`ed** when
  the clamped result fell outside it — with no `else` branch.

`validateInterval()` answers *"is this a well-formed interval?"* and deliberately
knows nothing about the visible grid (`scheduling-core.js:37-43`). `01:30 → 02:30`
is a syntactically valid interval, so it failed the check-needed filter **and** was
dropped by the grid guard. It rendered nowhere.

Impact: **755 of 1937 sessions (39%) were invisible.** The `reversed` (65) and
`00:00` sentinel (35) classes were already surfaced correctly.

## The fix

One canonical display decision, `calendarTimingDisposition(session)`, shared by
both sides. It separates interval well-formedness from calendar positionability:

| disposition | meaning |
|---|---|
| `invalid` | not a well-formed interval, unknown time, or unparseable |
| `grid` | valid **and** overlaps the visible window |
| `before` | valid but entirely before `CALENDAR_DAY_START` |
| `after` | valid but entirely after `CALENDAR_DAY_END` |

The grid keeps only `grid`; the check-needed list takes the exact complement. The
two now **partition** the set, so no session can satisfy neither.

- Day/Week window is now a single shared constant (`CALENDAR_DAY_START=450`,
  `CALENDAR_DAY_END=1020`) instead of raw `450`/`1020` repeated across predicates.
- The clamp is preserved: partially overlapping sessions (`07:00 → 08:00`,
  `16:30 → 17:30`) still render, clipped to the grid.
- The guard changed from a window test to `endM <= startM`, so it can no longer
  discard an entire session.
- `scheduling-core.js` interval semantics were **not** modified — `01:30 → 02:30`
  remains a valid interval; it is merely unpositionable in this calendar window.

## UX

Heading is now truthful: **"Sessions not shown in calendar grid - Check needed"**
(previously "Time not confirmed - Check needed", which was too narrow once
valid-but-outside-window sessions are included, and implied the time was wrong).

Each row shows date · course · type · topic, the **stored** start/end time, and a
reason: `Time unknown` / `Invalid time interval` / `Outside calendar hours`. No
corrected or fabricated time is displayed. `data-session-id` is preserved, so
existing session-detail click behaviour is unchanged.

`.untimed-sessions` previously had **no CSS at all**; minimal styling was added in
`timetable.css` using existing PAWS variables, with a scrollable list capped at
240px (300px on narrow viewports) so many rows remain usable on desktop and mobile
without hiding any row.

## Approved baseline

- Runtime Commit G: `f74443d945a9f6c917e7e634eb2e7825f02c7ab0`
- Parent: Runtime Commit E `45e0e93daa2cba7c172f1c89e3c05406ce093364` (exactly)
- Protected paths: **45**, with zero drift required after promotion
- Protected files intentionally changed in Runtime G: **`timetable.js`, `timetable.css`** (only)

`timetable.js` canonical SHA-256:
`7c58ac6c6cbe1f339d7fa64894feaef86c95814e5e87f4f5fb5fe9b69a5b77a9`

`timetable.css` canonical SHA-256:
`edb890254b208559906da74479fd42b5a23f54e035bf21c6bbfd39e019f3250d`

The other four protected hashes (`index.html`, `faculty-admin.html`,
`faculty-admin.js`, `paws-data-client.js`) are byte-identical to Runtime E.

## Governance changes

- `tools/beta-freeze.js` and `tools/beta-baseline.json` now point to Runtime G.
- `tools/beta-baseline.json` hash map promoted for the two changed files only.
- `.github/workflows/azure-beta-deploy.yml` `--baseline` references updated (2 sites).
- `tests/beta-baseline.test.js` and `tests/azure-deployment.test.js` assert Runtime G.
- Active docs updated: `AGENTS.md`, `SETUP.md`, `docs/beta-r1-azure-sql-runtime.md`,
  `agent.Ai/{PROJECT_STATE,TASK_CHAIN,DECISIONS,TEST_RELEASE}.md`.
- `45e0e93` survives **only** in `agent.Ai/updates/2026-09-27-beta-r4d9f-governance-commit-f.md`
  as historical evidence. Never global-replace it.
- No drift whitelist was added; the freeze was not weakened; no protected file was
  removed; verification was not disabled.

## Verification

| Check | Result |
|---|---|
| `node --test tests/timetable-unpositioned-visibility.test.js` | 24/24 pass |
| `npm test` (root) | 334 pass / 2 fail / 29 skipped (365) |
| `npm test --prefix server` | 21/21 pass |
| `npm run test:emulator` | 363 pass / 2 fail (365), 0 skipped |
| `node tools/build-beta-release.js` | ok |
| `node tools/verify-beta-candidate.js` | `ok:true`, `protected:45`, `drift:[]` |
| `node tools/beta-freeze.js --artifact .azure-production/app` | `ok:true`, `protected:45` |

The two remaining root failures are pre-existing and unrelated:

1. `tests/hosting-boundary.test.js` — `spawnSync pwsh.exe ENOENT`. PowerShell 7 is
   absent on this Windows host; `ubuntu-latest` CI ships `pwsh`. Passes on CI.
2. `the promoted frozen runtime reports zero protected drift` — **fixed by Commit H**
   (it failed during Runtime G by design, because drift is not yet promoted).

Note: the two `faculty-swap-*` CRLF failures documented in earlier sessions did
**not** appear here, because this clone used `-c core.autocrlf=false`; the working
tree is LF and the LF-literal assertions match.

## Not done in this task

- No SQL write, no schema change, no `vCalendarSession` change.
- No importer change, no workbook change.
- No time correction of any kind; no `if (hour < 7) hour += 12` heuristic.
- No Firestore timetable fallback introduced.
- `sessionWritesEnabled()` remains `false`.
- The upstream source-time question (`01:30` vs `13:30`) remains a **separate
  data-quality track** and is out of scope here.
