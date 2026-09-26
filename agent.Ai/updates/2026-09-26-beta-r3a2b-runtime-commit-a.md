# Agent Update — BETA-R3A-2B Runtime Commit A (and correction of BETA-R3A-2 evidence)

**Date:** 2026-09-26
**Agent/model:** HY3 / WorkBuddy (strict release-engineering correction)
**Repository:** Alex1122341/Teaching-assignment-azure
**Task status:** COMPLETE — Runtime Commit A created and pushed; fresh CI green; PR #6 NOT merged

> ## ⚠ SUPERSEDED (later on 2026-09-26, BETA-R3A-3)
>
> **Commit B has since been created.** Do not read "Commit B NOT created" below as current
> state. Commit B `c53cddb535947362b13e9cb3858e43b31330c923` (parent `6eeb1a4`) promoted the
> frozen Beta runtime baseline from `86bd5aa2c8a25259f3f708e49b322220ff43a147` to
> `6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26`.
>
> The authoritative record is now `agent.Ai/updates/2026-09-26-beta-r3a3-commit-b-freeze-promotion.md`
> on PR #6. This PR (#11) is **retired** — it is documentation-only, must NOT be merged, and its
> facts have been folded into PR #6.
>
> One statement below that is now WRONG and must not be reused: section 4.3 and the related
> "no Commit B" lines describe the state *at the time of Runtime Commit A*, before Commit B.

## 1. Goal

