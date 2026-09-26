# Agent Update — BETA-R3A-2 PR #6 main integration

**Date:** 2026-09-26
**Agent/model:** HY3 / WorkBuddy (strict release-engineering execution)
**Repository:** Alex1122341/Teaching-assignment-azure
**Task status:** COMPLETE — **SUPERSEDED / CORRECTED by `2026-09-26-beta-r3a2b-runtime-commit-a.md`**

> ## ⚠ CORRECTION NOTICE (2026-09-26, BETA-R3A-2B)
>
> Three statements in this document were rejected by architect review and are corrected here.
> Read `agent.Ai/updates/2026-09-26-beta-r3a2b-runtime-commit-a.md` for the authoritative record.
>
> 1. **CI evidence was NOT post-retarget.** Runs `36249819711` / `36249819750` were created
>    before the PR #6 base change and are **pre-retarget historical evidence**. The Azure Beta
>    Build checkout log for that run showed `HEAD is now at: d6d2339 Merge 075852b... into
>    edb46dc...`, i.e. PR #6 HEAD merged with the **old PR #3 HEAD**, not with current `main`.
>    Do not reuse them as post-retarget evidence.
> 2. **`tools/verify-beta-candidate.js` IS wired into CI.** Section 7's NOTE claiming it is
>    "not wired as a dedicated CI step" is **false**. `azure-beta-build.yml` runs it in the
>    step `Verify explicit Beta-R1 release-candidate drift` (`if: github.event_name != 'push'`).
> 3. **Strict beta-freeze + artifact freeze did NOT run on the PR candidate.** The step
>    `Verify strict frozen main runtime` is gated `if: github.event_name == 'push'` and is
>    therefore **SKIPPED** on `pull_request`. Only the explicit Beta-R1 release-candidate drift
>    check runs on a PR.
>
> **Also corrected:** the "next safe action" below (merge PR #6, then promote the freeze) is
> **NOT approved**. PR #6 remains unmerged. Runtime Commit A
> (`6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26`) has since been created with fresh CI
> (`36265424485` / `36265424535`).

## 1. Goal

Prepare PR #6 so it is cleanly based against the newly merged `main`, contains ONLY the reviewed BETA-R1 work, and has fresh exact-head CI evidence. No merge, no deploy, no freeze promotion, no Runtime Commit A/B, no Azure/SQL/Firebase/DOE changes.

## 2. Starting breakpoint

- base branch (before): `feature/azure-sql-cutover-foundation` (tip `edb46dc734613ea35bb211d1c98dd21bce851e33` = PR #3 HEAD)
- base SHA (after): `main` = `ea80eecc9fa2ac2b693c23979bad5c5809a26863` (PR #3 merged)
- working branch: `task/beta-r1-connect-azure-sql`
- starting + final HEAD SHA: `075852b150e8870b4e49e1076586cbbc82bc1bcb`
- PR: #6 (Draft, open)
- relevant prior updates: `2026-09-26-pr3-merged-to-main.md` (PR #10, unmerged draft), `2026-09-26-beta-r2b-r3-activation-blocked.md` (PR #9, unmerged draft)
- live environment assumptions: NONE changed; this was a read-only preflight + base retarget only.

## 3. Work performed

- Read-only preflight (Phase A): verified `main` SHA, PR #6 HEAD/state/base, PR #3 HEAD ancestor of `main`. All matched authoritative state.
- Verified git graph (Phase 4): `edb46dc` is ancestor of both `main` and PR #6 HEAD; exactly **4** BETA-R1 commits between `edb46dc` and `075852b`.
- Retarget-only dry-run (Phase 6): `merge-base(main, PR6)` = `edb46dc`; PR #6 vs `main` = the 4 BETA-R1 commits; `git merge-tree` returned a clean tree (no conflicts).
- Phase 8 gate: retarget-only accepted — PR #3 foundation already in `main`; PR #6 unique scope exactly BETA-R1; no conflict; no duplicate migration foundation.
- Phase B1: changed PR #6 base `feature/azure-sql-cutover-foundation` → `main` via GitHub API. **HEAD unchanged** (`075852b`).
- Phase 15: post-retarget PR changed-file count = **42**; no `agent.Ai`/`AGENTS.md` contamination; no DOE; no PR #3 migration foundation (`001/002/003`); only `004_swa_beta_permissions.sql`.
- Phase 16: CI green for exact head `075852b` (Azure SQL Migration Tests run `36249819711`; Azure Beta Build run `36249819750`; event `pull_request`; conclusion `success`). — **CORRECTED:** these are **pre-retarget historical** runs, not post-retarget evidence (see correction notice above).
- Phase 19: this continuity update + refreshed `PROJECT_STATE.md` / `TASK_CHAIN.md` on a separate docs branch (NOT in PR #6, to keep PR #6 HEAD unchanged). PR #9/#10 latest facts preserved.

## 4. Files / components changed

- PR #6 (GitHub base only): base branch changed to `main`. HEAD and commit history unchanged.
- Docs branch `docs/beta-r3a2-pr6-main-integration`:
  - `agent.Ai/updates/2026-09-26-beta-r3a2-pr6-main-integration.md` (new)
  - `agent.Ai/PROJECT_STATE.md` (main SHA → `ea80eecc`; PR #3 → merged; PR #6 base → `main`; refreshed CI evidence)
  - `agent.Ai/TASK_CHAIN.md` (BETA-R0 PR #3 → merged; BETA-R1 PR #6 → retargeted to `main`, ready for architect merge decision; BETA-R2 facts from PR #9 preserved)
- No application/runtime/source files changed.

## 5. Architecture / invariants affected

- Preserved existing architecture. No invariant changed. No new decision introduced. Frozen baseline `86bd5aa` unchanged (CI freeze checks passed against it; not promoted).

## 6. Data / algorithm changes

- None. No identity matching, normalization, session grouping, authorization, workflow state machine, concurrency/versioning, DOE, AFC, publication, or migration logic changed.

## 7. Tests / CI evidence

- **Azure SQL Migration Tests** — run `36249819711` — event `pull_request` — head `075852b150e8870b4e49e1076586cbbc82bc1bcb` — conclusion `success`. **PRE-RETARGET HISTORICAL — superseded.**
  - steps: python `unittest discover tests/python test_azure_sql_*.py` (success); pip install `requirements-azure-sql-migration` (success).
- **Azure Beta Build** — run `36249819750` — event `pull_request` — head `075852b150e8870b4e49e1076586cbbc82bc1bcb` — conclusion `success`. **PRE-RETARGET HISTORICAL — superseded.**
  - steps: `npm test` (success); server SQL runtime authorization tests (success); `npm run test:emulator` ⇒ `firebase emulators:exec --only firestore,auth` (success); `node tools/build-static.js`; `node tools/beta-freeze.js` (+ `--artifact .deploy-static`) (success); `beta-baseline.test.js` + `azure-deployment.test.js` (success); `upload-artifact` (success).
- **CORRECTED — CI step wiring.** `tools/verify-beta-candidate.js` **IS** wired into
  `azure-beta-build.yml` as the step `Verify explicit Beta-R1 release-candidate drift`
  (`run: node tools/verify-beta-candidate.js`, gated `if: github.event_name != 'push'`).
  The previous claim that it is "not wired as a dedicated CI step" was false.
- **CORRECTED — strict main freeze on a PR candidate.** `Verify strict frozen main runtime`
  is gated `if: github.event_name == 'push'`, so on a `pull_request` run it is **SKIPPED**.
  It did not pass on the PR candidate — it did not run. Only the explicit Beta-R1
  release-candidate drift check runs on a PR, and that is the correct candidate behavior.
- **Fresh post-Commit-A CI** (authoritative, replaces the two runs above): Azure SQL Migration
  Tests `36265424485` and Azure Beta Build `36265424535`, both `pull_request`, head
  `6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26`, both `success`.
- Frozen baseline unchanged; not promoted.

## 8. Live operations

### Performed

- NONE.

### Explicitly NOT performed

- no SQL writes / DDL / DML
- no Firebase mutation
- no deployment / Azure config / Entra changes
- no merge (PR #6, #9, or #10)
- no reset / loader / migration apply
- no DOE changes
- no freeze promotion; baseline `86bd5aa` unchanged
- no Runtime Commit A/B

## 9. Current state after task

- final branch: `task/beta-r1-connect-azure-sql` (unchanged at the time of this task)
- final SHA: `075852b150e8870b4e49e1076586cbbc82bc1bcb` (unchanged at the time of this task)
- PR #6: base = `main`, Draft, open, `mergeable = true`, head = `075852b`
- **SUPERSEDED 2026-09-26 (BETA-R3A-2B):** Runtime Commit A
  `6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26` merged current `main` INTO the PR branch;
  PR #6 head is now `6eeb1a4`, still Draft, base `main`, 42 changed files.
- merge/deploy state: NOT merged, NOT deployed
- live counts: unchanged (`paws.UserProfile` 0 rows; no live mutation)

## 10. Blockers / unresolved questions

- BETA-R3 live activation remains **BLOCKED** (carried from PR #9, preserved here):
  1. `azure-beta-deploy.yml` requires candidate SHA == `origin/main` via a `push` to `main`, so deploy needs a reviewed PR #6 merge + promotion — out of scope for this task.
  2. Entra service principal / `paws_swa_beta` app registration creation returns `403 Authorization_RequestDenied` (account lacks directory role) — needs administrator action.
- PR #6 itself is integration-ready; these blockers are downstream of merge, not within this task.

## 11. Exact current breakpoint

**CORRECTED.** PR #6 is now cleanly based on `main` (`ea80eecc`) and contains only the 4
reviewed BETA-R1 commits, but the CI cited below this section was pre-retarget historical
evidence. Runtime Commit A (`6eeb1a4`) has since been created and produced genuinely fresh CI
(`36265424485` / `36265424535`).

The previously stated next action — architect-reviewed merge of PR #6 to `main` followed by
freeze promotion — is **NOT approved** and is **RETRACTED**. Merging PR #6 now would place
BETA-R1 runtime on `main` while the strict frozen baseline still points to
`86bd5aa2c8a25259f3f708e49b322220ff43a147`, intentionally producing a failing intermediate
`main` build. Commit A + Commit B exist precisely to avoid that.

## 12. Next safe action

**Do NOT merge PR #6.** Architect reviews Runtime Commit A (`6eeb1a4`) with its fresh CI
(`36265424485` / `36265424535`). Commit B (freeze promotion to the new runtime baseline) is a
separate, separately reviewed task and must run only after that review plus explicit owner
approval. Do not merge #9/#10/#11; their latest facts are preserved in
`PROJECT_STATE.md` / `TASK_CHAIN.md` and this update.

## 13. DO NOT REDO

- **Do NOT merge PR #6** (or #9/#10/#11), deploy, or promote the freeze without explicit
  architect + owner approval.
- Do NOT reuse runs `36249819711` / `36249819750` as post-retarget CI evidence.
- Do NOT claim the strict main beta-freeze passed on a PR candidate (it is SKIPPED on
  `pull_request`), and do NOT claim `verify-beta-candidate.js` is unwired.
- Do NOT rebase/rewrite PR #6 history — retarget-only was sufficient; BETA-R1 SHAs preserved.
- Do NOT promote frozen baseline (`86bd5aa`) or modify `tools/beta-freeze.js` / `tools/beta-baseline.json` / `azure-beta-deploy.yml` baseline SHA.
- Do NOT run any live mutation (SQL/DOE/Firebase/Azure/Entra).

## 14. Suggested next-agent prompt

~~"Review PR #6 (base now `main`, 4 BETA-R1 commits, head `075852b`, CI green). Decide on merge to `main` (Runtime Commit A)..."~~ — **RETRACTED.**

"Review Runtime Commit A (`6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26`) on PR #6 (base `main`, 4 BETA-R1 commits preserved, 42 changed files) with fresh CI: Azure SQL Migration Tests `36265424485` SUCCESS, Azure Beta Build `36265424535` SUCCESS. Confirm the PR candidate step behavior (strict frozen main runtime SKIPPED; explicit Beta-R1 release-candidate drift SUCCESS via `node tools/verify-beta-candidate.js`). Do NOT merge PR #6. Commit B (freeze promotion) is the next separate task, only after this review plus explicit owner approval."
