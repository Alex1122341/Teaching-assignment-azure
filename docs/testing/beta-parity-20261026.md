# PAWS Beta -> Testing feature-parity integration (2026-10-26)

## Scope and source of truth

- Beta product source: `Alex1122341/Teaching-assignment-azure` `main`, commit `42622acf42558e4478a3ce3018f5357b6effdedc`.
- Existing Testing work: PR #125, branch `feat/paws-testing-environment`, previous head `e584d42b42a53f142f58ee1c932961908ec9881d`.
- Merge strategy: integrate accepted Beta `main` into the existing Testing branch. Keep PR #125's independent Testing database, Firebase identity, API supervisor, environment navigation, write gates and deployment guards. Do not merge draft PR #148 or use its unaccepted features.
- Never deploy this merge to Production or write to either Production or Testing database as part of a source-parity check.

## Code-level product feature inventory

| Area | Features inherited from Beta main | Testing code result |
|---|---|---|
| Calendar | calendar search/cancellation, filters, responsive workspace, compact navigation | Merged |
| Sessions | HICC vs HICC-CC display handling, grouped LAB blocks, session details | Merged |
| Rotations | rotation sessions in calendar and navigation | Merged |
| HICC/VISC | searchable HICC-CC and VISC directory, effective appointment dates | Merged |
| Faculty Dashboard | faculty list/details, role periods, Faculty management, lookup, availability | Merged |
| DOE | rule/policy, calculations, overrides, worksheet, downloads | Merged |
| AFC/CCC | AFC forms/records, approved leave, CCC replacement/schedule | Merged |
| Change History | exports, academic-year history, grouping, archived records | Merged |
| Custom Reports | faculty reports and report backend sources/export | Merged |
| Swap / change requests | DVM intake, approval and associated calendar presentation | Merged |
| Data and API | current Beta SQL migrations and API handlers | Merged; Testing-specific routing and independent database remain |

These are **source-code integration claims**, not proof that the features are live or that every scenario has been validated in a browser. Testing-specific modifications of the shared Business API and frontend remain subject to regression and security review.

## Source-level parity checks

- Before integration the Testing branch was behind Beta `main` by 154 commits, with 44 unique commits.
- All 24 Git merge conflicts were resolved. Main's newest functional pages and scripts take precedence; Testing's environment-switcher, generated Firebase configuration, persona support and independent runtime gates are retained.
- Main's 95 shipped static assets are retained; Testing adds `paws-environment-nav.js` as asset 96. Of the 95 Beta assets, **82 match main byte-for-byte** and 13 contain explicit Testing overlays for environment configuration, identity, support, or navigation (14 paths differ including the new nav module). The shared application service has eight distinct Testing runtime extension files; other inherited server/src modules match Beta main.
- The new `frontend/pages`, `frontend/scripts`, `frontend/styles`, and `frontend/assets` source layout is supported by Testing's renderer, build, and artifact verification tools.
- Retired personal Azure ACR/ACA deployment workflows remain removed; Testing's School Windows/SQL deployment toolchain is distinct.
- Committed Production environment rendering was aligned with the latest Beta main source origin. This temporary trycloudflare origin must still be checked against the actual running service before any deployment.

## Verified tests and builds

- `node tools/build-static.js`: 96 assets built.
- `node tools/render-environment-config.js --check`: passed.
- `node tools/verify-environment-config.js --repository`: passed.
- Testing environment/configuration, Testing DB tooling and deployment guard tests: 67 passed, 0 failed.
- **110/110 focused functional tests pass** (12 files: Calendar Search, HICC/Lab grouping, Rotation Calendar, HICC/VISC directory, Faculty Reports, Reports client, Swap approval, and History compact view).
- A separate 54-file selection was intentionally stopped after ~215 tests due repeated long-running **immutable Beta production freeze** mismatches. At least 10 history/report/availability governance assertions failed from intentional Testing overlays. This selection is **not a passing complete test run**, and the Production freeze was not weakened.
- Do not interpret source parity or focused unit tests as authenticated browser UAT.
- Reviewed two additional accepted Beta SQL migrations omitted from the previous University Testing allow-list: `058_role_appointment_rowversion_hex.sql` (role period rowversion serialization) and `059_swap_approval_read.sql` (scoped Swap approval-read projections). Both passed static scoped SQL validation and have one explicit VetMed-Ops guard each; their SHA-256 hashes and guard counts are now pinned in `tools/testing-db/university-guard-manifest.json`.
- University Testing migration/DB administration tests: **46/46 passed** after allow-list correction. Added explicit UAT scenarios for the new Beta Calendar, directory, Reports, Role Period and Swap Approval features in `fixture-coverage.json`. No SQL migrations were executed on a database.

## Blocks to actual Testing use

**Do not treat this as a live feature-complete Testing deployment.**

1. `config/environments/testing.json` still intentionally has `apiOrigin: null`, `siteUrl: null`, and `firebase: null` (the Firebase provider may be configured in the console, but site configuration is not). The Testing release tool explicitly reports `TESTING_NOT_PROVISIONED` and skips. No actual Testing site/API deployment was attempted.
2. The independent SQL database `VetMed-Ops-Testing`, migration acceptance, test identities, loopback API on 18788, TLS tunnel and authenticated browser UAT require independent operational evidence. No production database credentials or live data may be reused.
3. Beta's immutable production freeze is pinned to an accepted source commit. Testing deliberately adds an environment-navigation asset and modifies selected protected static files for isolation. **Production's freeze must never be weakened or silently regenerated to make Testing tests green.** An independently reviewed Testing overlay/freeze and scoped release acceptance are required before publishing.
4. New inherited features must be checked against the synthetic dataset. Missing Testing data/fixtures must be added without copying real faculty names, emails, UCIDs, AFC or other personal information.
5. PR #125 is kept Draft and unmerged until security/isolation gates, release artifacts and actual browser UAT are demonstrated.

## Release governance

Source parity is different from operational availability. A green build or a successful merge does not authorize a Testing deployment, and no Testing workflow should deploy to `tester-teaching` or `VetMed-Ops` Production.

## CI investigation (commit e39f900; 2026-10-26)

- GitHub Actions [PAWS Beta Build](https://github.com/Alex1122341/Teaching-assignment-azure/actions/runs/40418700851): the root `npm test` reported **1438 tests: 1333 passed, 53 failed, 52 skipped**. Failures are primarily legacy Production immutable-freeze/precise-delta assertions running in a Testing overlay checkout (for example, 95 vs 96 static assets, and exact legacy commit ancestry); these are real CI failures, not passed checks.
- [Calendar Activity SQL Acceptance](https://github.com/Alex1122341/Teaching-assignment-azure/actions/runs/40418700838) passed on the same commit.
- Release strategy: run Production freeze against its true accepted source without editing/weakening its protected hashes; separately attest the Testing overlay's authorized file differences and independent SQL/Firebase targets; run the full applicable Testing feature and security suite. **Do not relabel legacy tests as passed or deploy until the gate is implemented.**
- The configured Testing API and Firebase hosting remain unprovisioned; no connected Firebase account or independent SQL database was verified through the current GitHub-only workflow.
