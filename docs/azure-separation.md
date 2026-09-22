# PAWS Azure Separation

This is the single authoritative document for how PAWS Azure work is separated from
main PAWS development. It supersedes scattered deployment notes; `AGENTS.md` and
`SETUP.md` remain the operational contract and link here.

User-facing project name: **PAWS**. Legacy technical identifiers (repository names,
Firebase project IDs, Azure hostnames, commit SHAs) are intentionally unchanged.

---

## 1. Architecture

```
Alex1122341/Teaching-assignment                  (main PAWS development)
  ├── GitHub Pages test frontend
  ├── Firebase / Firestore lab + test integration   (vista-teaching-lab)
  ├── DOE API server implementation                 (server/)
  └── Azure production workflows (legacy, still present — see §11)

        │  one-way, reviewed, manual
        │  baseline frozen at 86bd5aa
        ▼

Alex1122341/Teaching-assignment-azure            (private, Azure beta line)
  ├── Frozen application runtime (44 shipped files)
  ├── Azure deployment configuration + workflows
  └── Releases to https://red-cliff-04871ca0f.5.azurestaticapps.net
```

Two properties make this safe:

1. **The beta application is frozen.** Its content trust anchor is the immutable
   commit `86bd5aa2c8a25259f3f708e49b322220ff43a147`. No shipped runtime file may
   drift from that commit.
2. **Azure is never reachable from ordinary work.** The beta build workflow holds
   no Azure credential, and the deploy workflow is manual, environment-gated, and
   pinned to an exact SHA plus an exact successful source run.

The Azure beta site uses the **live** Firebase project `tester-teaching` for
Authentication and Firestore. It is not a sandbox.

---

## 2. Repositories

| Repository | Visibility | Role |
|---|---|---|
| `Alex1122341/Teaching-assignment` | primary | PAWS application development, GitHub Pages test site, Firebase lab integration, DOE API server |
| `Alex1122341/Teaching-assignment-azure` | **private** | Frozen Azure beta line: Azure deployment config, Azure-specific workflows, Azure-specific docs, beta release assets |

The Azure repository was cut from the primary repository at `86bd5aa`. It is a
separate repository, **not** a fork and **not** synchronized. There is no automatic
sync in either direction, by design.

State at the time of writing:

- `Teaching-assignment` main: `5328fac8e8b7561bd40b3d6cd5f472dfaee4954c`
- `Teaching-assignment-azure` main: `e15a53240a6b6a688d95299539a5628ac2b54144`

---

## 3. Branch strategy

**Azure repository**

- `main` is the only deployable ref. It is the frozen line plus reviewed
  infrastructure and documentation commits.
- Feature/infrastructure work goes through a branch + pull request. A push or PR
  runs **Azure Beta Build**, which never contacts Azure.
- Do not commit feature work directly to `main`.

**Primary repository**

- `main` continues normal PAWS development. Azure work there is legacy (§11) and
  is not modified by this workstream.

**Promotion rule**

A test-site feature reaches the Azure beta only through a separately reviewed
change that also moves the frozen baseline. Moving the baseline requires updating,
together and in review: the frozen commit reference, the manifest-derived
protection, and this documentation. It is never an implicit side effect.

---

## 4. Shared contracts

| Contract | Where it lives | Notes |
|---|---|---|
| Shipped-file allowlist | `tools/static-assets.json` (44 entries) | Authoritative list of what ships to Azure |
| Frozen runtime enforcement | `tools/beta-freeze.js` | Compares each protected file to the blob in the baseline commit via `git cat-file`; `--artifact .deploy-static` validates a built/downloaded artifact |
| Baseline report | `tools/beta-baseline.json` | **Documentation and live-site reporting only.** CI never trusts it; editing a runtime file and this JSON together still fails |
| Static build | `node tools/build-static.js` | Same allowlist in both repositories |
| Azure SWA config | `staticwebapp.config.json` | Copied into `.deploy-static` by the build |
| DOE calculation semantics | `server/` in the primary repository | Never duplicated. Azure hosts it; it does not define it |
| Firestore security rules | `firestore.rules` | Never weakened to make deployment easier |

