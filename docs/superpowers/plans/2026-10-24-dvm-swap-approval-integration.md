# SWAP Approval Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fuse the inspected reference approval experience with PR143 SWAP intake using authoritative SQL routing and existing decisions.

**Architecture:** Extend existing authenticated read endpoints and read-only SQL projections; a focused server view module sanitizes workflow, immutable proposal and history. Existing browser controller owns queue/detail and mutation guards. Existing SQL write procedures, grants, gates, DOE and HICC rules stay unchanged.

**Tech Stack:** Vanilla JS/CSS, Node22 tests, existing SQL/API, native dialog, generated static bundle.

**Spec:** docs/superpowers/specs/2026-10-24-dvm-swap-approval-integration.md

## Task 1 — Authoritative sanitized approval detail

Files: server/src/swap/swap-view.js (new presentation boundary), server/src/swap/swap-api.js (project read/mutation responses), server/test/swap-approval-view.test.js; database/azure-sql/059_swap_approval_read.sql and _acceptance.sql; rollback_059_swap_approval_read.sql; tools/test-swap-approval-sql.ps1.

- [ ] Write one failing public API detail test for current-revision serial route, original From/To and private-field omission; implement minimum projection and repeat for missing/terminal/revised/override cases.
- [ ] Add migration059 preserving both existing read-procedure signatures/access predicates and SQL write objects. Return only explicit public snapshot, names, flags and capabilities. Add guarded rollback to030 definitions and isolated acceptance of deny/self/reviewer scopes, revisions and no business/write/grant drift.
- [ ] Verify scoped repository/API tests and isolated SQL where available; record exact non-execution blockers, never connect acceptance to production.

## Task 2 — Unified queue and approval detail

Files: frontend/scripts/swap-workflow-sql.js, frontend/styles/swap-workflow-sql.css, frontend/pages/index.html; tests/swap-approval-ui.test.js and existing dialog tests.

- [ ] RED→GREEN queue filters/search/counts/reset/refresh through PAWS_SWAP.openQueue; server capabilities alone control needs-decision and own-request filters. Keep public method/API paths and deferred loading.
- [ ] RED→GREEN detail route, From/To, revision history and truthful fallback; stage-specific mutation labels, reason validation, double-click and identity/stale guards. Reuse PR143 creation/DOE panel and preserve protected revisions.
- [ ] Rename existing navigation label to SWAP & Approvals; no duplicate workflow or Firestore listeners. Test existing Schedule task integration and permission-disabled cases.

## Task 3 — Component/browser acceptance and review

- [ ] Build actual generated static output; extend private synthetic preview with real state transitions/decision endpoints. Save same-size before/after desktop plus narrow, long names/text, empty/search/loading/error and keyboard evidence. Never create real production requests.
- [ ] Fresh independent whole-branch Standards/Spec review; fix Important findings with RED→GREEN. Document remaining business gaps and any unverified native200%/real-role/SQL cases.

## Task 4 — Coherent immutable release candidate and ledger

- [ ] Commit accepted product, then separate reviewed freeze promotion protecting full static/API union. Preserve prior DVM/office receipts as historical exact anchors; add current integration governance assertions.
- [ ] Run npm test and matching server checks; run final sequential static/release build plus four source/artifact freezes. No parallel build races.
- [ ] Update PR143 or a coherent follow-on PR with exact product/head, original workbook and continuity; replace stale cloud CI prompt. Keep PR142 separate; if main moved integrate and review both changes deliberately. No manual Actions poll/dispatch or unproved merge/deploy claim.

## Execution ledger

- Start: fae18b4, referencecc7cd33, main87a7f943; inline recommended path selected under standing Owner authorization.
