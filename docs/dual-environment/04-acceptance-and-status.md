# PAWS dual environment: acceptance checklist and status

## Status (2026-10-20)

| Stage | Status | Evidence |
|---|---|---|
| Implemented in source | ✅ | `feat/paws-testing-environment` on `main` @ `6addfb9`: product commits `350387d`…`709e466`, governance `1d8880a`, docs |
| Locally tested (automated) | ✅ | Web 970 pass / 1 fail / 52 skipped. Server 789 pass / 5 fail. Every failure also fails on `main` in the same Linux environment: 1 web and 5 server tests need PowerShell or Docker. The skipped tests are Firestore-emulator tests. Freeze checks: repository and built artifacts show zero drift. |
| Local live acceptance (LocalDB) | ⚠️ Not re-run since the 2026-10-20 fixes | Run `node tools/testing-db/local-acceptance.js` on Windows. The 2026-10-14 run hit a driver error in the Developer Support write path; commit `d9582d5` targets it. |
| Deployment-ready | ⚠️ Code yes, infrastructure no | `config/environments/testing.json` is empty. Owner steps are in `03-setup-and-deployment.md`. |
| Deployed to Testing | ❌ | Needs the Testing resources |
| Live acceptance passed | ❌ | Needs a deployed Testing environment |
| Authorized for Production | ❌ | Needs Owner review of the PR, including the governance commit |

## Requirement coverage

| Requirement | Where |
|---|---|
| One codebase, two deployments | `config/environments/*.json`, `tools/render-environment-config.js`, build produces both artifacts |
| Testing can't write Production | Database marker (`server/src/runtime/environment.js`), SQL allow-list, Production deny-list, separate Firebase project and cloud identity |
| Fail closed on misconfiguration | Mandatory `PAWS_ENVIRONMENT`; no defaults or fallbacks; startup and request checks |
| Top-nav switcher | `paws-environment-nav.js` on Timetable, Faculty Dashboard, Teaching Assignments, User Management, Password |
| Navigation only, no tokens in URLs | Allow-listed page path only; separate sign-in per environment |
| Test identity switching | Developer Support in Testing mode (`server/src/support/support-service.js`). Server-side, rank-limited, real actor audited, 30-minute expiry, Return to myself |
| Writable Testing | Testing deployment's own write gates; business rules unchanged |
| Synthetic data, reset | `tools/testing-db/*`; `@example.test` only |
| No notifications to real people | No sender exists; regression test guards it |
| CI/CD | `paws-testing-deploy.yml` (auto), `paws-testing-db-reset.yml`, `environment: production` on releases, optional `PAWS_REQUIRE_TESTING_PASS` / `PAWS_REQUIRE_ENVIRONMENT_IDENTITY` |

## Acceptance scenarios (run once Testing is deployed)

| | Steps | Pass when |
|---|---|---|
| **A: Enter Testing** | Sign in to Production as an operator; click **Open Testing Environment** | The Testing site opens on the same page, asks for its own sign-in, and shows the persistent **TESTING ENVIRONMENT** bar. A faculty user in Production sees no button. |
| **B: Modify test data** | In Testing, edit a synthetic faculty record or timetable session and save | The change persists after reload in Testing; the same record in Production is unchanged |
| **C: Switch identity** | **Switch Test Identity** → *Casey Mockford* (Faculty) → try an admin edit; then → *Avery Testwell* (HICC) / *Blair Sampleton* (VISC) | Faculty: admin edits get 403, own self-service works. HICC/VISC: only their own course/subject scope. The bar shows real actor, persona, role and expiry. **Return to myself** restores the operator. The audit shows the real actor on `SupportOperation`. |
| **D: Return to Production** | Click **Return to Production** | Production loads with its own API (`/api/health/runtime` → `environment: production`), with none of the Testing changes |
| **E: Code update** | Merge a small change | Testing redeploys automatically with the new `releaseSha`; Production stays on its release until the Owner approves; no data is copied |
| **F: Security** | (1) Point a Testing API at a Production SQL host or a database without the marker. (2) Edit `PAWS_ENVIRONMENT_CONFIG` or `localStorage` in the browser. (3) As an administrator, try to assume a developer persona. | (1) The API refuses to serve (`ENVIRONMENT_MISCONFIGURED`). (2) The API and database don't change; a mismatch locks the page. (3) The server rejects it. |

## Remaining blockers

1. **Owner review and merge** of the PR, including the governance freeze promotion `1d8880a`.
2. **`PAWS_ENVIRONMENT=production`** must be set on every Production API host before the next API deploy.
3. **Testing infrastructure, GitHub Environments and secrets** (`03-setup-and-deployment.md`).
4. **A second governance promotion** when `testing.json` / `production.json` get real values, because `paws-api-origin.js` changes.
5. **The branch is based on `main` @ `6addfb9` (2026-10-19).** If `main` moves again before merge, rebase and regenerate the governance commit (its anchor is a commit SHA).

## Recommended next work

1. Re-run local LocalDB acceptance on Windows (`tools/testing-db/local-acceptance.js`) to confirm the Developer Support write path after `d9582d5`.
2. Owner: Section 0 and Section 1 of the setup guide, then provision Testing (Sections 2–5).
3. Run scenarios A–F and record the results here.
4. Turn on `PAWS_REQUIRE_TESTING_PASS` and `PAWS_REQUIRE_ENVIRONMENT_IDENTITY`.
5. Owner decisions deferred from the review: require the Production `FIREBASE_PROJECT_ID` at startup (S8), and whether the legacy ACA path should verify database identity at cold start.