The protected set is the **union** of the paths named by the current manifest and
by the manifest stored in the baseline commit, so deleting a path from the mutable
manifest does not remove it from the freeze.

---

## 5. Deployment flow

```
push / PR → main          Azure Beta Build   (no Azure credential)
                            ├── npm ci
                            ├── npm test
                            ├── npm run test:emulator
                            ├── node tools/build-static.js
                            ├── cp staticwebapp.config.json
                            ├── node tools/beta-freeze.js
                            ├── node tools/beta-freeze.js --artifact .deploy-static
                            └── upload artifact  azure-beta-<SHA>

manual dispatch           Azure Beta Deploy  (environment: beta)
                            ├── verify requested SHA == HEAD == origin/main
                            ├── verify source run: this repo, azure-beta-build.yml,
                            │     push event on main, completed, success, head_sha match
                            ├── verify frozen baseline at requested SHA
                            ├── download azure-beta-<SHA> from that exact run
                            ├── re-verify downloaded artifact against baseline
                            └── upload bytes to Azure (no rebuild)
```

Artifacts are named `azure-beta-<full SHA>` and retained 7 days.

---

## 6. Required GitHub variables

**Azure repository: none.** `Azure Beta Build` requires no repository or
environment variable. Verified: configured variable count is 0.

Primary repository (legacy Azure workflows only, not part of the beta line):
`PRODUCTION_DOE_API_BASE_URL`, `DOE_API_APP_NAME` — see §13 blocker B1.

---

## 7. Required GitHub secrets

| Secret | Scope | Read by | Notes |
|---|---|---|---|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Environment `beta`, Azure repository | **Azure Beta Deploy only** | Deployment token for the existing Azure Static Web App |

That is the only secret in the Azure repository. `Azure Beta Build` receives no
secret. Configured repository-level secret count is 0.

Primary repository (legacy, not part of the beta line):
`AZURE_STATIC_WEB_APPS_API_TOKEN`, `AZURE_DOE_API_PUBLISH_PROFILE`.

Never commit a deployment token, publish profile, ARM token, service account, or
private key. Documentation may name required keys; it never contains values.

---

## 8. Environment names

| Environment | Repository | Purpose |
|---|---|---|
| `beta` | `Teaching-assignment-azure` | Gate for the manual Azure beta release. Restrict to `main`; add a required reviewer where available |
| `production` | `Teaching-assignment` | Legacy gate for the primary repository's two Azure production workflows |

---

## 9. Manual deployment sequence

1. Merge the reviewed change into Azure `main`.
2. Open the successful **Azure Beta Build** run for the current `main` SHA.
3. Copy that run's run ID and its full commit SHA.
4. Run **Azure Beta Deploy** (`workflow_dispatch`) with those two exact values.
5. Approve the `beta` environment when environment review is enabled.
6. Verify `https://red-cliff-04871ca0f.5.azurestaticapps.net`.

The gate fails closed. It refuses to download or upload unless every one of these
holds: requested SHA is the checked-out commit **and** the current remote `main`
head; the source run belongs to this repository; the source run came from
`.github/workflows/azure-beta-build.yml`; it was a `push` event on `main`; it
completed successfully; and its `head_sha` equals the requested SHA.

A normal push never releases. There is no pull-request preview environment.

### Post-release verification

After any release, confirm the live site still serves the frozen bytes. For every
path in `tools/static-assets.json`, GET
`https://red-cliff-04871ca0f.5.azurestaticapps.net/<path>`, canonicalise CRLF to
LF, hash with SHA-256, and compare against
`git cat-file blob 86bd5aa2c8a25259f3f708e49b322220ff43a147:<path>`. All 44 must
match. This is read-only and needs no credential.

### Release history

First gated release: **completed.** Run `35646315010`, dispatched by `Alex1122341`
on 2026-09-21T19:40:39Z, deployed `e15a53240a6b` with every verification step
green. Post-release verification passed 44/44 (0 drifted, 0 unreachable).

---

## 10. Rollback sequence

Preferred:

1. Revert Azure `main` to the known-good commit through a reviewed change.
2. Let **Azure Beta Build** produce `azure-beta-<good SHA>` (artifacts expire after
   7 days, so an old artifact usually must be rebuilt).
