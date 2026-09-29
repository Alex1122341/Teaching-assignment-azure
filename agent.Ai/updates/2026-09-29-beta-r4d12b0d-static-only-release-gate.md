# BETA-R4D-12B0D Static-Only Release Gate

Date: 2026-09-29
Status: implementation in progress; not deployed

## Scope

- Branch: `feature/beta-r4d12b0d-static-only-release-gate`
- Exact base: `main` at `3871888038a0c1e81fee4dd545c3fb9ebf8b941d`
- Frozen runtime baseline: `b3458f79a05353ce1255874754e1c6c1ec8ee683`
- Intended change: add `.github/workflows/azure-beta-static-deploy.yml` and focused release-contract tests only.
- Product runtime, API runtime, SQL, Firestore data, Dockerfile, existing full-stack deployment workflows, and freeze baseline remain unchanged.

## Gate design

The new workflow is manual and requires `source_run_id`, `commit_sha`, `expected_live_aca_revision`, and `expected_live_api_digest`. It accepts only the successful `Azure Beta Build` push run for the exact current `main` SHA, independently verifies repository and downloaded static/API artifacts against the frozen baseline, and uses Azure OIDC only for read-only ACA identity checks.

Static upload is blocked unless the live ACA app is `Single` mode with exactly one active expected revision, the immutable expected API digest, healthy/provisioned state, SQL health returns HTTP 200 with `status=ok` and `service=paws-beta-sql-runtime`, and all anonymous API boundary routes return 401. After upload, the workflow compares the public bytes of `index.html`, `asset-loader.js`, `approval-workflow.js`, `afc-workflow.js`, and `paws-data-client.js`, then repeats ACA, SQL, and auth checks and uploads token-free evidence.

## Known predeploy condition

The last B0G live check recorded the SQL health endpoint timing out. The B0D workflow therefore emits `PREDEPLOY_SQL_HEALTH_BLOCKER` and performs no static upload if the bounded 12-attempt health gate does not resolve. No API image publish, ACA change, SQL write, Firestore delete, or B1 work is authorized in this phase.

## First dispatch diagnostic

The first fresh-main Static Deploy dispatch (`36635176574`) stopped before Azure operations because the job-level `environment: beta` changed the GitHub OIDC subject to an unconfigured environment subject. No SWA upload, ACA operation, SQL write, or Firestore write/delete occurred. The remediation removes the job-level environment declaration so the workflow uses the existing branch-compatible federated identity; the fix must itself pass a new PR and exact-main Build before another dispatch.
