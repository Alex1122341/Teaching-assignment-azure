# Faculty Dashboard - Spark Basic Mode

This branch runs the UCVM faculty role/group/history features on the Firebase Spark plan without deploying Cloud Functions. Firebase project: `tester-teaching`.

## What works without Blaze

- Email/password sign-in through Firebase Authentication.
- ADFA General, ADFA Regular, HICC, VISC and Faculty profiles.
- ADFA General profile-first account creation and reviewed bulk provisioning from faculty records.
- HICC group ownership, course scope and membership. HICCs can change members in their own groups.
- Faculty self-service in Timetable, including Day/List teaching views, AFC requests, and privacy-safe replacement requests.
- ADFA timetable/session editing and faculty records in Faculty Dashboard.
- Dashboard-originated history in `session_change_log` and `faculty_change_log`, including before/after details for new edits.
- Self-service password change and Firebase password-reset email.

## Intentional Basic Mode limits

- Account creation uses Firebase Authentication's client API from a temporary secondary session, so the signed-in Owner session stays active. Existing Authentication users that are not linked to a dashboard profile still require individual review.
- HICC/VISC direct instructor replacement is view-only. ADFA administrators perform live timetable changes.
- Audit logs are written by the dashboard together with the edit. Direct Firebase Console edits are not automatically audited.
- `mustChangePassword` is a dashboard workflow control rather than a server-verified password-change claim.
- No Cloud Functions runtime is included or deployed. The repository contains only the Spark client and local test tooling.

## Activation order

1. Keep the current website and Firebase data backed up.
2. In Firebase Console > Authentication, confirm Email/Password sign-in is enabled.
3. Find the existing administrator in Authentication and copy the UID.
4. In Firestore Console, open `users/{UID}` for that administrator and set:
   - `role`: `adfa_general`
   - `active`: `true`
   - `mustChangePassword`: `false` (unless you intentionally want the password-change page first)
   Do this before relying on the new User Management page. Legacy `admin` still retains timetable and Faculty Dashboard access but is not ADFA General.
5. From the repository root deploy **rules and indexes** for initial activation:
   ```bash
   npx firebase deploy --project tester-teaching --only firestore:rules,firestore:indexes
   ```
   If the local Firebase CLI dependency is unavailable later, any Firebase CLI installation can deploy these rules; Cloud Functions are not required.
6. Complete the one-time Firebase Authorized Domain and gated Azure beta release setup in **Web deployment** below. Azure beta is released only by running **Azure Beta Deploy** manually against a successful **Azure Beta Build** run for the exact current `main` SHA.
7. Sign in once as Owner / ADFA General or another administrator and open **Faculty Dashboard**. If the privacy-safe faculty replacement directory does not exist yet, the dashboard creates `settings/faculty_swap_index` and the admin-only `settings/faculty_swap_map` from the current Faculty Database.
8. Open User Management.
9. To add one person, choose their faculty profile in **New account**. The profile supplies the name and email; choose the access role and enter a temporary password. Firebase supplies the Authentication UID after creation.
10. To prepare all faculty accounts, choose **Preview changes** under **Create missing faculty accounts**. Review the proposed creates, access updates, excluded records, and source-role cleanup before entering the temporary password and selecting **Apply reviewed changes**.
11. Keep **Require password change on next dashboard sign-in** selected for new accounts. The temporary password is sent only to Firebase Authentication and is not stored in Firestore, source code, or audit logs.
12. Create HICC groups, assign an HICC owner, course numbers and members.
13. Test with one Administrator, one HICC and one Faculty account before broader rollout.

## Web deployment

This is the **Azure beta repository** `Alex1122341/Teaching-assignment-azure`. Its one browser deployment target is the **Azure beta site** `https://red-cliff-04871ca0f.5.azurestaticapps.net`.

The beta site uses the live Firebase backend, project `tester-teaching`, for Authentication and Firestore. Test data-changing actions deliberately. Firebase Hosting is not used for beta web releases.

The application baseline is `45e0e93` (Runtime Commit I, the reviewed BETA-R4D-9H admin timetable access fix). This repository is the frozen Azure beta line. It does not automatically sync from the GitHub Pages test repository `Alex1122341/Teaching-assignment`; a test-site feature is promoted only through a separately reviewed change after its complete test cycle succeeds.

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

The Azure beta URL is publicly reachable and is not a security boundary. Firebase Authentication and Firestore Security Rules continue to protect application data.

### Frozen runtime contract

Azure beta is frozen at reviewed B0 runtime candidate commit `b3458f79a05353ce1255874754e1c6c1ec8ee683`. That immutable commit is the dual-runtime content trust anchor for every shipped file; it is not live until the separately gated B0D release.

This baseline is the **BETA-R4D-11A2 Dashboard DOE presentation runtime candidate** shared by static and API runtimes. It is the reviewed frozen runtime but it is **NOT YET DEPLOYED**: the deployed Azure beta site still predates this runtime until the later manual deployment task succeeds.