3. Dispatch **Azure Beta Deploy** for that SHA and its successful run ID.

Emergency:

- `tools/deploy_azure_static_web.ps1` from a known-good local checkout, using the
  same `tools/build-static.js` allowlist and the committed `staticwebapp.config.json`.
  The deployment token must be supplied locally and never committed.

Because the runtime is frozen at `86bd5aa`, every successful build produces
byte-identical runtime content. A rollback restores deployment state, not
application logic — which is why reverting `main` is sufficient.

---

## 11. What remains in Teaching-assignment

Everything except the Azure beta line: the application, the GitHub Pages test
site, Firebase lab integration, the DOE API server, Firestore rules, and all
application tests.

Azure-specific items still present in the primary repository, classified:

| Item | Classification | Rationale |
|---|---|---|
| `.github/workflows/azure-static-web-apps.yml` | NEEDS OWNER DECISION | Production build gate for the primary repo; currently failing (B1) |
| `.github/workflows/azure-production-deploy.yml` | NEEDS OWNER DECISION | Manual + `production` env, but deploys Azure SWA from the primary repo |
| `.github/workflows/azure-doe-api-production-deploy.yml` | NEEDS OWNER DECISION | Manual + `production` env; packages the existing `server/` implementation (does not duplicate DOE logic) |
| `staticwebapp.config.json` | SHARED CONTRACT | Needed by `tests/azure-deployment.test.js`; a copy ships in the Azure repo |
| `tests/azure-deployment.test.js` | KEEP IN MAIN | Tests the primary repo's own Azure workflows |
| `tools/build-doe-api.js`, `tools/verify-production-doe-api.js` | SHARED CONTRACT | Existing server packaging; not DOE logic |
| `tools/deploy_azure_static_web.ps1` | MOVE/COPY TO AZURE REPO | Already copied; kept as emergency fallback |
| `tools/import_firestore_azure_sql.ps1` | MOVE/COPY TO AZURE REPO | Azure SQL import, no application dependency |
| `docs/superpowers/**2026-09-15-azure-*` (4 files) | OBSOLETE (historical) | Predate the split; superseded copies in the Azure repo carry HISTORICAL banners |

Nothing was deleted to produce this classification.

---

## 12. What belongs only to Azure

| Asset | Notes |
|---|---|
| `.github/workflows/azure-beta-build.yml` | Build + freeze verification, no Azure credential |
| `.github/workflows/azure-beta-deploy.yml` | Manual, exact-SHA, environment-gated release |
| `tools/beta-freeze.js` | Frozen-runtime enforcement against the baseline commit |
| `tools/beta-baseline.json` | Documentation / live-site reporting only |
| `tests/beta-baseline.test.js` | Freeze contract tests |
| `azure-beta-<SHA>` artifacts | Immutable, commit-addressed build output |
| Environment `beta` + `AZURE_STATIC_WEB_APPS_API_TOKEN` | The only Azure credential in the Azure line |

---

## 13. Known blockers

**B1 — Azure build workflow in the primary repository fails on every push.**
`.github/workflows/azure-static-web-apps.yml` requires `vars.PRODUCTION_DOE_API_BASE_URL`,
but the primary repository has **0** configured variables. The five most recent
runs all failed, including run `35674271511` on current main `5328fac8e8b7`. It runs
only on push to `main`, so it does not block pull requests, but `main` push CI is
red. Owner decision: configure the variable, or retire the workflow now that the
beta line lives in the Azure repository.

**B2 — Two Azure production workflows remain in the primary repository.**
`azure-production-deploy.yml` and `azure-doe-api-production-deploy.yml` were added
after the split. They are manual and environment-gated, so they are not an
immediate isolation risk, but Azure deployment authority is duplicated across two
repositories. Owner decision required before relocating.

**B3 — Baseline is behind main.** The beta is frozen at `86bd5aa`; main has
advanced to `5328fac8e8b`. Promotion requires a reviewed baseline move, not a sync.

**B4 — Beta runs against live data.** The Azure beta site uses the live Firebase
project `tester-teaching`. Destructive test procedures must not be run against it.

**B5 — Azure DOE API App Service is out of scope here.** Its deployment material
lives in the primary repository (§11); relocation is an owner decision.
