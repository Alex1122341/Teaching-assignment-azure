# PAWS dual environment: deployment readiness report (2026-10-20)

Repository `Alex1122341/Teaching-assignment-azure`, PR #125, branch `feat/paws-testing-environment`, merged with `main` @ `15dd739`. Product anchor `413e87f`, governance `cd7f0a6`, branch tip is the latest commit on the branch (see `git log 15dd739..HEAD`).

## Readiness decision

| Status | Reached? | Evidence / reason |
|---|---|---|
| **CODE_READY** | **Yes, for Owner review** | All planned code, tests and docs are committed. Automated suites show only environment-dependent failures, which also fail on `main` (below). Real-SQL acceptance on LocalDB: 44/44. Owner review of the PR and the separate governance commit is still required. |
| INFRASTRUCTURE_READY | No | No Testing Firebase project, Azure SQL, Container App, registry, identities or GitHub variables exist. `node tools/testing-preflight.js` reports 3 failed checks (firebase, siteUrl, apiOrigin). |
| DEPLOYMENT_READY | No | Depends on the infrastructure, plus `PAWS_ENVIRONMENT=production` on the Production API hosts (`03` §0). |
| TESTING_DEPLOYED | No | Never deployed. |
| UAT_READY | No | Needs a deployed Testing environment. |
| PRODUCTION_RELEASE_READY | No | Needs formal UAT and approvals. |

## Complete / partial / blocked / failed