1. The authoritative list of shipped application files is `tools/static-assets.json` (46 entries: the previous 45-path set plus `dashboard-view-model.js`). All of them are protected, not a five-file subset.
2. The protected set is the union of the paths named by the current manifest and by the manifest stored in the frozen baseline commit. Deleting a path from the mutable manifest does not remove it from the freeze.
3. Protection is enforced by `tools/beta-freeze.js`, which compares each protected file with the blob stored in the frozen baseline commit using `git cat-file`. It never compares against a hash file in the working tree.
4. `tools/beta-baseline.json` is documentation and live-site reporting only. Editing a runtime file and that JSON together still fails CI, because verification reads the baseline Git objects.
5. Normal CI fails if any shipped runtime asset drifts: **Azure Beta Build** runs `node tools/verify-beta-candidate.js` for the repository and `node tools/beta-freeze.js --artifact .azure-production/app` for the built artifact. Both `pull_request` and `push` to `main` allow **zero** protected runtime drift.
6. **Azure Beta Deploy** independently revalidates the requested SHA and the downloaded artifact against the same frozen baseline before any Azure upload. It does not rebuild.
7. Moving the baseline to a new commit is explicit, reviewed release work: the frozen commit reference, the manifest-derived protection and this documentation change together. It never happens implicitly.

Task 6 — Azure authorization, deployment-token configuration and the first gated release — is separate from this contract and has NOT been completed.

### Firestore rule changes

GitHub Actions does not deploy Firestore rules in this workflow. When a pull request changes `firestore.rules`, deploy the rules manually after review:

```bash
npx firebase deploy --project tester-teaching --only firestore:rules
```

Deploy indexes separately when a reviewed change actually modifies `firestore.indexes.json`.

### Emergency/manual fallback

`tools/deploy_azure_static_web.ps1` remains an emergency/manual fallback. It uses the same `tools/build-static.js` allowlist and the committed root `staticwebapp.config.json` as GitHub Actions.

On Windows, if the downloaded script is blocked, unblock it without weakening the machine execution policy:

```powershell
powershell -NoProfile -Command "Unblock-File -LiteralPath '.\tools\deploy_azure_static_web.ps1'"
powershell -File .\tools\deploy_azure_static_web.ps1
```

Routine releases should use **Azure Beta Build** followed by the manual **Azure Beta Deploy** release for the exact current `main` SHA instead of this local fallback.

## Faculty replacement requests

For **Request replacement for me**, the faculty-facing picker is sourced from the complete active Faculty Database through a sanitized derived directory rather than from dashboard login accounts. The browser receives a display name, opaque candidate key, aliases needed for timetable matching, and binary away-from-campus availability dates. It does not receive another faculty member's UCID, email, DOE, AFC purpose/reason, or other Faculty Database fields.

The picker shows **Available** when clear. An AFC conflict shows only **Unavailable**. A timetable overlap may show the conflicting course and time because the timetable is already visible to authorized timetable users. `Sessional` and `Other` are also available; either choice requires a non-blank Reason / Note.

Normal faculty requests store only the opaque candidate key and display name. During approval, ADFA resolves that key using the admin-only mapping, reloads the live faculty and timetable data, rechecks AFC and timetable conflicts, and then applies the replacement. Approved `Sessional` / `Other` requests write that literal category/name with no Faculty UCID.

The sanitized directory is rebuilt whenever the full Faculty Dashboard derived indexes are rebuilt, and approved AFC dates are added to its binary availability projection in the same approval batch.

## Teaching-summary bulk import and recovery

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

## Passwords

The account creation form accepts a temporary password only while creating the Authentication login. It clears that value after the operation and never stores it in the dashboard database. `Send password reset` uses Firebase Authentication's standard reset-email flow. A signed-in user can change their own password on `password.html`.

If you manually create a user with a temporary password and want the dashboard to prompt for a change, check `Require password change on next dashboard sign-in` on that user's profile.

## History

The Timetable and Faculty Dashboard create `session_change_log` / `faculty_change_log` records as part of their normal save workflow. `faculty-access.js` captures the form's starting values and, after a successful save closes the editor, enriches the newest matching actor log with before/after details. The History tab merges these logs where appropriate and shows Calgary time, actor, action and before/after values when available. The base log still exists even if the enrichment step is interrupted.

Older log records remain visible but may show `Legacy entry; detailed before/after values were not recorded.` because earlier versions did not store those fields.

## Timetable editing and AFC requests

Use **Faculty Dashboard > Teaching Summary** for the highest-permission workbook replacement and synchronization tools. Timetable administrators can choose **Select Sessions**, select up to 200 writable sessions across Day, Week, Month, or List views, and review them in one spreadsheet-style editor. Saving validates every row before creating one atomic batch containing one session update and one `session_change_log` record per changed session. CCC entries remain read-only.

New AFC requests require both the off-campus contact address and telephone number from the official form. Applicant, Reports To, and administrator signatures, approval state, immutable PDF chunks, and audit records remain in Firestore. Existing approved legacy requests without these newer contact fields stay readable and approvable.

## Development checks

Install the root development dependencies with `npm ci`. Run static tests with `npm test`; run the Firestore rule suite with `npm run test:emulator`. The `test-support/` modules are pure policy fixtures used by those tests and are excluded from the web deployment bundle.

Build the Azure publishing directory with `node tools/build-static.js`. The application bundle comes from the exact allowlist in `tools/static-assets.json`; Azure deployment metadata is staged afterward. Current query counts, migration hashes, rollback exports, and the 50,000-read estimate are recorded in `PERFORMANCE_REPORT.md`.
