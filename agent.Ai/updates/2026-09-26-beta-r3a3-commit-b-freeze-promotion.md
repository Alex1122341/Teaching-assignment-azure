# Agent Update — BETA-R3A-3 Commit B: promote the frozen Beta runtime baseline

**Date:** 2026-09-26
**Agent/model:** HY3 / WorkBuddy (strict release engineering)
**Repository:** Alex1122341/Teaching-assignment-azure
**Branch:** `task/beta-r1-connect-azure-sql` (PR #6)
**Task status:** COMPLETE — governance-only Commit B created; **PR #6 NOT merged; nothing deployed**

## 1. Goal

Promote the frozen Beta runtime trust anchor from the pre-BETA-R1 commit to Runtime Commit A,
so that repository runtime, PR artifact runtime, future `main` runtime and future deploy
artifact runtime are all the same immutable commit. Governance only: no application/runtime
asset was modified.

## 2. Authoritative preflight (all matched)

- `main` = `ea80eecc9fa2ac2b693c23979bad5c5809a26863`
- PR #6 base = `main`; HEAD = `6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26`; state `open`;
  draft `true`; `mergeable = true`
- Runtime Commit A parents: `075852b150e8870b4e49e1076586cbbc82bc1bcb` and
  `ea80eecc9fa2ac2b693c23979bad5c5809a26863`
- Runtime Commit A tree: `543b00af7f5a41d46a7beff04a03f84ab9246c91`
- Approving CI: Azure SQL Migration Tests `36265424485` SUCCESS;
  Azure Beta Build `36265424535` SUCCESS

## 3. Baseline promotion

| | SHA |
|---|---|
| previous frozen baseline | `86bd5aa2c8a25259f3f708e49b322220ff43a147` |
| **new frozen baseline** | **`6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26`** |

Runtime Commit A = `6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26` (merge of current `main` into
the BETA-R1 branch; parents `075852b` + `ea80eecc`, tree `543b00af…`).

**Commit B SHA:** this commit — the single governance-only commit whose parent is
`6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26`. A commit cannot contain its own SHA; the exact
value is recorded in the BETA-R3A-3 Commit B report and is visible as the tip of
`task/beta-r1-connect-azure-sql` in `git log`.

## 4. Classification of every `86bd5aa…` occurrence

**A — changed to Commit A**

- `tools/beta-freeze.js` (`BASELINE_COMMIT`)
- `tools/beta-baseline.json` (`sourceCommit`, plus recomputed SHA-256 values)
- `.github/workflows/azure-beta-deploy.yml` (both `--baseline …` invocations)
- `tests/beta-baseline.test.js` (`BASELINE_COMMIT`)
- `tests/azure-deployment.test.js` (deploy revalidation assertion)
- `AGENTS.md`, `SETUP.md` (frozen runtime contract)
- `agent.Ai/PROJECT_STATE.md`, `agent.Ai/TEST_RELEASE.md`

**B — intentionally retained as historical documentation/test evidence**

- `docs/superpowers/plans/*` and `docs/superpowers/specs/*` (18 documents) — each explicitly
  states it "predates the Azure beta repository split (… frozen at `86bd5aa…`)" and is
  "retained for history only".
- `86bd5aa` is additionally kept **only** as historical evidence inside the new monotonicity
  test, which proves the 44 previous protected paths are all present in the 45-path Commit A
  manifest. No production code reads it as a trust anchor.

**C — unexpected** — none.

## 5. Governance-only boundary

Changed by Commit B:

- `tools/beta-freeze.js` — baseline constant only; security architecture unchanged
- `tools/beta-baseline.json` — `sourceCommit` + recomputed SHA-256 (non-authoritative)
- `tools/verify-beta-candidate.js` — drift whitelist REMOVED; strict zero-drift wrapper
- `.github/workflows/azure-beta-build.yml` — both events now enforce zero drift
- `.github/workflows/azure-beta-deploy.yml` — frozen-runtime reference only; all exact-main
  gates preserved
- `tests/beta-baseline.test.js`, `tests/azure-deployment.test.js`
- `AGENTS.md`, `SETUP.md`, `docs/beta-r1-azure-sql-runtime.md`
- `agent.Ai/PROJECT_STATE.md`, `agent.Ai/TASK_CHAIN.md`, `agent.Ai/DECISIONS.md`,
  `agent.Ai/TEST_RELEASE.md`, `agent.Ai/MODULE_MAP.md`
- this update file

**Protected runtime files changed: 0.** All 45 protected blobs listed by
`tools/static-assets.json` are byte-identical to Runtime Commit A. `index.html`,
`timetable.js` and `paws-data-client.js` were not modified; neither was `server/src`,
`swa-api`, any SQL schema/data, any DOE file, or any Firebase business logic.

## 6. Security invariants preserved (beta-freeze.js)

- Git commit objects remain the immutable trust anchor.
- Runtime is compared against `6eeb1a4…:<path>` blobs via `git cat-file`.
- `tools/beta-baseline.json` is NOT trusted for verification; it is documentation only.
- Removing a path from the mutable manifest cannot remove protection (current manifest UNION
  baseline manifest).
- The baseline commit must exist, otherwise verification throws.
- Artifact verification uses the same immutable baseline; the CLI refuses any `--baseline`
  value that differs from `BASELINE_COMMIT`.
- No failure behavior was weakened.

## 7. New behavior

- **`tools/verify-beta-candidate.js`** — no whitelist, no Beta-R1 exception. Any protected
  runtime drift fails the run. Expected: `verifyFreeze().ok === true`, `drift.length === 0`,
  `protected === 45`.
- **Azure Beta Build** — after `node tools/build-beta-release.js`, both `pull_request` and
  `push` to `main` run, with no event gate:
  1. `node tools/verify-beta-candidate.js` (repository runtime vs Commit A)
  2. `node tools/beta-freeze.js --artifact .azure-production/app` (built artifact vs Commit A)

  There is no remaining event path where protected runtime drift is accepted.
- **Azure Beta Deploy** — unchanged gates (requested SHA == checked-out SHA == current
  `origin/main`; source run repo/workflow/`head_sha`/`head_branch == main`/`event == push`/
  `completed`/`success`), now verifying both the repository and the downloaded
  `.azure-production/app` artifact against `6eeb1a4…` before Azure upload.

## 8. Historical monotonicity proof (44 → 45)

- previous baseline manifest (`86bd5aa…:tools/static-assets.json`) = **44** paths
- Commit A manifest (`6eeb1a4…:tools/static-assets.json`) = **45** paths
- missing old paths = **0**; the only added path is `paws-data-client.js`

Because the new baseline manifest already contains every old path, the production
`protectedPaths` implementation stays "current manifest UNION baseline manifest". No growing
runtime chain of historical baselines was added. An explicit test proves every old 44 path
exists in the new Commit A baseline manifest.

## 9. Tests

`tests/beta-baseline.test.js` and `tests/azure-deployment.test.js`:

- **A** baseline identity — `freeze.BASELINE_COMMIT` == `6eeb1a4…`,
  `beta-baseline.sourceCommit` == `6eeb1a4…`, Commit A exists, Commit A is ancestor of HEAD
- **B** zero drift — `verifyFreeze()` → `ok === true`, `drift === []`, `protected === 45`
- **C** new asset protection — `paws-data-client.js` is protected and verifies clean
- **D** historical monotonicity — 44 → 45, missing old paths 0
- **E** mutable-manifest attack — removing a shipped path from the working manifest does not
  remove it from protection (baseline A still contains it)
- **F** mutable-hash attack — runtime edit + matching `beta-baseline.json` edit still FAILS
- **G** candidate CI contract — build workflow enforces zero drift, no `github.event_name` gate
- **H** main CI contract — same steps apply to `push` to `main`
- **I** deploy contract — exact current main + successful push build; repository and downloaded
  artifact independently verified against Commit A

## 10. CI evidence

- Approving Commit A CI: Azure SQL Migration Tests `36265424485` SUCCESS;
  Azure Beta Build `36265424535` SUCCESS.
- Fresh Commit B CI recorded in the BETA-R3A-3 report (new run IDs only; Commit A runs were
  not reused).

## 11. Corrected facts carried in from PR #11 (authoritative; PR #11 is NOT merged)

- Runs `36249819711` / `36249819750` were **pre-retarget historical** evidence, not
  post-retarget CI. Their Azure Beta Build checkout log showed
  `Merge 075852b… into edb46dc…` — PR #6 HEAD combined with the old PR #3 HEAD.
- `tools/verify-beta-candidate.js` **is** wired into `azure-beta-build.yml`.
- `Verify strict frozen main runtime` is push-only and is **SKIPPED** on `pull_request`.
- The earlier "merge PR #6 then promote the freeze" next action was retracted.

Stale/superseded statements from PR #9/#10/#11 were not copied. No secrets or PII are stored
in this file.

## 12. Release state

- Frozen Beta runtime baseline: `6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26`
- Represents: **BETA-R1 SQL-backed read runtime candidate**
- Status: **NOT YET DEPLOYED.** Azure Beta is not live on this baseline; the currently deployed
  site still predates BETA-R1 until the later manual deployment task succeeds.
- Preserved: Firebase Authentication remains; DOE remains untouched; session writes remain
  disabled; no Firestore session fallback for the BETA-R1 session-read path.
- **PR #6 is still NOT merged and NOT deployed.** Commit B does not authorize a merge.

## 13. Exact next safe action

Stop for architect review and owner approval. **Do NOT merge PR #6** even though Commit B CI
is green. A later merge must preserve Commit A ancestry — no squash, no rebase-merge.
BETA-R3 live activation remains blocked by (1) the requirement for a reviewed PR #6 merge plus
push to `main` before `azure-beta-deploy.yml` can run, and (2) the Entra service principal /
`paws_swa_beta` app registration `403` (account lacks directory role).
