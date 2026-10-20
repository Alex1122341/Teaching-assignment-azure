# PAWS dual environment: acceptance checklist

The status and evidence for each item are in `09-deployment-readiness-report.md`. This page is the checklist to run, once locally and again in the deployed Testing environment.

## Automated (every CI run)

| Area | Where |
|---|---|
| Environment identity, negative connection matrix, cross-project tokens | `server/test/dual-environment.test.js` |
| Persona route access (Production unchanged, Testing extension, import refusal, undo refusal, forged context) | `server/test/testing-persona-routes.test.js`, `server/test/dual-environment.test.js` |
| Frontend configuration, artifact guards, switcher, banner wording, expiry cue | `tests/dual-environment-config.test.js` |
| Testing API environment, write-gate matrix, preflight, release evidence, reset authorization | `tests/testing-deployment-readiness.test.js` |
| Reset tool, seed determinism, fixture coverage | `tests/testing-db-tooling.test.js` |
| Freeze (repository + both artifacts) | `tools/beta-freeze.js`, `tools/beta-api-freeze.js`, `tests/beta-baseline.test.js` |

## Local live acceptance (Windows + LocalDB)

`node tools/testing-db/local-acceptance.js`. Set `PAWS_LOCAL_ACCEPTANCE_TESTING_INSTANCE` / `PAWS_LOCAL_ACCEPTANCE_PRODUCTION_INSTANCE` if your default LocalDB instances already hold a `VetMed-Ops` database of your own; the script never drops one it did not create. It runs the real API against two separate SQL Server instances and covers scenarios A–H and P below, except the browser-only steps.

## Deployed Testing (manual, by ADFAD testers and the Owner)

| | Steps | Pass when |
|---|---|---|
| **A: Enter Testing** | Sign in to Production as an ADFAD operator; click **Open Testing Environment** | The Testing site opens on the same page, asks for a separate sign-in, and shows **TESTING ENVIRONMENT — SYNTHETIC DATA ONLY**. A Faculty user in Production sees no button. |
| **B: Data isolation** | In Testing, edit a synthetic faculty record and a timetable session; reload | The changes persist in Testing; the same records in Production are unchanged |
| **C: Role testing** | **Switch Test Identity** → *Casey Mockford* (Faculty), then *Avery Testwell* (HICC), then *Blair Sampleton* (VISC). Try an admin edit, the timetable, Teaching Assignments, Calendar Activities, AFC Forms, Change History | Faculty: admin edits refused, own data only. HICC/VISC: own scope only. The bar shows the real operator, persona, effective role and end time. The audit shows the real operator. **Return to myself** restores the operator. |
| **C2: Expiry** | Wait 30 minutes with a persona active (or ask the Owner to shorten a test context) | The bar shows **Test identity session expired**; actions fail until Return to myself |
| **D: Return to Production** | **Return to Production** | Production loads, asks for its own sign-in, `/api/health/runtime` reports `production`; no Testing data or token carried over |
| **E: Deployment consistency** | Merge a small change | *PAWS Testing Deploy* reports the new SHA; Production stays on its release until a separately approved release |
| **F: Security failures** | (1) Point the Testing app at a Production SQL host or an unmarked database. (2) Edit `PAWS_ENVIRONMENT_CONFIG` / `localStorage` in the browser. (3) Forge an `X-PAWS-Support-Context`. (4) As an administrator, try a developer persona. (5) Dispatch a reset or approval as an unlisted user. (6) Use a Testing token against Production. | (1) The API refuses to serve. (2) API and data unchanged; a mismatch locks the page. (3)–(6) Refused. |
| **G: Full Admin workflows** | Create/read/update/delete, approval, import, report and export across Timetable, Faculty Dashboard, DOE, Teaching Assignments (draft → review → final → publish), AFC (records, requests, decisions, forms), Swaps, Calendar/CCC imports, Change History, Tasks, using the fixtures in `tools/testing-db/fixture-coverage.json` | Each action behaves as in Production, persists after reload and stays in Testing |
| **H: Reset** | After UAT, **PAWS Testing Database Reset** | Fixture counts and personas restored; UAT edits gone; reset evidence recorded |
| **P: Performance smoke** | Local acceptance (automated) plus normal page use in Testing | Thresholds in the readiness report; record anything slower than Production |

Record results (date, tester, commit SHA, pass/fail per scenario, issue links) in the UAT record named in the **PAWS Release Approval** run.
