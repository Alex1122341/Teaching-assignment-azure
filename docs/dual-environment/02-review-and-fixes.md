# PAWS dual environment: independent review and fixes

Review date: 2026-10-20. It covers the original feature commit (`11a14fc` on `0d4b4d9`) plus the uncommitted LocalDB fixes from the author's machine. The work was then rebased onto `main` @ `6addfb9` as branch `feat/paws-testing-environment`; the commit IDs below are the rebased ones (feature commit `350387d`). The review was read-only and security-focused. Every fix below is its own commit on the branch, with tests.

**Overall result:** the review found no path by which a Testing API can write to the Production database. Every route traced fails closed, mainly because of the database identity marker (`paws_env.EnvironmentIdentity`). The problems it did find either broke the Testing pipeline itself or were hardening and governance gaps.

## Blockers (fixed)

| # | Problem | Fix | Commit |
|---|---|---|---|
| B1 | **Every provisioned Testing build would fail its own guard.** The Testing build legitimately names the Production site (`peerSiteUrl`, used by "Return to Production"), and the artifact guard rejected any file containing the Production project id `tester-teaching`. | Skip the substring scan for `paws-api-origin.js`, which is already proven byte-identical to the environment's own rendering. Pair validation also rejects a shared Firebase API key or auth domain. A test builds a fully provisioned Testing artifact. | `293eada` |
| B2 | **The release-freeze baseline wasn't promoted, so CI was red** (5 freeze tests). | A separate governance commit, `1d8880a`, moves the anchor to the product tip `709e466`. See `docs/dual-environment-freeze-promotion-20261020.md`. | `1d8880a` |
| B3 | **Testing would never serve on Azure SQL.** The reset tool created the marker table but never let the runtime principal read it. SQL Server hides objects a principal can't access, so the runtime saw no marker and refused to serve. | `GRANT SELECT ON OBJECT::paws_env.EnvironmentIdentity` to the runtime principal, and nothing else on that table. | `293eada` |

## Should-fix

| # | Problem | Status |
|---|---|---|
| S1 | **The Testing SQL deny-list could be bypassed** with duplicate `Server=` keys, loopback names or IP addresses. | **Fixed (`625ef4e`).** Testing requires `PAWS_TESTING_SQL_SERVER`, and the connection string must name exactly that host, exactly once. Loopback names are refused, and the setting is invalid in Production. |
| S2 | **The reset tool's local-ODBC override could name any server.** | **Fixed (`293eada`).** The override must itself be a LocalDB instance or named pipe. |
| S3 | **"Empty database" relied on metadata visibility**, so a low-privilege principal could see a populated database as empty. | **Fixed (`293eada`).** Emptiness is only trusted with `VIEW DEFINITION`, all user objects and schemas are counted, and first-time setup needs an explicit `--initialise-empty` (also a workflow input). |
| S4 | **One shared password signed straight in as developer or owner.** | **Fixed (`8049ac2`).** Developer, owner, administrator and ADFA General personas get no password sign-in. Operators reach them only through Switch Test Identity. |
| S5 | **The Production release accepted a health response with no `environment` field.** | **Fixed, switchable (`625ef4e`).** Repository variable `PAWS_REQUIRE_ENVIRONMENT_IDENTITY=true` makes it strict. It is off by default, because the Production API reports the field only after it is redeployed. |
| S6 | **The Testing API image was rebuilt from source** instead of being the tested artifact. | **Fixed (`625ef4e`).** The image is built from the CI-built, freeze-verified API artifact of the same commit. |
| S7 | **The approval gate depends on GitHub settings outside the repo.** | **Documented** in `03-setup-and-deployment.md`: create the Environments, add required reviewers, and scope the Testing OIDC subject. | *(Superseded 2026-10-20 by release evidence; see `03` §1.)*
| S8 | **Production identity checks were one-sided.** | **Partly fixed.** The legacy ACA release now stops before activation if the app lacks `PAWS_ENVIRONMENT=production` (`625ef4e`). Two items are deferred for the owner: requiring the Production `FIREBASE_PROJECT_ID`, which would break existing configurations whose value we can't confirm, and a per-request Production identity check, which would break the rule that anonymous requests never reach SQL. |
| S9 | **Production exited if SQL was down at boot.** | **Fixed (`625ef4e`).** Start-up retries with capped exponential backoff (1 s up to 60 s). A wrong environment still stops the process. |
| S10 | **The Testing deploy went red on every `main` push** until Testing existed. | **Fixed (`625ef4e`).** A gate job skips quietly. A manual dispatch still fails loudly. |

## Found while rebasing onto `main` @ `6addfb9`

| Problem | Fix | Commit |
|---|---|---|
| `main` retired Azure SWA static hosting and deleted `staticwebapp.config.json`, but the Testing build still copied it, so the first provisioned Testing build would have crashed. | The Testing artifact ships exactly the static manifest. An end-to-end test builds a fully provisioned Testing artifact. | `709e466` |
| Five runtime tests added on `main` start the real runtime without `PAWS_ENVIRONMENT`. | Their setup declares `PAWS_ENVIRONMENT=production`. | `4d692ab` |
| `main` moved the Production API to a new Cloudflare origin. | `config/environments/production.json` carries the new origin, and `paws-api-origin.js` is regenerated from it. | `350387d` |

## Notes acted on

| # | Note | Change |
|---|---|---|
| N3 | The support operation id was converted with `TRY_CONVERT`, so a malformed id would silently skip change capture. | Switched to `CONVERT`, so a malformed id fails the write. Tests pin the session-context SQL (`8049ac2`). |
| N6 | Nothing stops Testing from sending notifications in the future. | A regression test fails if the API gains an email/SMS/webhook sender or dependency (`8049ac2`). The only email path is the browser's Firebase password reset in the *Testing* project, which reaches only Testing accounts. |
| N7 | Local acceptance dropped `VetMed-Ops` on LocalDB without checking it first. | It now refuses to drop a database it didn't create (`293eada`). |

## Notes accepted as designed

- **N1:** persona rank checks are enforced server-side on every request, including inside the write transaction. There is no escalation path.
- **N2:** Production Developer Support logic is equivalent. The only differences are role matching that trims and lowercases, and extra fields in `/me` and health responses.
- **N5:** Production's identity is "no Testing marker visible". This is acceptable because Testing is the side that has to prove its identity.
- **N8:** business audit rows record the persona. The real actor is kept in `SupportOperation` and the `developer_support_operation` audit event, which is the existing Developer Support design.
