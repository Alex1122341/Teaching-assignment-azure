# PAWS Beta — Development, CI and Hosting

**Repository:** `Alex1122341/Teaching-assignment-azure` (controlled Beta, not automatically synchronized with Experimental).

## Active architecture

- **Web:** Firebase Hosting at https://tester-teaching.web.app (project `tester-teaching`).
- **Identity:** Firebase Authentication; University API verifies bearer tokens.
- **API:** University-hosted Windows Node runtime, temporarily exposed via approved Cloudflare HTTPS ingress; its source includes historically named `swa-*` adapters that **remain active**.
- **Business authority:** SQL Server `ITAPPVETOPSDB01` / `VetMed-Ops`. SQL UserProfile establishes roles/scopes; no browser-to-SQL connection.
- **Not an active target:** Azure Static Web Apps (`red-cliff-04871ca0f.5.azurestaticapps.net`). Legacy SWA static deployments, configuration, and CLI scripts have been removed. The Azure Static Web Apps resource and any GitHub/Azure credentials are separate infrastructure and are **not** deleted by a code change.

## Local build and tests

Require Node.js 22 and install workspace dependencies without deploying anything:

```powershell
npm ci
npm ci --prefix server
npm ci --prefix swa-api
npm test
npm run test:emulator
node tools/build-beta-release.js
node tools/verify-beta-candidate.js
node tools/beta-freeze.js --artifact .azure-production/app
node tools/beta-api-freeze.js --artifact .azure-production/api
```

The combined `.azure-production` artifact deliberately contains **both** `app/` (81 allowlisted Firebase assets) and `api/` (the separately protected University/API-compatible package). This naming is historical and is retained for compatibility with the tested build and deployment workflows. `tools/build-static.js` independently creates the Firebase `.deploy-static` directory from `tools/static-assets.json`.

Azure SWA-specific `staticwebapp.config.json` is not required. The only faculty-dashboard redirect is specified by `firebase.json`.

## Safe release

1. Make changes on a feature branch; inspect existing modules and add/update tests.
2. Protect the 81 shipped static files and the independently frozen API input set: `tools/beta-freeze.js`, `tools/beta-api-freeze.js`. A runtime edit needs explicit reviewed baseline promotion; do not move the anchor as a side effect.
3. Obtain reviewed PR CI and merge. Require a successful **exact-main push** `Azure Beta Build` run with matching immutable artifact `azure-beta-<SHA>`.
4. Release the *already-tested* artifact through `.github/workflows/firebase-hosting-deploy.yml` using its exact source run ID and main SHA. `static_only` is an explicit optional mode that attests unchanged live API source, exact live API SHA, and identical full write-gate fingerprints before/after Hosting. The normal mode retains stricter controls.
5. Confirm Firebase public bytes, SQL/API health, 401 authorization, CORS and unchanged live write gates. CI green and merge **do not automatically deploy**.
6. Only use `firebase deploy --only hosting --project tester-teaching` as a separately authorized equivalent when it provides the same exact-artifact audit and pre/post checks; never deploy Firestore rules, indexes, Functions or SQL incidentally.

The following workflows remain for independent *backend* operations, not browser hosting:
- `.github/workflows/azure-beta-acr-publish.yml` — API container registry.
- `.github/workflows/azure-beta-aca-deploy.yml` — API Container Apps.
- `.github/workflows/azure-sql-migration-test.yml` and separate SQL scripts — database tests and migrations.

The `azure-beta-build.yml` name and `swa-api` source tree remain to avoid breaking the active combined build and University Node API runtime. **Do not delete them during static-host retirement.**

## Legacy Spark / Firestore setup (historical)

Earlier Firebase/Firestore business-data setup, Azure SWA releases, and PR-preview procedures are historical records, **not instructions for this Azure Beta repository**. Those notes remain in dated `docs/superpowers/` specs/plans, `agent.Ai/updates/` and Git history. Do not replay old source imports, enable Firestore fallback, or perform database migrations just because the deployment guide was updated.

For current permissions, source authority, no-silent-publication, privacy, current branch/release evidence and change procedures, read `AGENTS.md`, `agent.Ai/ARCHITECTURE.md`, `agent.Ai/WORKFLOWS.md` and the latest `agent.Ai/updates/`.
