# PR140 release preparation — 2026-10-24

## Current restart recovery candidate

RDC and the existing API are recovered: API main8bb/trust58, SQL healthok and27 unchanged gates. Existing admin-owned output files remain untouched; new owned PID/log paths are recorded with before/atomic recovery backups, without ACL changes. New public HTTPS origin gibson-strand-telecharger-governor.trycloudflare.com passes runtime/gates checks. Product486ea03 changes only paws-api-origin.js relative to884; separate governancebb424dd protects91static/115API+3inputs. Focused58/governance5, combined build/all4freezes and supplemental independent repo review pass. Faculty/admin normal login, Calendar home, own/other403 and Dashboard/Assignments reads pass through the private GET-only bridge. No actual Hosting publication yet: original recovery PublishedOrigin intentionally stays aligned with the old served frontend until deployment. Earlier product/CI/artifact receipts below are historical; final exact-head checks and actual served-origin smoke are required. See the new Saturday runtime recovery update for precise server operations and remaining unattended-recovery limits.

## Current supplemental candidate

Continued browser acceptance found and corrected the displayed-name aggregate search mismatch in Teaching Summary/Roles. Current product is fcc36231cd0b0c02a2b9b0871ffdf64fcc0e8788; separate governance8133ecdffe3ec9f8c16d06ecc211ea8fa8925b4b. The older product/CI/artifact receipts below are historical. Fresh candidate verification is recorded in the supplemental agent update and the PR; do not publish an older artifact. The correction changes only two predicates, keeps every API/SQL/rule/dependency byte identical to main8bb, and retains91static/115API protection. Focused57/57 and governance4/4 pass; real browser search/filter acceptance at1280/390 passes; independent supplemental review has no actionable findings. Current server RDC remains offline and API DNS returns NXDOMAIN, so actual live recovery/role acceptance and release remain blocked.

## Identity and scope

| Item | Verified value |
|---|---|
| Repository | Alex1122341/Teaching-assignment-azure, controlled Beta |
| Main | 8bb40c60370bcce3d0135efd4327d42fba657903 |
| PR | https://github.com/Alex1122341/Teaching-assignment-azure/pull/140, targets main |
| Corrected product | a6c5092020cfda4c87873591b3c8d5edbeba5e72 |
| Separate governance | 4de4a3ef55bfe2ddad03d8b985e8c618238c09c0 |
| Test-only corrections | 7b2c7fc and f42e01d; no runtime/freeze change |
| Static/API protection | 91 static, 115 API runtime + 3 build/dependency inputs |

This candidate integrates PR136/139 while retaining main's Role/Appointment frontend, API and SQL fixes. All API, SQL, Firestore rule/index, dependency and write-gate source files match main. No production data changes, migration, merge or deployment performed. PR125 remains unrelated. Preserve PR136/139 history; do not independently merge their older freeze promotions over this integrated candidate.

## Available verification

- Product/office/main/auth/assets focused suite:216 passed,0 failed.
- Remaining legacy Auth/module-graph/budget test contracts corrected; dedicated suite54 passed,0 failed.
- Final isolated local Node22 server suite:859 tests,855 passed,0 failed,4 skipped,exit0. Exact locked server dependencies restored; no dependency source changes.
- Sequential combined build and all four source/artifact freezes pass. Actual package has91 app assets,115 protected API runtime files and one generated artifact-inventory.json (207 files total). Do not mislabel the generated inventory as a new API runtime dependency.
- Independent whole-branch review found2Important; one real-source RED→GREEN fix pass resolves stale identity responses and populated dark contrast. No Critical/Minor findings. See office-workspace-review-20261024.md.
- Real Faculty/admin read acceptance and four-width synthetic browser evidence: office-workspace-acceptance-20261024.md and ../ui-evidence/office/. Faculty cross-record/admin requests403; anonymous401; no writes.
- Automatic run40102576801 for f42e01ded833b2b810a74bfd986a15d17097baa1 **succeeded**: root1103pass/0fail/52skip, server854/0/5, emulator1136/0/19, supplemental62/0/0; build/container/all four freezes passed. Checkout was GitHub's merge refcbaf700c00bf354e97f95febaa28f31f1d7aed2f. Its Git tree is identical to the PR HEAD (`2e01d5674db647c5671ce60ea7db39d953822ce8`); preserve this distinction instead of calling the merge commit the source HEAD. Artifact12562494826 ZIP digest82965026649ce8b0645a9182fafc7e44cf68975d07694342fa6d6578be8a573a was downloaded and verified, then passed local91static/115API artifact freezes. A later documentation-only HEAD requires its own checks. Machine-readable evidence: ../ui-evidence/office/release-verification.json.

