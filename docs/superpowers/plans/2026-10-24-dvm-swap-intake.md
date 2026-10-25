# DVM SWAP Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add clear DVM-request intake choices and explicit reviewed field selection to the existing SQL SWAP workflow, with a truthful capability comparison.

**Architecture:** Extend the existing browser controller and stylesheet. Use current context/capability/submit contracts; no backend, rules, role, data or gate changes. Keep remaining DVM business workflow packages explicit.

**Tech Stack:** Vanilla JavaScript/CSS, native dialog, Node22 tests, existing SQL API.

**Spec:** docs/superpowers/specs/2026-10-24-dvm-swap-intake-design.md

## Global constraints

- Server field capabilities remain authoritative; preserve privacy, Last name, First name, snapshots and revision checks.
- Existing request has one SessionId; notification remains in-app consent. No fake email, atomic batch or local-storage checklist.
- Preserve ADFA DOE preview and standard-form handoff. Keep runtime changes to swap-workflow-sql.js and swap-workflow-sql.css.
- No production requests, decisions, SQL/role changes or email acceptance probes.

## Review focus

- A mixed or protected revision must survive the new field controls without dropping unauthorized-to-edit changes.
- Unselected fields, including invalid disabled values, must not leak into payloads.
- Changing a selection, note, mode or candidate must invalidate confirmation; double-click must not create duplicate writes.
- Late results after user change, dialog close or mode change must not write or display private state.
- Missing real field authority must remain visibly unavailable, including ordinary Faculty topic/type mode.

### Task 1: Intent choices and instructions

**Files:** frontend/scripts/swap-workflow-sql.js, tests/adfa-swap-dialog.test.js.

**Interfaces:** existing PAWS_SWAP.openSession/openDetail and swapContext fields; existing user and generation guards.

- [ ] Add a failing public-dialog test: three choices render, choosing Topic shows only Topic, unauthorized Topic stays disabled, existing ADFA default still opens DOE panel.
- [ ] Run targeted test, implement minimal mode rendering and valid draft handoff, verify pass.
- [ ] Add mode-change tests for dirty draft preservation and fixed revision mode; run red/green.

### Task 2: Selected fields and confirmation

**Files:** same controller/test.

**Interfaces:** createSwap/reviseSwap payloads remain unchanged; no new authority or persistence fields.

- [ ] Test unchecked fields omitted, time pair selected together, note preserved, editable revision uncheck removes its proposal while protected fields persist.
- [ ] Implement explicit checkboxes and capture selected changes. Run red/green.
- [ ] Test first submit writes zero and shows escaped From/To; second submits exact reviewed payload. Edits require a new review; duplicate in-flight event writes once.
- [ ] Implement confirmation and invalidation; retain availability recheck, snapshot, revision and generation guards. Run existing SWAP tests.

### Task 3: Actual browser acceptance

**Files:** frontend/styles/swap-workflow-sql.css; private synthetic preview outside repository.

- [ ] Add scoped density, three-mode layout, field inclusion, review-table and narrow/focus styles using existing palette/tokens.
- [ ] Build generated static output and serve actual before/after controller+CSS with synthetic API responses, never duplicate production business data.
- [ ] Check desktop/narrow, topic/type/standard/DOE paths, keyboard/200% text, long text, denied/no-edit fields, confirmation, loading/error and user-switch invalidation. Save comparable screenshots.

### Task 4: Review, freeze and handoff

- [ ] Fresh independent whole-branch Standards/Spec review and fix findings.
- [ ] Commit accepted product, then separately promote immutable freeze without manifest reduction/API changes; independently review governance.
- [ ] Run npm test, focused SWAP tests, sequential release build and four source/artifact freezes. Historical receipts remain unchanged; current baseline assertions follow new accepted anchor.
- [ ] Update original ledger with implementation vs remaining backend gaps and continuity records. Create/attach coherent PR; provide pinned exact-head cloud CI prompt per Owner preference. No poll/manual Actions dispatch or premature release claim.