| Item | State |
|---|---|
| Phase 1 inspection (`05`) | Complete |
| Blocker A: configuration validation, template, preflight, Testing API env validator | Complete; the real values are blocked on infrastructure |
| Blocker B: database isolation (Azure SQL/LocalDB-only Testing host, deny-list, marker, negative matrix, reset guard) | Complete; verified in unit tests and on two LocalDB instances |
| Blocker C: Production compatibility (hosts audited, prechecks, rollout, rollback, verification) | Complete as documentation (`03` §0); the change on the hosts is an Owner action |
| Frontend parity (one source tree, artifact differs only in `paws-api-origin.js`) | Complete (artifact guard + freeze). Headless render of 5 pages at 1366/390 px: the bar is in the page flow, overlaps no control and adds no horizontal scroll. `faculty-admin.html` at 390 px already scrolls horizontally in Production. **Partial:** the signed-in pages could not be rendered here, because Firebase cannot load in this sandbox; before sign-in, the auth gate dims the bar. |
| Write-gate matrix + independent Testing gates (`07`) | Complete; Production gates unchanged |
| Persona coverage for newer APIs (Testing only) | Complete; tests and LocalDB |
| Synthetic data + workflow fixtures + coverage matrix | Complete for seeded items (`fixture-coverage.json`). **Partial:** DOE policy Draft/publish/recalculate, Calendar/CCC imports, AFC form upload, Scheduling Tasks and TA final/publish are "uat-created" (no pre-made fixture). |
| CI/CD provenance, release evidence, approval alternative, reset authorization | Complete in source. **Not run on GitHub** (workflows can't run before merge and infrastructure). |
| Performance smoke | Complete on LocalDB (below). **Finding:** concurrent session edits. Not a Production-scale test. |

## Test commands and results

| Run | Commit | Command | Result |
|---|---|---|---|
| Linux container, root | `5ac8aaf` | `node --test tests/*.test.js` | 1048 tests: 995 pass, **1 fail**, 52 skipped. The failure is a PowerShell recovery test (no PowerShell); it also fails on `main` here. The skips are emulator tests. |
| Linux container, server | `5ac8aaf` | `cd server && node --test test/*.test.js` | 824 tests: 814 pass, **5 fail**, 5 skipped. The 5 failures need PowerShell or Docker and also fail on `main` here. |
| Linux, freeze | `5ac8aaf` | `node tools/beta-freeze.js`, `beta-api-freeze.js`, both `--artifact`, `verify-beta-candidate.js` | ok, zero drift; static 82, API 105 |
| Windows laptop, server | `960957d` | `npm test` (with the root suite running in parallel) | 824 tests: 812 pass, 8 fail, 4 skipped. Failures: 3 need Docker; 5 Calendar/CCC workbook tests hit `IMPORT_PARSE_TIMEOUT` under load. The same two files pass 33/33 when run alone, on both this branch and `main`. |
| Windows laptop, root | `1a6060c` | `node --test tests/*.test.js` | see the "Windows root" line in the hand-off message (run in progress when this report was written) |
| Windows laptop, LocalDB acceptance | `45d10f1` | `node tools/testing-db/local-acceptance.js` (instances `PAWSTestSim`, `PAWSProdSim2`) | **44/44 pass** (`evidence/local-acceptance-20261020.json`) |
| GitHub Actions on PR #125 | — | — | **Not observable from this session** (no GitHub API access to the private repository). The Owner must check the PR's Checks tab. |

## Evidence of isolated database behaviour (LocalDB, real API and SQL Server)

- A Production runtime refuses the Testing database. A Testing runtime refuses the Production stand-in (no marker), a Testing database with another id, the Production SQL name, the Production Firebase project, and a missing `PAWS_ENVIRONMENT`.
- An edit in Testing is not visible in Production. Production keeps its own (closed) gates. The Production database fingerprint is unchanged after all Testing activity.
- Personas: rank-limited, real actor kept on `SupportOperation`, ended and expired contexts rejected, faculty scope enforced, newer workflows readable in Testing, import writes refused, Production Developer Support unchanged.
- Reset: UAT edits and support operations discarded; 5 AFC requests in all 5 states, personas and the marker restored.

## Performance smoke (synthetic data, laptop LocalDB; thresholds in `tools/testing-db/local-acceptance.js`)

| Check | Threshold | Result |
|---|---|---|
| Full-year timetable read, 20 sequential | p95 < 3000 ms | p95 174 ms |
| 10 concurrent Dashboard summaries | all 200, p95 < 5000 ms | all 200, p95 66 ms |
| 5 concurrent edits of different sessions | each commits or fails cleanly, no partial write | **2/5 committed**, 3 × `503 SQL_UNAVAILABLE`, persisted = committed |

**Finding (pre-existing, Owner decision):** concurrent writers to the timetable can be refused with `503 SQL_UNAVAILABLE`. The failures are clean and nothing is left half-written. This PR does not change the session write code (`data-api.js`, `sql-session-repository.js`) and changes nothing on the non-persona path. The behaviour is consistent with the SERIALIZABLE request transaction refusing concurrent writers, but that was not confirmed against `main`. Changing it would change business write behaviour, which this PR is not allowed to do. Production-like load would need a synthetic load plan: N concurrent ADFAD sessions against a reset Testing database, measuring 409/503 rates and p95 per route.

## Outstanding infrastructure dependencies and Owner decisions

1. Approve and provision the Testing resources and their costs (`03` A, §2).
2. Set GitHub variables and secrets (`03` §1, §3). Decide on the GitHub plan: Free means no branch protection, so the evidence gate is detective only; Pro makes it enforceable.
3. Add `PAWS_ENVIRONMENT=production` to the University API launcher (re-hash in `recovery-config.json`) and to the legacy ACA app before any API release from this branch.
4. Review the governance promotion `cd7f0a6` (anchor `413e87f`). A later PR that fills `testing.json` and `production.json` `peerSiteUrl` needs its own promotion.
5. Decide whether pre-merge candidate commits should be deployable to Testing. Today Testing deploys only `main`, which can already run ahead of Production.
6. Decide on concurrent-edit behaviour (above) and on the pre-existing Developer Support undo gap for `SwapCalendarActivitySnapshot`.
7. After deployment: run `testing-preflight.js --live`, scenarios A–H, record the UAT outcome in **PAWS Release Approval**, then turn on `PAWS_REQUIRE_TESTING_PASS`, `PAWS_REQUIRE_RELEASE_APPROVAL` and `PAWS_REQUIRE_ENVIRONMENT_IDENTITY`.