Local broad runs attempted concurrently shared `.azure-production` through the existing deterministic artifact test and collided. Server worker deadlines were also hit under that oversubscription. Those runs are rejected, not passing evidence. The isolated server and sequential build/freezes above supersede those portions; completed exact-head CI supplies the full root/emulator gate. Never add a freeze exception or extend production parser timeouts to hide local test load.

## Live state and blockers

Fresh public Hosting reads verified87/87 current files against immutable main8bb Git blobs. An exact raw-byte rollback copy was downloaded only after each file matched that source. Private path: `C:\Users\xinyu.zhu1\PAWS-DOE-Preview\office-live-main-rollback-20261024\app`; adjacent manifest records SHA-256 and observation time. This is a generated recovery artifact, not another editable frontend source. Authenticated Hosting release ID is unavailable while server tooling is offline; no historical release ID is reused.

The temporary API origin `cultures-please-skirt-tba.trycloudflare.com` currently returns NXDOMAIN. ITAPPVETOPSDB01's RDC is offline. Earlier real-role acceptance was successful before this outage; it is not current service-availability proof. The last read-only server receipt was API main8bb/trust58daab3 with27 gates. Current gates, runtime files and recovery health must be re-read after reconnection. Do not presume they remain unchanged.

Native200% zoom remains unverified through the connected browser. Narrow reflow, dark contrast, keyboard Escape/focus and native History resize were checked. Every populated lazy business tab is not visually certified. These limits are explicit; no full visual or WCAG certification is claimed.

## Resume and release sequence

1. Restore RDC to the existing school server and inspect `P:\PAWS\Runtime\Recovery\recovery-config.json` plus existing recovery scripts. Validate the configured API source/port and run their read-only health/check path first. Do not rerun SQL058 or any data migration.
2. Restore the existing API/HTTPS ingress using the current recovery workflow; preserve runtime dependencies,27 observed write-gate values, authorization/audits and the database. If the temporary hostname changes, update the repository origin through a new product commit and separate immutable promotion, rebuild/retest, and repeat real authentication/scope acceptance. Never patch a published artifact or CORS ad hoc.
3. Recheck main and PR140 exact HEAD, required checks, trusted artifact provenance and every protected byte. Capture the current authenticated Hosting release metadata, existing recovery configuration and raw-file rollback evidence. If main advanced, preserve its changes and repeat integration/governance checks.
4. Obtain the UI initiative's explicit merge/publication direction; reaching the standard and having a candidate are not a deployment. Merge only the accepted integrated candidate. Verify the resulting exact-main checks or the owner-approved exact-main equivalent.
5. Build/publish the same verified generated static artifact with **Hosting only**, project tester-teaching. Do not deploy Firestore rules/indexes/Functions, a raw source tree, a second frontend copy or retired Azure infrastructure. No backend/SQL mutation is needed for these UI source changes; confirm compatibility against the running API's exact protected files before publication.
6. Verify every served candidate file against its approved raw hashes; perform normal Faculty/admin sign-in, Calendar home, own/other403, Dashboard and Assignments smoke checks on the actual published origin. Read live runtime health/gates again and compare. Claim live only after those checks pass.

## Rollback

Before publication, the approved current-main87 bundle and raw hashes must still match the captured live release. If new UI validation fails, restore that verified generated static bundle through the existing Hosting-only release procedure, then verify87/87 served bytes and real login. Keep API configuration/data unchanged unless a separately recorded recovery change was necessary; any such configuration restore uses its captured prior value. Do not use the89-asset synthetic before screenshot fixture as a production rollback package. No SQL restore/reimport is part of this presentation rollback.
