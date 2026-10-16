# Agent Update — AFC / DOE recovery candidate

**Date:** 2026-10-08  
**Agent/model:** Codex  
**Repository:** Alex1122341/Teaching-assignment-azure  
**Task status:** PARTIAL

## Goal and starting breakpoint

Owner supplied a new bounded AFC/DOE repair task, permitting local implementation while authenticated P4 acceptance remains blocked. Base main/workflow: `621d61ebe00dc5f1e93dfd9cf8c47779f842ef58`; branch `fix/afc-doe-recovery-20261008`. No PR. This update supersedes the stale P3 current-state headings for this candidate only.

## Work performed / components

- AFC controller and workflow: names replace visible technical IDs; IDs remain in requests/attributes. Real calendar validation, confirmed list readback before single-create success, uncertain-write lock, definite closed-gate handling. No automatic non-idempotent replay.
- DOE worksheet SQL adapter: reuse shared teaching/role resolution, preserve stored zero and negative overrides, carry calculated/effective provenance and specific review reasons. Avoid duplicate legacy role source IDs already represented by assignment facts.
- Reserve: require a recognized stream; canonicalize explicit teaching-focused labels. Four Guidelines examples, overage and 35% boundary covered.
- Regression fixtures use synthetic identities only. Architecture, authentication, write gates and freeze baselines remain unchanged.

## Source evidence

Workbook SHA256 `a834d571a25942a1242c9ae3d4f56f975525dfa48658c76883a92dac6bb1d1b4`, all 34 sheets including 20 hidden sheets inventoried: 6,654 nonempty physical rows, 98,368 populated cells, 46 cached error cells. These counts are not unique faculty or assignment counts. Formulas, cached values, types, styles, defined names and comments retained privately; no Excel recalculation or import. Exact Guidelines PDF read from an authorized local copy.

Private source-row ledger is an inventory, **not** completed business reconciliation. SQL rows read: 0; identities bound: 0; full faculty/assignment coverage denominator not yet established. Derived summaries/transforms must not be imported as additional workload. Needs Review before/after live counts remain unknown. Raw faculty evidence is outside Git.

## Verification

- Full server: `npm test --prefix server`: 508 pass / 0 fail / 0 skip.
- Final root full run at product HEAD `8885f6ce97a7b4548e332d200e0b768a16199c85`: 809 total, 774 pass / 3 fail / 32 skip. All three failures are the protected static/API freeze assertions.
- Focused AFC/controller before two additional readback cases: 44 pass / 0 fail / 0 skip; all eight new AFC recovery cases also passed, including matching and nonmatching readback.
- Changed JS syntax and `git diff --check`: pass.
- Static build: 59 files / 1,881,787 bytes. Beta release build: pass, API 58 files.
- Static freeze: FAIL, 2 changed runtime paths. API freeze: FAIL, 3 changed runtime paths. The 3 root failures test these protected drifts. No freeze promotion authorized or performed.
- Local Node 24.19.0 differs from server declared Node 22.x. Dependency install used `--ignore-scripts`; no claim of a real SQL connection from local fixtures.

## Live matrix / operations

Fresh read at 2026-10-08T17:38:10Z: Hosting `https://tester-teaching.web.app`; configured API `https://radar-languages-shopper-corporate.trycloudflare.com`; runtime release `00c2a0d5bcb0168586b62f66c1539a88cb71212f`, trust anchor `d62f5406ce1f89813bf928611e551e864ae165fc`; runtime/SQL health 200; anonymous me 401; exact Hosting CORS allowed. Of 59 downloaded protected static paths, 46 match the P4 artifact source and 13 differ. This does not establish a complete live static release SHA or authenticated functionality.

15 runtime gates checked: AFC single/batch/request true; AFC decision/artifact false; DOE admin/publish/recalculate false; original other gates unchanged. Build 229/run 37780288807 succeeded at main621d; Build227/run37685762531 artifact for00c2 remains unexpired. Workflow requires artifact source SHA to equal live API release. GitHub secret-name listing lacks `FIREBASE_SERVICE_ACCOUNT_TESTER_TEACHING`.

No live writes, gate changes, SQL changes, migration reruns, API restart, Hosting deployment, PR, merge or push. Migrations026/027 and current runtime SQL principal/permissions have **not** been freshly checked because the remote execution device is unavailable to current tools. Historical health does not replace those checks.

## Blockers / review requirements

Approved Admin then Faculty browser sign-in is still needed for actual acceptance. Hosting service-account secret requires an authorized human administrator. Authorized server/SQL read access is needed for full crosswalk and principal/migration evidence. A6 must review candidate commits, recognized stream aliases, duplicate-source semantics, legacy stored provenance, and partial totals before authorizing PR/freeze promotion/deployment. Actual reported live AFC SQL failure remains unreproduced under authentication.

## Breakpoint and next action

AFC commit `7a55b18c80037837d654a239cee8708a3ad99f13` and DOE commit `8885f6ce97a7b4548e332d200e0b768a16199c85` are preserved locally. Candidate report and blockers were visibly posted to Architect#6 in the current P4 release conversation; review response pending. Heartbeat automation is already PAUSED. Resume live acceptance from6A after approved authentication; do not rerun026/027 or substitute personal SA permissions. Complete semantic workbook row mapping and source→SQL→API→UI reconciliation only using authorized full SQL evidence. Do not claim IMPLEMENTED as DEPLOYED or LIVE ACCEPTED.

## Remaining execution plan

1. A6 review: concrete candidate commits, independent tests, unresolved source/provenance limits, separate freeze governance scope.
2. Authorized read snapshot: all faculty/session/role/trainee/rotation/CCC rows and evidence; deterministic exact identity crosswalk; fuzzy candidates stay unbound. Record every mismatch and explicit exception.
3. Add missing rule/source/partial-display tests from that evidence; apply only bounded agreed fixes. No blanket correction or recalculation.
4. A6-approved PR, freeze promotion, CI/version matrix and SQL preview if required.
5. Authorized API release, authenticated acceptance, Hosting-only workflow, authenticated Admin/Faculty UI and AFC persistence/readback. Save actual proof.

## DO NOT REDO

Do not replace source workbook, recalculate cached source evidence, import duplicate derived sheets, expose private source rows, override active policy, enable DOE gates, or change immutable freeze baselines merely to pass tests.
