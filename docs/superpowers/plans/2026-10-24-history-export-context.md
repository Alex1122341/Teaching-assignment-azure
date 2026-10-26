# History Export Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep an authorized History page usable after bounded/busy export rejection.

**Architecture:** A narrow recoverable-error branch in the shared vanilla JS controller; preserve existing API limits, permission checks and snapshot generation guards.

**Tech Stack:** Vanilla JavaScript; Node 22 node:test; existing browser and immutable release tooling.

**Spec:** `docs/superpowers/specs/2026-10-24-history-export-context-design.md`.

## Global constraints

- No SQL, rule, gate, API, dependency or business-data changes.
- Keep existing person-name formatter and History rendering.
- Preserve current fail-closed behavior outside the two explicit recoverable error codes.
- Separate product and reviewed immutable-freeze promotion before integration.

## Review focus

- Export failure after a nonzero page must preserve its actual offset and rows.
- Authentication, scope or snapshot loss must invalidate the view.
- A late rejection after filter change/signout must not restore stale state.
- Successful smaller exports retain all filtered records, not only visible rows.
- Workbook statuses separate live acceptance, candidate fixes and human signoff.

### Task 1: Controller correction

**Files:** `tests/change-history.test.js`; `frontend/scripts/change-history.js`.

- [x] Add one failing public-controller regression for recoverable export rejection on page two; run it and observe the exact loss of rows/count/offset.
- [x] Implement only the two-code export recovery branch; rerun the regression and adjacent History tests.
- [x] Add security/stale-response negative coverage and verify it remains fail closed.
- [x] Verify the actual component through a local synthetic error fixture, retaining before/after context evidence.

### Task 2: Ledger and release readiness

- [ ] Finish current real read-only History paging/year/filter/download checks; record any bounded-export limitation without claiming full pass.
- [ ] Update original workbook using targeted cells, preserving formulas, validation, tables, styles and human signoff.
- [ ] Run scope-matched/full required checks, independently review product and freeze governance, then use the authorized PR / exact-main release chain if all gates pass. Retain a precise continuation record for any infrastructure blocker.