Correct material errors in the previous BETA-R3A-2 report, then create **Runtime Commit A**
(a merge of current `main` INTO PR #6) so that PR #6 carries genuinely fresh post-retarget
CI evidence. Explicitly **not** in scope: merging PR #6, deploying, promoting the frozen
baseline, or creating Commit B.

## 2. Corrections to the previous BETA-R3A-2 report

### 2.1 CORRECTION 1 — the reported CI was NOT post-retarget CI

The previous report presented these runs as current post-retarget evidence:

- Azure SQL Migration Tests — run `36249819711`
- Azure Beta Build — run `36249819750`

They are **pre-retarget historical evidence**. Their creation time predates the PR #6 base
change, and the Azure Beta Build checkout log for that run stated:

```
HEAD is now at: d6d2339  Merge 075852b... into edb46dc...
```

i.e. that run tested **PR #6 HEAD merged with the OLD PR #3 HEAD (`edb46dc`)**, not with
current `main` (`ea80eecc`). Those runs are therefore retired as post-retarget evidence and
are recorded here as historical only.

### 2.2 CORRECTION 2 — `tools/verify-beta-candidate.js` IS wired into CI

The previous report stated that `tools/verify-beta-candidate.js` "is not wired as a dedicated
CI step". That is **false**. `azure-beta-build.yml` contains:

```yaml
- name: Verify strict frozen main runtime
  if: github.event_name == 'push'
  run: |
    node tools/beta-freeze.js
    node tools/beta-freeze.js --artifact .azure-production/app
- name: Verify explicit Beta-R1 release-candidate drift
  if: github.event_name != 'push'
  run: node tools/verify-beta-candidate.js
```

The candidate verification step **does** run `node tools/verify-beta-candidate.js`.

### 2.3 CORRECTION 3 — strict main freeze does NOT run on a PR candidate

The two verification steps are mutually exclusive by event gate:

| step | gate | on `pull_request` | on `push` |
|---|---|---|---|
| Verify strict frozen main runtime | `github.event_name == 'push'` | **SKIPPED** | runs |
| Verify explicit Beta-R1 release-candidate drift | `github.event_name != 'push'` | **runs** | SKIPPED |

The previous report implied that strict beta-freeze + artifact freeze ran successfully on the
PR candidate. It did not — that step is **SKIPPED** for `pull_request`. Only the explicit
Beta-R1 release-candidate drift check runs on a PR, and that is the correct candidate behavior.

### 2.4 CORRECTION 4 — PR #6 must NOT be merged yet

The previous "next safe action" proposed merging PR #6 and then promoting the freeze. That is
**not approved**. Merging now would place BETA-R1 runtime on `main` while the strict frozen
baseline still points to `86bd5aa2c8a25259f3f708e49b322220ff43a147`, intentionally producing a
failing intermediate `main` build. Commit A + Commit B exist precisely to avoid that.

## 3. Preflight (all matched — no stop condition triggered)

- `main` = `ea80eecc9fa2ac2b693c23979bad5c5809a26863` ✔
- PR #6 base = `main` (base SHA `ea80eecc…`) ✔
- PR #6 HEAD = `075852b150e8870b4e49e1076586cbbc82bc1bcb` ✔
- PR #6 state = `open`, draft = `true`, mergeable = `true` (`mergeable_state = clean`) ✔

## 4. Runtime Commit A

- **Strategy:** RETARGET-ONLY retained. No rebase, no history rewrite.
- **Operation:** `git merge --no-ff ea80eecc…` on `task/beta-r1-connect-azure-sql`.
  Zero conflicts; no manual semantic resolution.
- **COMMIT_A_SHA:** `6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26`
- **Parents:** `075852b150e8870b4e49e1076586cbbc82bc1bcb` (first), `ea80eecc9fa2ac2b693c23979bad5c5809a26863` (second)
- **Merge commit:** yes (two parents)
- **Push:** normal (non-forced) fast-forward `075852b..6eeb1a4`

### 4.1 Content identity of Commit A vs old PR #6 HEAD (`075852b`)

Full `git ls-tree -r` comparison: the ONLY differences are

- `AGENTS.md` (modified — documentation/governance inherited from `main`)
- 15 new `agent.Ai/**` documentation files (governance, inherited from `main`)

Every other blob is byte-identical, including:

- `index.html`, `timetable.js`, `paws-data-client.js` — identical
- `server/**`, `swa-api/**`, `database/**` — identical
- `.github/workflows/**` — identical
- `tests/**`, `tools/**` — identical

Therefore:

- runtime semantic change caused by Commit A merge = **0**
- DOE changes = **0**
- BETA-R1 scope lost = **0**
- PR #6 changed-file scope relative to `main` = **42** (unchanged, still BETA-R1 only)

### 4.2 BETA-R1 commits preserved

`c006c9a`, `b230718`, `4af5af8`, `075852b` — all four SHAs unchanged and all are ancestors of
Commit A (first-parent chain: `6eeb1a4` → `075852b` → `4af5af8` → `b230718` → `c006c9a`).

### 4.3 Frozen baseline NOT promoted (no Commit B) — **SUPERSEDED, see banner above**

> This section describes the state at Runtime Commit A only. Commit B
> `c53cddb535947362b13e9cb3858e43b31330c923` has since promoted the baseline to
> `6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26`.

`tools/beta-freeze.js`, `tools/beta-baseline.json` and `azure-beta-deploy.yml` all still
reference `86bd5aa2c8a25259f3f708e49b322220ff43a147`. Unchanged — Commit B is a separate,
separately reviewed task.

## 5. Fresh post-Commit-A CI (required — genuinely new runs)

Both triggered by the Commit A push, both `event = pull_request`, both
`head_sha = 6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26`, both PR #6 with
`base_ref = main` and `base_sha = ea80eecc9fa2ac2b693c23979bad5c5809a26863`.

| workflow | run ID | conclusion |
|---|---|---|
| Azure SQL Migration Tests | `36265424485` | **success** |
| Azure Beta Build | `36265424535` | **success** |

Neither `36249819711` nor `36249819750` was reused.

### 5.1 Azure Beta Build — exact step conclusions (run `36265424535`)

- Set up job — success
- `actions/checkout@v4` — success
- `actions/setup-node@v4` — success
- `actions/setup-java@v4` — success
- `npm ci` — success
- `npm ci --prefix swa-api` — success
- `npm test` — success
- server SQL runtime authorization tests — success
- `npm run test:emulator` (Firebase emulator regression) — success
- `node tools/build-beta-release.js` — success
- **Verify strict frozen main runtime — SKIPPED** (`if: github.event_name == 'push'`)
- **Verify explicit Beta-R1 release-candidate drift — SUCCESS** (runs `node tools/verify-beta-candidate.js`)
- `node --test tests/beta-baseline.test.js tests/azure-deployment.test.js` — success
- `actions/upload-artifact@v7` — success

The candidate step output confirms `tools/verify-beta-candidate.js` executed:

```
Run node tools/verify-beta-candidate.js
{ "ok": true,
  "baselineCommit": "86bd5aa2c8a25259f3f708e49b322220ff43a147",
  "intentionalCandidateDrift": [
    { "file": "index.html", "reason": "content-drift" },
    { "file": "paws-data-client.js", "reason": "missing-at-baseline" },
    { "file": "timetable.js", "reason": "content-drift" } ] }
```

Azure SQL Migration Tests (`36265424485`) steps: checkout, setup-python, pip install
`tools/requirements-azure-sql-migration.txt`, parse PowerShell migration scripts,
`python -m unittest discover -s tests/python -p "test_azure_sql_*.py"`, PowerShell loader
helper regression test — all success.

### 5.2 Checkout / merge context from the FRESH run

```
[command]/usr/bin/git checkout --progress --force refs/remotes/pull/6/merge
HEAD is now at c605cab Merge 6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26 into ea80eecc9fa2ac2b693c23979bad5c5809a26863
```

This is the correct current PR/main relationship. The stale string
`Merge 075852b into edb46dc` does **not** appear; neither `075852b` nor `edb46dc` appears
anywhere in the fresh checkout log.

## 6. Live operations

### Performed

- One non-forced push of Runtime Commit A to `task/beta-r1-connect-azure-sql`.
- Documentation-only correction commit on `docs/beta-r3a2-pr6-main-integration` (this PR #11).

### Explicitly NOT performed

- PR #6 NOT merged; PR #9 / #10 / #11 NOT merged
- no deployment, no Azure / Azure SQL / Firebase / Entra change
- no service principal creation, no `UserProfile` insert
- no DOE change
- no freeze promotion; baseline `86bd5aa` unchanged
- no Commit B

## 7. Current state after task

- PR #6: base `main`, base SHA `ea80eecc…`, HEAD `6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26`,
  Draft, open, `mergeable = true`, 42 changed files, 5 commits (4 BETA-R1 + Runtime Commit A)
- PR #11: Draft, open, base `main` — documentation only, not merged
- frozen baseline: `86bd5aa2c8a25259f3f708e49b322220ff43a147` (unchanged)

## 8. Blockers

- BETA-R3 live activation remains **BLOCKED** (carried from PR #9):
  1. `azure-beta-deploy.yml` requires a reviewed PR #6 merge + push to `main`;
  2. Entra service principal / `paws_swa_beta` app registration returns `403` (account lacks
     directory role).
- No blocker introduced by this task.

## 9. Exact next safe action

**Do NOT merge PR #6.** The next safe action is architect review of Runtime Commit A
(`6eeb1a4`) with fresh CI (`36265424485` / `36265424535`). Commit B (freeze promotion to the
new runtime baseline) is a **separate, separately reviewed task** that must only run after
that review and explicit owner approval.

## 10. DO NOT REDO

- Do NOT reuse runs `36249819711` / `36249819750` as post-retarget evidence — they are
  pre-retarget historical runs.
- Do NOT claim strict main beta-freeze passed on a PR candidate — it is SKIPPED by design.
- Do NOT claim `verify-beta-candidate.js` is unwired — it runs in the PR candidate step.
- Do NOT merge PR #6 / #9 / #10 / #11, deploy, promote the freeze, or create Commit B
  without explicit approval.
