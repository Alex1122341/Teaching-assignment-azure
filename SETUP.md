# PAWS Azure Beta — Operations and Release

This repository is the controlled Beta line. Firebase Authentication supplies identity only. Business data flows through the University PAWS API to `VetMed-Ops` on `ITAPPVETOPSDB01`; the temporary public ingress is HTTPS through Cloudflare. Do not follow legacy steps that edit Firestore business records or deploy Firestore business rules for Beta.

## Current Beta architecture

- Azure Static Web Apps serves the browser application.
- Firebase Authentication provides sign-in; the API validates tokens and resolves authorization from SQL-backed `UserProfile`.
- Cloudflare HTTPS ingress forwards to the loopback-only University API. SQL/RDP/SMB are not public endpoints.
- `VetMed-Ops` is the business-data source of truth. The browser has no direct SQL access and no Firestore fallback for migrated business reads.
- Timetable writes are available only through API capabilities that are implemented and authorized server-side. Unsupported add, assignment, and legacy Firestore mutation controls stay disabled.
- Release only through the exact-SHA `Azure Beta Build` and manually gated `Azure Beta Deploy` workflows described below.

## Legacy Spark / Firestore setup (historical)

The original Faculty Dashboard activation and Firestore rules/index instructions belong to the Experimental/Spark deployment and are not instructions for this Azure Beta repository. Do not use Firebase Console or `firebase deploy` to seed Beta profiles, timetable data, roles, or DOE. If working on the Experimental repository, use that repository's current operating guide instead.

## Web deployment

This is the **Azure beta repository** `Alex1122341/Teaching-assignment-azure`. Its one browser deployment target is the **Azure beta site** `https://red-cliff-04871ca0f.5.azurestaticapps.net`.

The beta site uses Firebase project `tester-teaching` for Authentication only. Business data is read from `VetMed-Ops` through the University API. Firebase Hosting is not used for Beta web releases.

At the start of the post-P3 stabilization milestone, `main` was `783777f2dd0693cbc521ebc625817872514c2ada`. This repository is the controlled Azure Beta line. It does not automatically sync from `Alex1122341/Teaching-assignment`; a feature is promoted only through a separately reviewed change after its complete test cycle succeeds.

Azure beta release requires successful CI for the exact current `main` SHA. No release happens without a successful **Azure Beta Build** run for that exact SHA, and no release is triggered automatically.

A normal push to `main` does not release Azure beta. Pushing `main`, or opening a pull request against `main`, runs **Azure Beta Build**: it installs dependencies, runs `npm test`, runs the Firestore/Auth emulator suite, builds the release tree with `node tools/build-beta-release.js` into `.azure-production/app`, stages the canonical `staticwebapp.config.json`, and uploads the immutable artifact `azure-beta-<SHA>`. That workflow never contacts Azure and holds no Azure credential.

### One-time Firebase authorized domain setup

In Firebase Console, open **Authentication > Settings > Authorized domains** and confirm `red-cliff-04871ca0f.5.azurestaticapps.net` is present. This is required so Firebase Authentication can sign users in from the Azure beta host.

### One-time gated Azure beta setup

Create a GitHub Environment named `beta` under **Settings > Environments** and configure it as the beta release gate:

1. Restrict deployment branches/tags so only `main` may deploy to this environment.
2. Add `AZURE_STATIC_WEB_APPS_API_TOKEN` as a **beta environment secret** containing the deployment token for the existing Azure Static Web App behind `https://red-cliff-04871ca0f.5.azurestaticapps.net`.
3. If GitHub exposes environment reviewers for this private repository, add a required reviewer and enable prevention of self-review.

Never commit the deployment token, an ARM token, or an Azure access token to the repository. Only the manual **Azure Beta Deploy** workflow reads `AZURE_STATIC_WEB_APPS_API_TOKEN`; the build workflow never receives it.

### Releasing Azure beta

1. Open the successful **Azure Beta Build** run for the current `main` SHA.
2. Copy its run ID and its full commit SHA.
3. Run **Azure Beta Deploy** manually with those two exact values.
4. Approve the `beta` environment when GitHub environment review is available.
5. Verify `https://red-cliff-04871ca0f.5.azurestaticapps.net` after deployment.

The release gate fails closed. **Azure Beta Deploy** refuses to download or upload anything unless every one of these is true:

- the requested SHA is the checked-out commit and is also the current remote `main` head;
- the source run belongs to this same repository;
- the source run came from `.github/workflows/azure-beta-build.yml`;
- the source run was a `push` event on `main`;
- the source run is completed and successful;
- the source run's `head_sha` equals the requested SHA.

