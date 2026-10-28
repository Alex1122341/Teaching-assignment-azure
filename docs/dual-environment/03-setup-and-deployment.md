> **2026-10-22 update — Azure retired.** Active University Testing operations are in [12-university-testing-operations.md](12-university-testing-operations.md). API: VET-C31293; online SQL: ITAPPVETOPSDB01 / VetMed-Ops-Testing; independent Firebase identity. Earlier Azure provisioning/reset/revision instructions below are historical and must not be executed. Code preparation is not live acceptance; SQL installation/isolation, Auth, actual API staging and final release remain pending.
# PAWS dual environment: infrastructure inventory and Owner setup

These steps need the PAWS Owner's accounts (Azure, Firebase, GitHub repository owner). None of them changes Production data. Replace every `<placeholder>`; nothing here is a real resource name until the Owner creates it. Run `node tools/testing-preflight.js` at any point to see what is still missing.

## A. Infrastructure inventory

| Resource | Exists today? | Needed for | Notes |
|---|---|---|---|
| Production Firebase project `tester-teaching` + Hosting `https://tester-teaching.web.app` | **Yes** (Production) | Production | Unchanged. |
| Production University API (school server, loopback 18787, Cloudflare quick tunnel) | **Yes** (Production) | Production | Needs `PAWS_ENVIRONMENT=production` before the next API release (§0). |
| Legacy ACA `paws-sql-beta-api-260926` (rg `rg-ucvm-teaching-lab`) | Yes (legacy Production-class) | ACA release path only | Holds or reaches real data. Needs `PAWS_ENVIRONMENT=production` before an ACA release (§0). Never used by Testing. |
| Testing Firebase project (Auth + Hosting site) | **No** | Testing | §2.1 |
| Testing Azure SQL logical server + database `VetMed-Ops` | **No** | Testing | §2.2. The name must end in `.database.windows.net`; the runtime refuses anything else. |
| Testing Azure Container Registry | **No** | Testing | §2.3 |
| Testing Container Apps environment + app (HTTPS ingress, target port 8080) | **No** | Testing | §2.3 |
| Testing runtime user-assigned managed identity (SQL login for the API) | **No** | Testing | §2.3 |
| Entra app registration with GitHub OIDC federated credential (deploy + reset identity) | **No** | Testing CI | §2.5. Separate from any Production identity. |
| GitHub repository variables/secrets `PAWS_TESTING_*`, approver lists | **No** | CI | §3 |
| GitHub Environments / Required reviewers | **Not available** | — | Private repository owned by a personal account. Required reviewers need GitHub Enterprise for private repositories; on GitHub Free, private-repository environments are not available at all. The workflows don't use them (§1). |

**Network.** The Testing Container App reaches Testing SQL inside Azure: enable *Allow Azure services and resources to access this server* on the Testing SQL server, or use a private endpoint. The reset workflow opens a temporary firewall rule for its own runner IP and removes it afterwards. Testing never needs the University network, the school server or Cloudflare.

**Costs (Owner authorization required before creating anything).** Approximate list prices: Azure SQL Database Basic (5 DTU) or serverless General Purpose with auto-pause, a few CAD/month idle. Container Apps consumption plan, scale to zero, near zero when idle. ACR Basic, about 5 USD/month. Firebase Spark plan (Auth + Hosting), no charge at this scale. Confirm prices in the Azure pricing calculator for the subscription's region before provisioning.

## 0. Production compatibility (before the next Production API release)

The PR makes `PAWS_ENVIRONMENT` mandatory. The current Production runtime ignores the variable, so it is safe to **add it first** and upgrade later. The new runtime refuses to start without it.

| Production path | Where the environment comes from | Change |
|---|---|---|
| University API (school server) | The reviewed launcher script named by `ApiLauncherPath` in `recovery-config.json` (outside the repository), whose SHA-256 is pinned in `ApiLauncherSha256` | Add `PAWS_ENVIRONMENT=production` to the launcher, re-hash it, update `ApiLauncherSha256`, run recovery `-CheckOnly` |
| Legacy ACA `paws-sql-beta-api-260926` | Container App environment variables | `az containerapp update -n paws-sql-beta-api-260926 -g rg-ucvm-teaching-lab --set-env-vars PAWS_ENVIRONMENT=production` (creates a revision with the same image) |
| Firebase Hosting | Static rendering of `config/environments/production.json` | Nothing to set |

