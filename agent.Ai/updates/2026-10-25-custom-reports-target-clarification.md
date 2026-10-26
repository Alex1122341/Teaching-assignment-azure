# Agent Update — Custom reports source-of-truth clarification

**Date:** 2026-10-25
**Repository:** Alex1122341/Teaching-assignment-azure (existing feature work)
**Task status:** PARTIAL — deployment target clarification pending

## Goal and requirements

Tasks23–25: Owner/admin report builder, selected academic-year current records, independent History. Owner requested all proposed families selectable as filters: workload, teaching/work activities, appointments/roles; History separately selectable. Preserve the existing implementation while resolving the repository conflict below.

## Starting breakpoint / actual state

- Isolated worktree: `C:\Users\xinyu.zhu1\PAWS-DOE-Preview\.worktrees\rotation-calendar-workspace-20261025`.
- Branch `feat/custom-reports-20261025`, committed HEAD `fc912804048ae91535198c37651fd8c940de7aeb`, base `c0970cafddb53187906ba3257cfa81c9d31293eb`.
- Registry and source adapters committed. Snapshot/export API, HTTP wrapper and their three tests remain uncommitted. No report PR, runtime wiring, browser UI or release.

## Verification this checkpoint

Node22.20.0 ran `node --test server/test/report-definition.test.js server/test/report-source-scope.test.js server/test/report-sources.test.js server/test/report-api.test.js server/test/report-export.test.js server/test/report-functions.test.js`: **25 passed /0 failed /0 skipped**. This is targeted module evidence, not full application acceptance.

Actual ExcelJS artifact readback found numeric cell alignment lacks horizontal:right: row styling overrides numeric column alignment. Numeric value12.5 is retained. Add a failing readback assertion and fix this when implementation resumes; do not claim complete export presentation.

## Repository conflict / question pending

The latest user-supplied AGENTS.md for `C:\Users\xinyu.zhu1\Desktop\Teaching-assignment-main` identifies `Alex1122341/Teaching-assignment`, GitHub Pages and `vista-teaching-lab` Firestore. That protected downloaded directory is not a Git checkout; its on-disk AGENTS.md matches the supplied text. Existing report work and its worktree AGENTS.md identify the explicitly previously chosen `Teaching-assignment-azure` / Beta / University SQL path. These targets have incompatible data readers and publication contracts. Do not infer an architecture cutover or deploy to either target from the unresolved text.

An asynchronous clarification asks owner to choose the new Pages repository or continue the existing Beta branch. Await this answer before dependent integration/publication. No skill requires an additional design approval here; this is a concrete repository/data-authority conflict.

## Live operations

None. No SQL reads/writes, migrations, Firestore operations, rule/role/gate changes, merge or deployment. No raw source tree publication. Existing live Rotation release was not reverified or changed at this checkpoint.

## Next safe action

Use the owner's target answer. If Beta: finish Task3 boundary tests/Excel alignment; then runtime/client wiring, lazy Dashboard UI, independent branch review, separate freeze governance and coordinated API/Hosting acceptance. If Pages: preserve Beta work, obtain a fresh isolated clone of Teaching-assignment/main, inspect its actual trusted Firestore sources/rules and lazy bundle contract, adapt the design/plan before implementation. Do not transplant SQL readers or activate a DOE API on Pages. Retain the protected downloaded folder.

## Do not redo

Do not rerun the540-row migration or413CCC replacement, overwrite the original tracker signoffs, declare reports live, or reset/delete the uncommitted API work. Continue from the saved plan and existing commits.
