> **2026-10-22 update — Azure retired.** Active University Testing operations are in [12-university-testing-operations.md](12-university-testing-operations.md). API: VET-C31293; online SQL: ITAPPVETOPSDB01 / VetMed-Ops-Testing; independent Firebase identity. Earlier Azure provisioning/reset/revision instructions below are historical and must not be executed. Code preparation is not live acceptance; SQL installation/isolation, Auth, actual API staging and final release remain pending.
# PAWS Testing: deployment runbook

For the Owner and operators. Setup is in `03-setup-and-deployment.md`; testers use `08-admin-uat-guide.md`.

## Prerequisites

- `node tools/testing-preflight.js` reports no failures. After the first deploy, `--live` also passes.
- Repository variables and secrets from `03` §1 and §3 exist. `PAWS_TESTING_RESET_OPERATORS` and `PAWS_RELEASE_APPROVERS` name real GitHub logins.
- The Container App environment passes `node tools/verify-testing-api-env.js --aca-env <file>`.

## Database initialization and reset

| When | Action |
|---|---|
| First time | Actions → **PAWS Testing Database Reset**, from `main`, `confirm = RESET-TESTING`, `initialise_empty = true` |
| Later resets | Same, `initialise_empty = false` |

The reset refuses a database without this Testing marker (or one that isn't provably empty), any non-Azure-SQL server, and any operator not on `PAWS_TESTING_RESET_OPERATORS`.

**What a reset does:** it drops every PAWS object except the marker, re-applies all migrations, loads `seed-base.sql` and `seed-ta.sql`, creates the workflow fixtures through the real API code (`seed-workflows.js`), verifies `fixture-coverage.json`, and re-provisions the Testing sign-ins.

**What it discards:** all tester changes, plus **all audit rows in the Testing database** (`AuditEvent`, `SupportOperation`, `SupportContext`, history). The reset run's own evidence artifact (`paws-testing-reset-<run>`: operator, time, commit, counts, coverage) is kept for 90 days in GitHub. UAT notes belong outside the database (`08` §6).

**Test accounts:** the reset re-provisions Faculty/HICC/VISC/ADC/LAB persona sign-ins (shared `PAWS_TEST_PERSONA_PASSWORD`). It also re-adds named operators from `PAWS_TESTING_OPERATORS_JSON`. Operator-class personas (developer, owner, administrator, ADFA General) never get a password; they are reached only by Switch Test Identity.

## Build and deployment

1. A merge to `main` triggers **Azure Beta Build**: tests, freeze checks, the Production artifact and, once `testing.json` is complete, the Testing artifact (`paws-testing-<sha>`).
2. **PAWS Testing Deploy** starts automatically when the build succeeds (or manually with `source_run_id` + `commit_sha`). It never resets or seeds the database.
3. Its checks, in order: build provenance (same repository, `main`, push, success, SHA), `testing.json` equals the repository variables, artifact environment guard and freeze, the tested API artifact, the Container App environment (validator), then image push and revision. After that: `/api/health/runtime` reports `environment: testing` and the deployed SHA, served gates equal configured gates, `/api/health/sql` returns 200, anonymous `/api/v1/me` returns 401, the Production-site CORS preflight is refused, and the Testing site serves the Testing rendering.
4. Evidence: `paws-testing-deploy-<sha>`, with `status: success` only when every step passed.

**Build ≠ Deployment ≠ Acceptance.** A green build does not mean Testing was deployed. Only a successful *PAWS Testing Deploy* run with its evidence does. Acceptance exists only as a *PAWS Release Approval* run.

## Health checks (manual)

```bash
curl -s https://<testing-api>/api/health/runtime | jq '{status, environment, releaseSha, writeGates}'
curl -s -o /dev/null -w '%{http_code}\n' https://<testing-api>/api/health/sql        # 200
curl -s -o /dev/null -w '%{http_code}\n' https://<testing-api>/api/v1/me             # 401
node tools/testing-preflight.js --live
```

## Admin login and functional acceptance

1. Testers sign in at the Testing site with Testing accounts.
2. Run the checklist in `04-acceptance-and-status.md` (scenarios A–H) and record the results.
3. The Owner records the outcome: **PAWS Release Approval** (`commit_sha`, `uat_outcome`, `uat_reference`). A failed outcome is recorded and never approves.

## Production release (unchanged procedure, extra evidence)

With `PAWS_REQUIRE_TESTING_PASS=true` and/or `PAWS_REQUIRE_RELEASE_APPROVAL=true`, **Firebase Hosting Deploy** and **Azure Beta ACA Deploy** run `tools/require-release-evidence.sh` before any change. Each must be dispatched from `main`, for the exact SHA that Testing deployed and UAT accepted. For the University API (manual school-server release), the operator runs the same check before switching the launcher:

```bash
GH_TOKEN=<read-only token> GITHUB_REPOSITORY=Alex1122341/Teaching-assignment-azure \
  COMMIT_SHA=<sha> GITHUB_REF=refs/heads/main REQUIRE_RELEASE_APPROVAL=true PAWS_RELEASE_APPROVERS=Alex1122341 \
  bash tools/require-release-evidence.sh
```

## Rollback

| What | How |
|---|---|
| Testing API | `az containerapp revision list -n <app> -g <rg>`, then `az containerapp ingress traffic set -n <app> -g <rg> --revision-weight <previous>=100`, or re-run *PAWS Testing Deploy* for the previous `commit_sha` + `source_run_id` (artifacts are kept for 7 days) |
| Testing site | Firebase console → Hosting → release history → *Roll back*, or re-deploy the previous commit as above |
| Testing data | Reset (above) |
| Production | Unchanged by Testing; see `03` §0 for the `PAWS_ENVIRONMENT` change |

## Troubleshooting

| Symptom | Meaning | Action |
|---|---|---|
| API logs `paws_api_environment_rejected`, health 503 `ENVIRONMENT_MISCONFIGURED` | The database does not carry this Testing marker, or the configuration names a forbidden server or project | Check `PAWS_TESTING_ENVIRONMENT_ID` matches the reset secret; never edit the marker by hand |
| `paws_api_sql_unavailable_retrying` | SQL not reachable | Check the Testing SQL network rules and the runtime identity's database user |
| Deploy fails at *Verify Testing configuration* | `testing.json` and the repository variables differ | Make them identical |
| Deploy fails in `verify-testing-api-env.js` | The Container App environment is incomplete or unsafe | Fix the named variables (see the template) |
| Served gates differ from configured gates | Revision not restarted, or a variable typo | Re-check the environment, re-deploy |
| Pages show "Environment error … connected to a production API" | Frontend and API environments differ | Wrong `apiOrigin`; fix `testing.json` and redeploy |
| Persona action → `SUPPORT_ROUTE_DENIED` | That route is unavailable to personas (imports, artifacts) | Return to yourself |
| Persona action → `SUPPORT_CONTEXT_EXPIRED` | The 30-minute session ended | Return to myself, then switch again |
| `TESTING_PASS_REQUIRED` / `RELEASE_APPROVAL_REQUIRED` in a Production release | No qualifying evidence for that SHA | Deploy that SHA to Testing, complete UAT, record the approval |
| Reset `RESET_NOT_AUTHORIZED` | Operator not listed | The Owner adds the login to `PAWS_TESTING_RESET_OPERATORS` |
| Reset `fixture coverage incomplete` | A fixture didn't load | Read the run log; the database is left in a failed state; re-run the reset after fixing |
