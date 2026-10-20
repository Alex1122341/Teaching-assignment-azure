# PAWS dual environment: setup and deployment (owner steps)

These steps need the PAWS Owner's accounts: Azure, Firebase and GitHub repository admin. Nothing here can be done from a pull request, and none of it changes Production data.

## 0. Before the next Production API deploy (required)

The promoted API refuses to start without an explicit environment.

1. On **ITAPPVETOPSDB01** (University API Windows service, see `deploy/windows/README.md`), add `PAWS_ENVIRONMENT=production` to the service environment.
2. On any legacy **ACA** app that still serves PAWS, add `PAWS_ENVIRONMENT=production` to the container environment. The ACA release workflow now stops if this setting is missing.
3. Make sure the Windows service restarts on exit. Start-up already retries while SQL is unreachable, but stops if it's connected to the wrong environment.

## 1. GitHub Environments

In **Settings → Environments** of `Alex1122341/Teaching-assignment-azure`:

| Environment | Protection |
|---|---|
| `production` | **Required reviewers: the Owner** (and any approved deputy). Deployment branches: `main` only. |
| `testing` | No reviewers. Deployment branches: `main` only. |

Create `production` **before** merging. If it doesn't exist, GitHub creates it unprotected on first use, and the approval gate does nothing.

## 2. Testing resources (independent of Production)

| Resource | Notes |
|---|---|
| **Firebase project**, e.g. `paws-testing` | Separate from `tester-teaching`. Enable Email/Password sign-in. Create a Hosting site, e.g. `https://paws-testing.web.app`. Create a service account with the Hosting Admin and Firebase Authentication Admin roles. |
| **Azure SQL server and database**, e.g. `paws-testing-sql` / `VetMed-Ops` | **A new server**, never `ITAPPVETOPSDB01` or the legacy lab server, which holds real data. The database must be named `VetMed-Ops`, because the migrations require it. Microsoft Entra admin = the Testing deployment identity. |
| **Container registry + Container App**, e.g. `paws-testing-api` | Runs `deploy/testing/Dockerfile`. User-assigned managed identity for SQL. HTTPS ingress. |
| **Entra app / OIDC federated credential** for GitHub | Subject **`repo:Alex1122341/Teaching-assignment-azure:environment:testing`** only. Roles limited to the Testing resource group. |

### Container App environment (set once; the deploy only changes the image)

| Name | Value |
|---|---|
| `PAWS_ENVIRONMENT` | `testing` |
| `PAWS_TESTING_ENVIRONMENT_ID` | a new UUID (keep it; the database marker must match it) |
| `PAWS_TESTING_SQL_SERVER` | `paws-testing-sql.database.windows.net` |
| `PAWS_SQL_CONNECTION_STRING` | `Server=tcp:paws-testing-sql.database.windows.net;Database=VetMed-Ops;Encrypt=true` (exactly one `Server=`) |
| `PAWS_SQL_MI_CLIENT_ID` | client id of the Testing runtime managed identity |
| `PAWS_SQL_DRIVER` | `tedious` |
| `FIREBASE_PROJECT_ID` | the Testing Firebase project id |
| `PAWS_API_ALLOW_NON_LOOPBACK` | `true` (the container binds `0.0.0.0` behind ACA ingress) |
| `PAWS_API_ALLOWED_ORIGINS` | the Testing site origin |
| Write gates | `PAWS_*_WRITE_ENABLED=true` for each implemented workflow you want testers to use: faculty admin, session edit/create, Teaching Assignment draft/review/final/publish, swap request/decision/apply, AFC request/decision/cancel/single/batch/artifact, DOE admin/manual assignment/recalc. `PAWS_DOE_POLICY_PUBLISH_ENABLED` as required. Server authorization and validation still apply. |

## 3. GitHub Environment `testing`: secrets and variables

| Kind | Name | Value |
|---|---|---|
| secret | `PAWS_TESTING_ENVIRONMENT_ID` | same UUID as above |
| secret | `PAWS_TESTING_SQL_ADMIN_CONNECTION_STRING` | admin connection for reset: `Server=tcp:paws-testing-sql.database.windows.net;Database=VetMed-Ops;Encrypt=true` |
| secret | `PAWS_TESTING_FIREBASE_SERVICE_ACCOUNT` | JSON key of the Testing Firebase service account |
| secret | `PAWS_TEST_PERSONA_PASSWORD` | 12+ characters; used only by Faculty/HICC/VISC/ADC/LAB test personas |
| secret (optional) | `PAWS_TESTING_OPERATORS_JSON` | `[{"email":"tester@ucalgary.ca","role":"adfa_regular"}]`: named testers who may switch identity |
| variable | `PAWS_TESTING_SQL_SERVER` | `paws-testing-sql.database.windows.net` |
| variable | `PAWS_TESTING_SQL_ADMIN_CLIENT_ID` | client id of the identity that resets the database (holds `VIEW DEFINITION`, creates schema) |
| variable | `PAWS_TESTING_RUNTIME_PRINCIPAL` | name of the runtime managed identity as a database user |
| variable | `PAWS_TESTING_FIREBASE_PROJECT_ID` | Testing project id |
| variable | `PAWS_TESTING_SITE_URL` / `PAWS_TESTING_API_ORIGIN` | Testing site and API origins |
| variable | `PAWS_TESTING_ACR_NAME`, `PAWS_TESTING_ACA_APP`, `PAWS_TESTING_ACA_RESOURCE_GROUP` | Testing registry and app |
| variable | `PAWS_TESTING_AZURE_CLIENT_ID`, `PAWS_TESTING_AZURE_TENANT_ID`, `PAWS_TESTING_AZURE_SUBSCRIPTION_ID` | Testing OIDC identity |

## 4. Frontend configuration (one reviewed PR)

Fill in `config/environments/testing.json` (`apiOrigin`, `siteUrl`, `firebase`) and set `peerSiteUrl` in `production.json` to the Testing site, which makes "Open Testing Environment" visible to operators. Then:

```
node tools/render-environment-config.js --environment production --output paws-api-origin.js
node tools/verify-environment-config.js --repository
```

`paws-api-origin.js` changes, so this PR also needs its own governance freeze promotion, following `docs/dual-environment-freeze-promotion-20261020.md`.

## 5. First Testing database

Actions → **PAWS Testing Database Reset**, with `confirm = RESET-TESTING` and **`initialise_empty = true`**, on the new empty database. Later resets use `initialise_empty = false`. The tool refuses any database that doesn't carry this exact Testing marker.

## 6. Deploy flow after setup

1. Merge to `main` → **Azure Beta Build** builds the Production and Testing artifacts from the same commit and verifies both.
2. **PAWS Testing Deploy** runs automatically: Testing site and API image, both from the tested artifacts.
3. Testers verify in Testing (`04-acceptance-and-status.md`).
4. Production release (**Firebase Hosting Deploy**, environment `production`) waits for the Owner's approval.
5. Once Testing is live, set the repository variables **`PAWS_REQUIRE_TESTING_PASS=true`** (Production requires a successful Testing deploy of the exact commit) and, after the Production API is redeployed, **`PAWS_REQUIRE_ENVIRONMENT_IDENTITY=true`** (Production health must report `environment: production`).

## 7. Local acceptance (developer machine, Windows + LocalDB)

`node tools/testing-db/local-acceptance.js` builds a "production" stand-in and a Testing database on two separate LocalDB instances, and runs the real API against each. It refuses to drop a `VetMed-Ops` database it didn't create. If an older run left one behind, drop it yourself first.