It then downloads the already-built `azure-beta-<SHA>` artifact from that exact run and uploads those bytes to Azure. It does not rebuild, does not run tests, and does not accept a stale SHA, a failed run, or a run from another workflow.

This beta repository has no pull-request preview environment and no automatic release. A normal push cannot deploy Azure beta.

The Azure beta URL is publicly reachable and is not a security boundary. Firebase Authentication establishes identity; the University API enforces SQL-backed role and scope authorization.

### Frozen runtime contract

The W1F integration candidate freezes static and API runtime files at immutable W1D product commit `da21223a1d92572ff72767796229a655d122efb4`, which contains accepted W1C and W1D runtime changes. W1E and W1F governance commits do not change protected runtime bytes. It remains branch-only until Architect review, required PR CI, merge, and the separately gated exact-main release.

1. The authoritative list of shipped application files is `tools/static-assets.json` (52 entries). All are protected, not a small subset.
2. The protected set is the union of the paths named by the current manifest and by the manifest stored in the frozen baseline commit. Deleting a path from the mutable manifest does not remove it from the freeze.
3. Protection is enforced by `tools/beta-freeze.js`, which compares each protected file with the blob stored in the frozen baseline commit using `git cat-file`. It never compares against a hash file in the working tree.
4. `tools/beta-baseline.json` is documentation and live-site reporting only. Editing a runtime file and that JSON together still fails CI, because verification reads the baseline Git objects.
5. Normal CI fails if any shipped runtime asset drifts: **Azure Beta Build** runs `node tools/verify-beta-candidate.js` for the repository and `node tools/beta-freeze.js --artifact .azure-production/app` for the built artifact. Both `pull_request` and `push` to `main` allow **zero** protected runtime drift.
6. **Azure Beta Deploy** independently revalidates the requested SHA and the downloaded artifact against the same frozen baseline before any Azure upload. It does not rebuild.
7. Moving the baseline to a new commit is explicit, reviewed release work: the frozen commit reference, the manifest-derived protection and this documentation change together. It never happens implicitly.

The deployed website remains on the last released `main` version until the current stabilization candidate completes CI, merge, and exact-main deployment.

### Firestore rule changes

This Azure Beta release workflow does not deploy Firestore business rules or indexes. Firebase is used for Authentication only; do not use `firebase deploy` to change Beta data access. Any separate Firebase change must belong to an explicitly scoped Experimental/Demo task.

### Emergency/manual fallback

`tools/deploy_azure_static_web.ps1` remains an emergency/manual fallback. It uses the same `tools/build-static.js` allowlist and the committed root `staticwebapp.config.json` as GitHub Actions.

On Windows, if the downloaded script is blocked, unblock it without weakening the machine execution policy:

```powershell
powershell -NoProfile -Command "Unblock-File -LiteralPath '.\tools\deploy_azure_static_web.ps1'"
powershell -File .\tools\deploy_azure_static_web.ps1
```

Routine releases should use **Azure Beta Build** followed by the manual **Azure Beta Deploy** release for the exact current `main` SHA instead of this local fallback.

The following Faculty replacement, teaching-summary import, password, timetable-editing, and AFC notes are retained as **legacy Experimental/Firestore reference**. They do not describe the live Azure Beta path. Do not execute them against Beta.

## Legacy Experimental: Faculty replacement requests

For **Request replacement for me**, the faculty-facing picker is sourced from the complete active Faculty Database through a sanitized derived directory rather than from dashboard login accounts. The browser receives a display name, opaque candidate key, aliases needed for timetable matching, and binary away-from-campus availability dates. It does not receive another faculty member's UCID, email, DOE, AFC purpose/reason, or other Faculty Database fields.

The picker shows **Available** when clear. An AFC conflict shows only **Unavailable**. A timetable overlap may show the conflicting course and time because the timetable is already visible to authorized timetable users. `Sessional` and `Other` are also available; either choice requires a non-blank Reason / Note.

Normal faculty requests store only the opaque candidate key and display name. During approval, ADFA resolves that key using the admin-only mapping, reloads the live faculty and timetable data, rechecks AFC and timetable conflicts, and then applies the replacement. Approved `Sessional` / `Other` requests write that literal category/name with no Faculty UCID.

The sanitized directory is rebuilt whenever the full Faculty Dashboard derived indexes are rebuilt, and approved AFC dates are added to its binary availability projection in the same approval batch.

