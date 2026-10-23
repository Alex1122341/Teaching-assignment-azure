# PAWS Calendar workspace implementation plan

> **For agentic workers:** Use superpowers:executing-plans for the owner-selected sequential implementation. This plan follows the latest explicit instruction to implement safe P0 work now; do not pause for another routine plan approval. Use a fresh independent code reviewer at the end.

**Goal:** Evolve the existing Schedule toward the supplied Demo with dated weeks, removable filters and an authorized adaptive navigation shell.

**Architecture:** Retain timetable closure state and existing handlers; a small view module renders descriptors from that state. A separate navigation presentation module moves the existing authorized nodes and never fetches business data or grants access. Keep existing routes, authenticators, lazy modules and export predicates.

**Tech stack:** Vanilla JS/CSS/HTML, node:test, existing static builder and immutable freezes. No new dependency.

**Spec:** `docs/ui/paws-demo-alignment.md`, latest user Demo-guided directive, and Phase2 navigation/filter brief.

## Constraints and review focus

- Calendar remains normal home for all supported roles; explicit URLs remain intentional. No Overview redirect or last-page persistence.
- Protect Last name, First name, existing UCalgary tokens, API/SQL scopes, rowversions, DOE, audits, PDF and write gates.
- Preserve ALL versus NONE for courses/types, dynamically discovered teaching types, My Timetable and export AND/OR logic.
- Removing month must refresh the session scope; clearing all content must cause one coherent scope refresh, not redundant requests from picker callbacks.
- Chip removal must retain keyboard focus on the next item or Search; long/untrusted labels use textContent and full accessible text.
- Weeks calculate dates through existing weekStart across Spring/Fall/Winter, keep selected week visible and synchronize Today/Previous/Next.
- Navigation must retain one ID/handler per existing control, self-mode protection, Task mount and modal stacking. No stub production links.
- Test390/768/1024/1280/1366/1440/1920 and narrow/zoom behavior, with actual synthetic before/after screenshots.

### Task1: Calendar filter interaction

Files: create `frontend/scripts/schedule-filter-view.js` and `tests/schedule-filter-view.test.js`; modify `frontend/scripts/timetable.js`, `frontend/pages/index.html`, `frontend/styles/workspace.css`, `tools/static-assets.json`.

- [ ] Add failing tests for weekLabel(week,start,end), contentChips({search,month,courses,typeKeys,types}), preserving separate course chips, explicit no-selection restore, untrusted/long labels and focus after removal. Use actual picker for type semantics.
- [ ] Run the new suite and observe missing implementation failures.
- [ ] Implement pure descriptors plus a DOM renderer with onRemove(kind,value)/onClear callbacks. Do not persist or own filter state.
- [ ] Wire actual timetable state; batch callback suppression during all-content clear; month removal/clear refreshes the current scope once. Keep Reset's current full reset behavior and label its distinction.
- [ ] Relabel original week buttons using weekStart/addDays; update aria-pressed, horizontal scroll and Arrow/Home/End keyboard behavior without duplicate handlers. Keep mobile select synchronized.
- [ ] Run new plus responsive/type/views/export suites; browser check courses/type/month/search, NONE, Reset and period changes; commit coherent Calendar product slice.

### Task2: Schedule navigation shell

Files: create `frontend/scripts/workspace-navigation.js` and focused tests; modify index, timetable integration, workspace CSS and allowlist only. Later cross-page adapters are separate scope.

- [ ] Write failing tests for layout224/64/drawer and available-width Tasks overlay, idempotent mount, existing-node identity/handler retention, visibility sync and no generated unauthorized links.
- [ ] Implement presentation-only module. Move actual existing destinations, account/status/theme and preserve .timetable-top-actions for the actual Tasks controller. Do not introduce Dashboard tab shortcuts until current guards are explicitly adapted.
- [ ] Integrate after existing controls initialize, sync after updateAuthUI and close on lock/sign-out. Header measurement must accommodate wrap; dialogs stack above navigation. Drawer traps focus, closes on Escape and restores trigger focus.
- [ ] Keep My Teaching/My Timetable, session create/select/edit, view buttons, Changes and exports local. Retain all five existing HTML routes and normal Calendar landing behavior.
- [ ] Verify existing role/landing/auth tests and real handler behavior. No navigation badges, global data fetch or new permission policy. Commit separately.

### Task3: Acceptance and governance

- [ ] Diagnose unchanged baseline's resource-sensitive test failures without editing historical receipts; rerun targeted and full suite with suitable concurrency.
- [ ] Build generated assets. Capture matched same-size/data/filters/scroll screenshots at required widths; inspect light/dark, long labels, loading/error/empty and keyboard. Record actual measured overflow/Calendar width and remaining real-role acceptance gaps.
- [ ] Request independent product/spec/privacy review and fix important findings with regression tests.
- [ ] Commit product first. Promote freeze separately to that exact product commit with full manifest union, independent governance review; run source/artifact freezes and combined build. No new API/SQL/role infrastructure.
- [ ] Update alignment assessment and agent.Ai breakpoint. Open a focused stacked PR against Phase1 while136 is unmerged, attach it and report its exact state. No merge/deploy; obtain explicit later authorization.

## Self-review

Reference matches existing functional components rather than mock business behavior. The first product slice is independently usable; shell and later Dashboard/table phases stay separable. No new Faculty selector, report builder, Overview, permission expansion or SQL change is implied. Production completeness requires real role/API acceptance in addition to synthetic screenshots.
