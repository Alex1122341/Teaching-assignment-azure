# PAWS Office UI Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. Steps use checkboxes for tracking.

**Goal:** Make schedule filters and leadership lists faster to scan and operate without altering business rules.

**Architecture:** Reuse existing page markup, controllers, two-column directory renderer, theme tokens and authenticated API. Directory query/sort operates only on the already authorized response. A separate local read-only fixture harness exercises actual sources without production writes.

**Tech Stack:** Existing vanilla HTML/CSS/JavaScript, Node22 checks and browser bridge; no installations.

**Spec:** `docs/ui-design.md` and the Owner's comprehensive UI brief. This is the first coherent implementation phase; source inventory is full-site, rendered acceptance covers only explicitly exercised surfaces.

## Global constraints

- Last name, First name per PAWS_CONSTITUTION.md; canonical leadership API labels format once server-side.
- Preserve API/auth/DOE/date/status rules, original data and all gates.
- Fixed 1920×1080, 1440×900, 1366×768, 1024×768 desktop and narrow screenshots, same fixtures/filter/scroll.
- Prepare a focused PR; do not merge or deploy UI changes without separate explicit authorization.
- No new frontend copy, dependencies, production mock data, or security changes.

## Review focus

- Multiword and accented names: search tokens match either name order without changing displayed values.
- Long scope/name/status: wrap visibly without clipping or page-wide horizontal scrolling.
- Unknown dates: remain explicit and sort after recorded dates.
- Refresh/error/identity switch: no stale rows, filters stay coherent and retry works.
- Modal keyboard/zoom: all new controls reachable, focus trapped/restored and content scrolls.

## Task 1 — baseline and regression tests

- [x] Create local read-only preview from actual built page/modules/styles and synthetic fixtures. Preserve immutable main baseline; capture matched screenshots.
- [x] Add `tests/leadership-directory-search.test.js`: copied filtered/ordered array, all-word accent-insensitive search, default status population, unknown dates last, truthful empty output, no input mutation.
- [x] Run the new test under Node22 and observe missing-function and empty-state failures before implementation.

## Task 2 — compact filters and usable directory

- [x] `frontend/pages/index.html`: labelled search/sort/Clear, preserving status checkbox/Refresh and IDs; schedule search/month receive associated labels.
- [x] `frontend/scripts/leadership-directory.js`: copied query/sort view, count, clearable empty state, busy/Retry, select focus and reset; fresh authorized loading unchanged.
- [x] `frontend/styles/leadership-directory.css`: responsive stable shell, compact rows/shared controls/focus/long names/dark theme; two business columns preserved.
- [x] `frontend/styles/workspace.css`: shared tokens plus scoped filter grid/controls/responsive fallback.
- [x] New and existing directory assertions15/15; independent critique focus regression reproduced red, fixed green and retested in browser.

## Task 3 — browser iteration and delivery

- [ ] Build `.deploy-static` and run the actual local preview. Check keyword search/order/clear/status/refresh, focus/Escape, loading/error/retry, long names/roles/text, empty/large results, narrow view and 200% zoom. Capture after at the exact baseline conditions.
- [ ] Record the three problems fixed and one concrete detail pass. Run `npm test` as requested for this UI phase; record unavailable coverage honestly. Build/freeze promotion remains a separate reviewed commit if publishing.
- [ ] Update acceptance notes and continuity records; independent whole-branch review before any authorized merge/publication. Deliver local preview, paired screenshots, component/rule reuse and remaining issues.

## Execution ruling

The Owner already requested implementation, supplied the design/verification boundaries and previously chose inline execution using recommendations without routine questions. Continue directly through this plan; no new architecture, permission or destructive data decision is introduced.
