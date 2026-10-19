# Firebase Hosting static-only release guard — 2026-10-19

## Problem and evidence

The existing `.github/workflows/firebase-hosting-deploy.yml` requires `/api/health/runtime.releaseSha` to equal the latest static-only main commit and assumes DOE Admin, Publish and Recalculate gates are all disabled. A legitimate previously deployed university API can report its older release SHA, and actual gates may have been explicitly enabled since that initial workflow assumption. The October 14 AFC/LAB release documents a successful, audited Hosting-only CLI release when this obsolete workflow guard blocked without changing the runtime gates.

## New explicit mode

Default manual release remains strict: exact API `releaseSha == commit_sha`, DOE admin/publish/recalculate disabled.

The separate opt-in `static_only=true` mode requires the operator to provide `expected_live_api_sha` and:
1. Confirm source_run_id is a completed successful **push/main** Azure Beta Build for exactly the requested commit; release only its CI artifact.
2. Confirm the expected live University API SHA is a valid, older ancestor of the tested main SHA.
3. Require the complete protected API source inventory and **every API runtime, build and package input byte** to be unchanged between the deployed API commit and the new main commit. No API drift exceptions.
4. Confirm live `/api/health/sql` and `/api/health/runtime` are healthy; runtime `releaseSha` exactly matches the explicit expected live API SHA. Keep anonymous 401 and CORS checks.
5. Snapshot a deterministic, sorted digest of all live API write gates before Hosting; require exactly the same live API SHA and gate digest afterward.
6. Deploy **Hosting only** with the downloaded static artifact and verify public file bytes converge. Do not restart the University API or alter DOE gates, SQL, Firebase rules, indexes, Functions, or deployment secrets.
7. Save mode, expected SHA, observed live API SHA and gate digest in the existing release evidence artifact.

This is an additive explicit static-only mode, not a reduction of the normal API+Hosting release gate. It refuses any changed protected API file or live API SHA mismatch.

## Verification and release boundary

- `tests/firebase-static-only-hosting.test.js` checks explicit mode, protected API provenance, preservation of the default DOE-off checks and post-release gate receipt.
- Run full candidate CI, merge the reviewed PR, require exact-main push CI, obtain the exact artifact, and explicitly dispatch the workflow with input SHAs. Check actual run result and public byte convergence.
- Until all checks and an explicit dispatch succeed, no Hosting release is claimed.

## No-repeat
Do not replay the AFC import/correction, MASTER 413 CCC source replacement, Faculty/trainee imports, SQL migrations or DOE calculation or publication.
