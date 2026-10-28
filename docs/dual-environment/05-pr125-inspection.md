# PR #125 inspection (Phase 1), 2026-10-20

Scope: `Alex1122341/Teaching-assignment-azure`, PR #125, branch `feat/paws-testing-environment`.

- PR head inspected: `ee5fd11` (based on `main` @ `6addfb9`).
- `main` at inspection: `15dd739` (PR #126 Dashboard History grouping, PR #127 Firebase live-gate release checks). That is 18 commits and 19 files ahead of the PR base.
- Overlap with the PR: `firebase-hosting-deploy.yml` (merged cleanly) and the five governance files. The governance files are resolved to main's anchor in merge commit `fcb61b1`. A new reviewed promotion re-anchors the merged product (see `06-…` and the governance commit).
- After the merge, the PR changes 65 files against `main`. The diff of the last 70-file version covered the same paths plus files now identical to main.

## What is already implemented correctly (reuse)

| Area | Evidence |
|---|---|
| One source tree, two renderings | `config/environments/*.json` → `tools/render-environment-config.js` → `paws-api-origin.js`. Production artifact unchanged except the rendering; the Testing artifact differs in that one file (`tests/dual-environment-config.test.js`). |
| Mandatory runtime environment | `server/src/runtime/environment.js`: no default, Production/Testing exclusive switches, Testing SQL allow-list, single-host parsing, loopback refusal, Production deny-list (`ITAPPVETOPSDB01`, legacy Azure lab). |
| Database identity marker | `paws_env.EnvironmentIdentity`. Testing requires the exact marker. Production refuses a Testing-marked database before listening (`university-api.js` `verifyBeforeListening`). |
| Cross-environment tokens | `createFirebaseSqlAuth` rejects any token whose `aud`/`iss` is not the runtime's `FIREBASE_PROJECT_ID`. Testing refuses the Production project id. |
| Personas | Reuses Developer Support (`support-service.js`): server-side context, rank ceiling, real actor in `SupportOperation` and `AuditEvent`, 30-minute expiry, Return to myself. Operator personas are switch-only (no shared password). |
| Reset | `tools/testing-db/reset-testing-db.js`: marker-or-provably-empty, `--confirm-reset`, never touches Production, re-seeds deterministically. |
| CI | Testing artifact built from the same commit; Testing deploy uses the tested API artifact and checks provenance; Production release paths have opt-in `PAWS_REQUIRE_ENVIRONMENT_IDENTITY` / `PAWS_REQUIRE_TESTING_PASS`. |

## Incomplete or must be fixed before deployment

| # | Finding | Severity | Fix in this PR |
|---|---|---|---|
| I1 | **Testing persona route allow-list is the 2026-10 Developer Support list.** It omits Calendar Activities, Calendar Activity imports, AFC Forms, CCC Replacement, Change History and Scheduling Tasks. Every page sends the support header (`paws-data-client.js`), so those pages fail with `SUPPORT_ROUTE_DENIED` while a persona is active. | High (UAT blocker) | Testing-only extension, route by route (see `07-write-gate-and-persona-matrix.md`). Production list unchanged. |
| I2 | **Support undo is only safe for tables captured by migrations 033–035.** Tables added later (Calendar 038–039, Scheduling 043, History 047, AFC forms 048/050, CCC 049, MASTER 052/054) have no capture trigger. An undo of an operation that wrote them would restore only part of it. | High (for the extension) | Operations on the newly allowed routes are recorded and audited, but marked non-undoable; the server refuses to undo them. In Testing, a reset restores them. |
| I3 | **Import routes run on a second SQL pool** (`calendarImportDb`: Calendar import stage/preview/commit and all CCC replacement writes). They would commit outside the support transaction, so a failed audit insert could lose the actor link. | High | Persona writes to these routes are refused ("run imports as yourself"); reads are allowed. |
| I4 | **The `PAWS_REQUIRE_TESTING_PASS` check trusts any successful run of the workflow path that uploaded an artifact named for the SHA.** A `workflow_dispatch` from another branch with an edited workflow file would satisfy it. It does not check the deploy job's own result or the evidence content. The ACA Production path has no Testing-pass check at all. | High (governance) | `tools/verify-testing-pass.js`: workflow definition from `main`, deploy job `success`, evidence file content (`environment`, `commitSha`, `status`), and the source build of the same SHA. Used by the Firebase and ACA Production workflows. |
| I5 | **The setup guide relies on GitHub Environment Required Reviewers.** The repository is private and owned by a personal account (`Alex1122341`, `type: User`; unauthenticated API returns 404). GitHub offers required reviewers on private repositories only with GitHub Enterprise. On GitHub Free, private-repository environments and branch protection are not available at all. | High (governance) | Enforceable alternative: `PAWS Release Approval` workflow plus an owner-managed approver list, checked by Production releases when `PAWS_REQUIRE_RELEASE_APPROVAL=true`. The guide is rewritten for Free and Pro plans. |
| I6 | **Testing configuration validation** accepts placeholder-shaped values, other-environment hosts on another port, and Testing hosts under the Production Firebase domains. There is no single command that tells the Owner what is missing. | Medium | Stricter validation, a committed template, and `tools/testing-preflight.js` (offline, plus optional live probes) with an exact next step per missing item. |
| I7 | **The Testing API environment is validated only for `PAWS_ENVIRONMENT` and the SQL server name** at deploy time. Write gates, CORS origin, Firebase project and the bind settings are not checked. | Medium | `tools/verify-testing-api-env.js` validates the Container App environment, which the deploy runs before activating a revision. A reviewed template is committed (`deploy/testing/testing-api.env.template`). |
| I8 | **Testing SQL may be any non-production host.** An IP address or an on-premises name would pass if listed in `PAWS_TESTING_SQL_SERVER`. | Medium | Testing accepts only an Azure SQL host (`*.database.windows.net`) or a LocalDB instance. |
| I9 | **No expiry cue.** When a persona session expires, API calls fail with `SUPPORT_CONTEXT_EXPIRED`, but the banner keeps showing the persona. | Medium | The banner switches to "Test identity expired" with Return to myself, both on the timer and on the server's expiry error. |
| I10 | **The banner label** is "TESTING ENVIRONMENT"; the required wording is "TESTING ENVIRONMENT — SYNTHETIC DATA ONLY". | Low | Testing rendering label changed (Testing artifact only). |
| I11 | **Synthetic data** covers only drafts: 2 TA packages in `draft`, no AFC requests, no swaps, no scheduling tasks, no calendar activities, one academic year, no expired or future roles. | Medium (UAT coverage) | `tools/testing-db/seed-workflows.sql` (post-migration fixture) plus `fixture-coverage.json`, verified by the reset tool and a static test. See the fixture section of the readiness report for what still needs a live run. |
| I12 | **Testing can deploy only commits already on `main`.** That is enough for "Testing ahead of Production", because Production is released separately. Pre-merge candidate UAT is not supported. | Info | Documented as an Owner decision; not changed. |
| I13 | **The swap apply route** (already allowed in Developer Support) writes `paws.SwapCalendarActivitySnapshot` (039), which has no capture trigger. This is a pre-existing Developer Support undo gap. | Info (pre-existing) | Reported. Not changed in this PR, because it is Production behaviour. |

## Requires infrastructure or Owner action

- Testing Firebase project and Hosting site, Testing Azure SQL server and database, Container App, registry, managed identities, OIDC credential, GitHub variables and secrets. None exist yet: `config/environments/testing.json` has `null` for `apiOrigin`, `siteUrl` and `firebase`, and CI skips the Testing artifact.
- `PAWS_ENVIRONMENT=production` on the University API launcher (the launcher script lives outside the repository on the school server, and its hash is pinned in `recovery-config.json`) and on any legacy ACA app, **before** the first API release that contains this PR.
- GitHub plan decision (Free vs Pro) for environments and branch protection.
- Merge of PR #125 and the separately reviewed governance promotion.

## Not observable from this session

- GitHub Actions results for PR #125: this session has no GitHub API access to the private repository. The Owner must read them on the PR's Checks tab.
- Live Production state: the deployed API version and gates were not queried, and no Production endpoint was called.