## Legacy Experimental: Teaching-summary bulk import and recovery

The **Faculty Dashboard > Teaching Summary** synchronization card is restricted to Owner / ADFA General. Selecting a source JSON performs a read-only preflight first. The preflight validates the source, fingerprints the exact raw bytes, compares source/current faculty and session sets, and shows creates, updates, stale sessions, warnings, and blocking errors before any teaching data is changed.

Before an import can start, the dashboard generates a pre-import recovery backup. The administrator operating the import is responsible for saving that downloaded backup somewhere durable and retrievable; the browser does not upload or centrally archive the recovery file. Keep the backup together with the exact source JSON used for the import until the import has completed and the resulting timetable has been accepted.

If an import fails after the maintenance lock is acquired, the teaching-data lock intentionally remains active. Normal session, faculty-data, change-request, and derived-index writes stay blocked while viewing remains available. There is no force-unlock path. Recovery must finish through one of the supported terminal paths:

- **Resume Import** requires selecting the exact original source file. Its raw-byte fingerprint must match the interrupted job before any resume work continues.
- **Restore Recovery Backup** requires the matching backup generated for that interrupted import. Restore is checkpointed and resumes if interrupted.
- **Take Over Recovery** is available only to another Owner / ADFA General. A non-blank reason is required, and takeover changes the recovery owner without changing the active import ID or bypassing its current phase.

Stale session deletion is not reached until the imported source has been verified. Completion is not reached until final session IDs match, derived indexes are rebuilt, and the provisional index verification passes. Only a terminal `COMPLETED` or `RESTORED` transition releases the lock, in the same Firestore batch as the terminal job update.

Destructive failure-injection, interrupted-import, restore, takeover, and lock-enforcement testing must be run only against the Firebase emulator or another isolated disposable environment. The Azure beta site uses the live `tester-teaching` backend; against beta, use only the non-destructive preflight/smoke-test steps unless a real synchronization is intentionally being performed.

This feature depends on the reviewed maintenance rules in `firestore.rules`. Frontend banners and disabled controls are usability guards; Firestore Security Rules are the actual backend enforcement boundary. Deploy the reviewed rules before relying on production maintenance enforcement:

```bash
npx firebase deploy --project tester-teaching --only firestore:rules
```

Do not describe the maintenance lock as production-enforced until that rules deployment has been confirmed.

## Legacy Experimental: Passwords

The account creation form accepts a temporary password only while creating the Authentication login. It clears that value after the operation and never stores it in the dashboard database. `Send password reset` uses Firebase Authentication's standard reset-email flow. A signed-in user can change their own password on `password.html`.

If you manually create a user with a temporary password and want the dashboard to prompt for a change, check `Require password change on next dashboard sign-in` on that user's profile.

## History

The Timetable and Faculty Dashboard create `session_change_log` / `faculty_change_log` records as part of their normal save workflow. `faculty-access.js` captures the form's starting values and, after a successful save closes the editor, enriches the newest matching actor log with before/after details. The History tab merges these logs where appropriate and shows Calgary time, actor, action and before/after values when available. The base log still exists even if the enrichment step is interrupted.

Older log records remain visible but may show `Legacy entry; detailed before/after values were not recorded.` because earlier versions did not store those fields.

## Legacy Experimental: Timetable editing and AFC requests

Use **Faculty Dashboard > Teaching Summary** for the highest-permission workbook replacement and synchronization tools. Timetable administrators can choose **Select Sessions**, select up to 200 writable sessions across Day, Week, Month, or List views, and review them in one spreadsheet-style editor. Saving validates every row before creating one atomic batch containing one session update and one `session_change_log` record per changed session. CCC entries remain read-only.

New AFC requests require both the off-campus contact address and telephone number from the official form. Applicant, Reports To, and administrator signatures, approval state, immutable PDF chunks, and audit records remain in Firestore. Existing approved legacy requests without these newer contact fields stay readable and approvable.

## Development checks

Install the root development dependencies with `npm ci`. Run static tests with `npm test`; run the Firestore rule suite with `npm run test:emulator`. The `test-support/` modules are pure policy fixtures used by those tests and are excluded from the web deployment bundle.

Build the Azure publishing directory with `node tools/build-static.js`. The application bundle comes from the exact allowlist in `tools/static-assets.json`; Azure deployment metadata is staged afterward. Current query counts, migration hashes, rollback exports, and the 50,000-read estimate are recorded in `PERFORMANCE_REPORT.md`.