**Pre-checks** (on the school server, in the launcher's environment, before the upgrade):

```powershell
node -e "const e=require('./server/src/runtime/environment');console.log(e.resolveEnvironment(process.env))"   # from the NEW release folder; must print { name: 'production', testing: false, ... }
Invoke-RestMethod http://127.0.0.1:18787/api/health/runtime | Select-Object status,releaseSha,environment   # current release: environment is absent (old runtime)
```

Never set `PAWS_TESTING_ENVIRONMENT_ID`, `PAWS_TESTING_SQL_SERVER` or `PAWS_API_ALLOW_NON_LOOPBACK` on a Production host; the runtime rejects them.

**Rollout.** (1) Add the variable to the launcher or ACA and restart the current release. Verify health, unchanged gates and login. (2) Release the new API per the normal exact-main procedure. (3) Verify that `/api/health/runtime` reports `"environment":"production"`, the same `writeGates` fingerprint as before, and that `/api/v1/me` returns 401 anonymously. (4) Then set `PAWS_REQUIRE_ENVIRONMENT_IDENTITY=true` (§1).

**Rollback.** Start the previous release folder with the previous launcher. The extra variable is harmless to older runtimes. If the new runtime exits with `paws_api_environment_rejected`, it is connected to a database marked as Testing: stop and investigate, never remove the marker. If it logs `paws_api_sql_unavailable_retrying`, SQL is unreachable; it keeps retrying with backoff and does not listen until SQL answers.

## 1. GitHub governance (no Environments)

The release and Testing workflows deliberately have no `environment:` key. An environment cannot add Required reviewers on this plan, and adding one would change the OIDC subject of the existing ACA login. Instead, every gate is **evidence produced by workflows that run from `main`** and checked by `tools/verify-release-evidence.js`:

| Stage | Proof | Produced by |
|---|---|---|
| Build | Successful *Azure Beta Build* push run of the SHA on `main` | CI |
| Deployment | *PAWS Testing Deploy* run (definition from `main`, job `deploy_testing` successful) and its evidence file for the SHA | CI |
| Acceptance | *PAWS Release Approval* run by a listed approver with UAT outcome `passed`, naming the Testing deploy | Owner |

Repository **variables** (Settings → Secrets and variables → Actions → Variables). Only the repository owner can edit them on a personal-account repository:

| Variable | Value | Effect |
|---|---|---|
| `PAWS_RELEASE_APPROVERS` | `Alex1122341` (comma-separated GitHub logins) | Who may record a UAT approval |
| `PAWS_TESTING_RESET_OPERATORS` | `Alex1122341,SakibHossain9999` (example) | Who may reset the Testing database |
| `PAWS_REQUIRE_TESTING_PASS` | `true` once Testing is live | Firebase Hosting and ACA releases need a successful Testing deploy of the same SHA |
| `PAWS_REQUIRE_RELEASE_APPROVAL` | `true` once UAT is in use | Releases also need a recorded approval |
| `PAWS_REQUIRE_ENVIRONMENT_IDENTITY` | `true` after §0 step 3 | Firebase release requires the API to report `environment: production` |

**Limitation (Owner decision).** On GitHub Free, private repositories have no branch protection, so a collaborator with write access could change workflows on `main` itself. The evidence checks stop accidental or branch-based bypasses and leave an audit trail, but they do not stop a malicious collaborator. GitHub Pro adds branch protection for private repositories (require PRs and reviews on `main`, restrict who can push). That makes the evidence gate enforceable without making the repository public.

## 2. Testing resources

### 2.1 Firebase (Testing project)

1. Create a new Firebase project, for example `<paws-testing-project>`. **Do not** reuse `tester-teaching`, and don't name it `tester-teaching-*`: the validators refuse anything that contains the Production id.
2. Authentication → enable Email/Password. Authorized domains: the Testing Hosting domain only.
3. Hosting → create the default site `https://<paws-testing-project>.web.app`.
4. Project settings → Your apps → add a Web app and copy its config into `config/environments/testing.json` (template: `config/environments/testing.template.json`).
5. IAM → create a service account with *Firebase Hosting Admin* and *Firebase Authentication Admin*, and create a JSON key for GitHub (§3).

### 2.2 Azure SQL (Testing)

1. Create a **new** logical server `<testing-sql-server>.database.windows.net`, never `ITAPPVETOPSDB01` or `ucvm-teaching-lab-…`. Entra-only authentication. Entra admin: the GitHub OIDC app from §2.5, so the reset can create schema.
2. Create the database **`VetMed-Ops`** (the migrations require this name), empty.
3. Networking: allow Azure services (or a private endpoint for the Container App).

### 2.3 Registry, Container App, runtime identity

1. ACR `<testingacr>` (Basic).
2. User-assigned managed identity `<paws-testing-runtime>`; grant it `AcrPull` on the ACR.
3. Container Apps environment and app `<paws-testing-api>`: external HTTPS ingress, target port **8080**, the managed identity attached, single revision mode.
4. The Container App's ingress URL is `apiOrigin` in `testing.json`.

### 2.4 Container App environment (set once; deploys only change the image)

Use `deploy/testing/testing-api.env.template`. It lists every variable, with every write gate set explicitly (see `07-write-gate-and-persona-matrix.md`). Check it before the first deploy:

```bash
az containerapp show -n <paws-testing-api> -g <testing-rg> --query 'properties.template.containers[0].env' -o json > aca-env.json
node tools/testing-preflight.js --api-env aca-env.json
```

The deploy workflow runs the same validator and refuses to activate a revision if it fails.

### 2.5 GitHub OIDC (Testing deploy and reset)

Entra app registration `<paws-testing-github>`, federated credential with subject **`repo:Alex1122341/Teaching-assignment-azure:ref:refs/heads/main`**. Grant it roles scoped to the Testing resource group only: *Contributor* on the Container App, *AcrPush* on the ACR, and *SQL Server Contributor* for the reset's firewall rule. Make it the Entra admin of the Testing SQL server. It must have no role on any Production resource group.

## 3. GitHub repository variables and secrets (Testing)

| Kind | Name | Value |
|---|---|---|
| variable | `PAWS_TESTING_AZURE_CLIENT_ID` / `_TENANT_ID` / `_SUBSCRIPTION_ID` | §2.5 app |
| variable | `PAWS_TESTING_ACR_NAME`, `PAWS_TESTING_ACA_APP`, `PAWS_TESTING_ACA_RESOURCE_GROUP` | §2.3 |
| variable | `PAWS_TESTING_SQL_SERVER` | `<testing-sql-server>.database.windows.net` |
| variable | `PAWS_TESTING_SQL_RESOURCE_GROUP` | resource group of the Testing SQL server |
| variable | `PAWS_TESTING_SQL_ADMIN_CLIENT_ID` | client id of the §2.5 app (the reset connects as it) |
| variable | `PAWS_TESTING_RUNTIME_PRINCIPAL` | display name of the §2.3 managed identity (database user) |
| variable | `PAWS_TESTING_FIREBASE_PROJECT_ID`, `PAWS_TESTING_SITE_URL`, `PAWS_TESTING_API_ORIGIN` | §2.1 / §2.3; must equal `testing.json` |
| secret | `PAWS_TESTING_ENVIRONMENT_ID` | the UUID used in the Container App |
| secret | `PAWS_TESTING_SQL_ADMIN_CONNECTION_STRING` | `Server=tcp:<testing-sql-server>.database.windows.net,1433;Database=VetMed-Ops;Encrypt=true` (no password) |
| secret | `PAWS_TESTING_FIREBASE_SERVICE_ACCOUNT` | JSON key from §2.1 |
| secret | `PAWS_TEST_PERSONA_PASSWORD` | 12+ characters; Faculty/HICC/VISC/ADC/LAB test sign-ins only |
| secret (optional) | `PAWS_TESTING_OPERATORS_JSON` | `[{"email":"<tester>@ucalgary.ca","role":"adfa_regular"}]`: named ADFAD testers |

## 4. First Testing database and accounts

Actions → **PAWS Testing Database Reset** from `main`: `confirm = RESET-TESTING`, **`initialise_empty = true`** (first time only). It writes the marker, applies all migrations, loads the synthetic data, creates workflow fixtures through the real API code, verifies `tools/testing-db/fixture-coverage.json`, and provisions the Testing sign-ins. The run's `paws-testing-reset-<run>` artifact records who ran it and the result.

## 5. Frontend configuration (one reviewed PR, with its own freeze promotion)

1. Fill `config/environments/testing.json` from §2.1/§2.3.
2. Set `production.json` `peerSiteUrl` to the Testing `siteUrl`. Operators then see *Open Testing Environment*.
3. Regenerate and verify the configuration:

   ```bash
   node tools/render-environment-config.js --environment production --output paws-api-origin.js
   node tools/verify-environment-config.js --repository
   node tools/testing-preflight.js
   ```

4. `paws-api-origin.js` changes, so this PR needs its own governance promotion commit (pattern: `docs/dual-environment-freeze-promotion-20261020.md`).

## 6. First deploy and verification

1. After the PR from §5 merges, **Azure Beta Build** builds and verifies both artifacts. **PAWS Testing Deploy** runs automatically. It checks build provenance, validates the Container App environment, deploys the tested API image and the Testing site, then checks health, SQL, anonymous denial, gates, CORS and the served configuration. It uploads `paws-testing-deploy-<sha>` (kept 90 days).
2. Run `node tools/testing-preflight.js --live`. All checks should pass.
3. Admin UAT: `08-admin-uat-guide.md` and the checklist in `04-acceptance-and-status.md`.
4. Record the outcome: Actions → **PAWS Release Approval** (commit SHA, `passed`/`failed`, link to the UAT record).
5. Production release as today (Firebase Hosting Deploy, and the University API procedure). With the §1 variables set, the release refuses any commit without the evidence.
