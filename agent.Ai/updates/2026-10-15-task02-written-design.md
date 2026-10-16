# Agent Update — Task02 written design

**Date:** 2026-10-15

**Agent/model:** Codex

**Repository:** Alex1122341/Teaching-assignment-azure

**Task status:** PARTIAL — design prepared; owner review pending

## Goal and starting breakpoint

Continue automatically from accepted ADFA SWAP candidate PR99 into Task02 scheduling conflict detection in the existing Tasks sidebar. Existing isolated worktree, branch feat/scheduling-conflict-tasks-20261015, starting SHA b53c23e1621c6a98c2d9b4c62198fdefdebeaf0f. Prior evidence: 2026-10-15-adfa-swap-acceptance.md. PR98/99 remain dependencies; this turn did not reverify their remote state.

## Work performed

Read-only repository review plus a proposed written design in docs/superpowers/specs/2026-10-15-scheduling-conflict-tasks-design.md. Reviewed Task02 source requirements, Tasks/sidebar adapter, session read policy, canonical SQL assignments, role helpers, availability helper and legacy availability UI. No conflict-review store found in current SQL/API. No Task02 product code or implementation plan exists yet.

The important reuse limitation: CalendarActivityAvailability intentionally returns Unavailable for some unknown/invalid timing in SWAP. Task02 cannot directly treat that return as a confirmed scheduling conflict; typed issue evidence must distinguish Needs Review without changing existing SWAP semantics. Legacy availability-lookup.js Firestore/name matching is not the Beta source.

## Proposed design decisions

SQL derives current session-centered issues; only review metadata persists. Default queue retains reviewed unresolved issues. Changed source evidence resets review; source fixes remove active issues. Read scope matches session API, ordinary faculty see own issues only, ADFA-only review is proposed. No confidential AFC detail/DOE/canonical Faculty IDs in task DTOs. Calendar activity overlap/unknown time is included so migrated work does not disappear from conflict evidence. Preserve existing out-of-grid warnings and SWAP requests.

These are proposals pending written-design approval, not adopted runtime decisions. Do not update live gates or permissions based on this note.

## Files and checks

Added the written design and this update; current-state/task-chain headers updated. Documentation-only check is git diff --check. No new tests were run, and no new product acceptance claim is made. Prior ADFA evidence remains in its acceptance update.

## Live operations

None: no live reads/writes, SQL migration, credential or permission changes, merge, release, Firebase mutation or DOE change.

## Current breakpoint and next action

Task02 is architectural under superpowers:brainstorming. Present the concrete design for owner review, including whether ADC/LAB should share review authority (recommend ADFA only). Written-design approval permits writing the implementation plan; obtain plan/execution-method approval before implementation. The owner has allowed essential questions and explicitly prohibited grilling. Continue sequentially when approved.

## Do not redo

Do not redo ADFA/Calendar implementation or completed prior releases. Preserve external untracked server/test/fixtures/calendar-activity-race-wait-observe.sql and the existing Calendar .superpowers workspace. Do not use the default Teaching-assignment-main repository for this Beta task. Dedicated University least-privilege service account remains a separate release prerequisite.
