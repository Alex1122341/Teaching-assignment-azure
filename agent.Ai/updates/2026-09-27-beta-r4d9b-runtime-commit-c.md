# Agent Update — BETA-R4D-9B Runtime Commit C

**Date:** 2026-09-27  
**Agent/model:** GPT-5 / WorkBuddy  
**Repository:** Alex1122341/Teaching-assignment-azure  
**Task status:** IMPLEMENTED — DRAFT PR PENDING

## 1. Goal

Move Beta timetable reads to the proven ACA SQL API, remove the SWA managed API
from the production deployment path, preserve Firebase Authentication, and
keep session writes fail-closed. Do not deploy or promote the frozen baseline.

## 2. Starting breakpoint

- base branch: `origin/main`
- base SHA: `37b4db8a556cb12e588a0f95b08a83e793960851`
- working branch: `feature/beta-r4d9b-aca-direct`
- starting SHA: `37b4db8a556cb12e588a0f95b08a83e793960851`
- live assumptions: R4D-8B complete; ACA SQL API and exact CORS already verified

## 3. Work performed

- Added the reviewed HTTPS ACA origin and `credentials: omit` to the browser
  data client; bearer-token authentication remains unchanged.
- Removed `api_location` and `skip_api_build` from the production SWA deploy
  workflow, leaving the static app upload and manual exact-main gates intact.
- Added focused R4D-9B tests for ACA origin use, fail-closed auth, static-only
  SWA deployment, retained API packaging, and timetable write/read guards.
- No Azure, Firebase, SQL, GitHub configuration, or deployment mutation.

## 4. Files / components changed

- `paws-data-client.js`
- `.github/workflows/azure-beta-deploy.yml`
- `tests/beta-r4d9b-cutover.test.js`
- narrow continuity updates under `agent.Ai/`

## 5. Architecture / invariants affected

Runtime Commit C changes the browser timetable backend from same-origin `/api`
to the exact ACA origin. Firebase Auth remains the identity provider, SQL
session writes remain disabled, unrelated Firestore domains remain intact, and
the frozen baseline is intentionally not promoted yet.

## 6. Data / algorithm changes

No data, identity matching, authorization records, SQL schema, DOE, AFC, or
migration changes.

## 7. Tests / CI evidence

- `node --test tests/beta-r4d9b-cutover.test.js` — 4/4 passing.
- Targeted, server, build, and freeze verification has been run. The emulator
  harness timed out without a final summary and is reported as inconclusive.
- Expected old-baseline result after the protected client change: intentional
  freeze drift; do not bypass it. Governance Commit D must promote the reviewed
  Runtime Commit C baseline later.

## 8. Live operations

Performed: none. Explicitly not performed: no SQL writes, Firebase changes,
ACA changes, CORS changes, deployment, merge, or baseline promotion.

## 9. Current state after task

- final branch: `feature/beta-r4d9b-aca-direct`
- final SHA: Runtime Commit C created locally; record the resolved SHA in the
  handoff report after the final documentation amend.
- PR: not yet created
- merge/deploy state: not merged, not deployed

## 10. Blockers / unresolved questions

Full test suite and artifact build still need verification. Legacy Firestore
session mutation code remains in `timetable.js` but is guarded by the false
`sessionWritesEnabled()` contract; no broad refactor is planned.

## 11. Exact current breakpoint

Run the full required tests and build, inspect the intentional freeze failure,
then commit Runtime Commit C, push the feature branch, and open a Draft PR.

## 12. Next safe action

Complete verification and Draft PR creation. Do not deploy or start Governance
Commit D.

## 13. DO NOT REDO

Do not repeat R4D-8B auth proof, rotate verifier keys, change CORS, modify SQL,
or deploy the frontend.
