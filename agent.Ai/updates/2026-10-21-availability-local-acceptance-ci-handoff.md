# Agent Update — Faculty Availability local acceptance complete

**Date:** 2026-10-21 (America/Edmonton)  
**Repository:** Alex1122341/Teaching-assignment-azure  
**Task status:** LOCAL ACCEPTANCE COMPLETE; RELEASE BLOCKED

## Goal and starting breakpoint

Continue existing Draft PR124 final acceptance. Main advanced during work through separate History PRs126/128/129; latest fetched main33c4e9f4506e4632e673c2e8a462bc9987ce7e51 is live. Worktree startup-recovery-20261017, branch feature/faculty-availability-single-20261020. Earlier candidate2731631 was accepted before PR129; it must not overwrite newer History.

## Product and governance

Integrated product370c30a21d99ae7227f97f1e0cb781864c674768: all12 Availability static/API/SQL files match independently accepted23e35c8 exactly; other protected runtime and Hosting match latest main33c4e9f. Independent product READY,85 affected tests pass. Separate governance09e5c122c88e819070017837daf048f852fa95a3 plus exact historical receipt restorationad2493629420fe66e107f95a75c222e3457f60f4 is independently READY. Protected union remains193 paths,247 current/historical Git-blob hashes and7 mutation/enforcement checks passed. Four lost historical assertions were restored unchanged from273; no runtime fix was necessary.

## Live operations performed

- SQL056 applied exactly once at2026-10-21T02:41:48.2179706Z under reviewed private script9648AC8C381BDD15AAAF2D2665F45164CBB019F1C0E9D7F961CC64BD283C1C08.
- Installed definition SHA25619DFE7553D354A004CBBEBD6AF311D3D269C56CC4AAB7839359AC2887228E1DE retained immediately. All106 business tables with original columns/fingerprints/counts, original schema, existing grants/memberships and27 gates unchanged; only new read proc and intended read-role EXECUTE added.
- Earlier PS5.1 preflight array count issue stopped before SQLCMD. Corrected count cross-check preserved; both attempts retained.
- Attested old273 server105 source files staged on University loopback127.0.0.1:18793, not production. Anonymous and invalid-token401, SQL healthy, gates match live. This stage contains older History; do not cut over.
- Actual Node repository parsed SQL responseJson; full pagination241 teaching matched canonical source. Further samples143 work across2026/2027,37 AFC across2025/2026 and5 effective role periods. Existing SQL Faculty actor own permitted/cross denied55603. SQL actor tests are not authenticated API acceptance.
- Fresh live API33c4e9f/anchora3317b1 and SQL healthy. No production cutover, Hosting deployment, merge, account change, DOE publication/recalculation, business DML or gate operation.

## Local verification

- npm test:1016 total,964 pass,52 skip,0 fail; root log includes overnight/sleep wall time.
- Exact restored historical receipt regression:1/1 pass.
- npm test --prefix server:802 total,798 pass,4 skip,0 fail.
- npm run test:emulator on demo-ucvm-access:1016 total,997 pass,19 skip,0 fail, script exit0. Includes restored assertions.
- Combined build, static artifact freeze and API artifact freeze pass.
- Current local ZIPad24936 SHA2566fe1dbac84852bad0d3f751ba2027b71a59b4e915fc60dbc311549c9f524ed91,191 files individually verified;83 static,107 API runtime plus inventory;105 University sources separately checked. Inventory digestebb52ea2700bc0455911067397f1c2c9ad46ef1d22a7cca1268f14043c67ebce. Local review-only bundle is not a CI artifact.
- Prior273 CI39533088104 artifact12316715457 remains prior-head evidence. Current09e5 build39535532305 and four SQL workflows never started any steps; GitHub annotations explicitly report account payment/spending limit. Do not mark these as product-test failures or passes.

## Progress workbook and report

Original progress workbook updated only task39/MP-REL-01 evidence/date fields:12 cells and2 fitted row heights. Native ZIP parts outside two worksheets, all unrelated cells/formulas/statuses and human signoffs remain identical. Final workbook SHA2566a5ced3d8e4dfd996baea554804f06684c292ea94b5a7e0a960f7453ddedbe61. Private before/authored/preserved/visual/proof files retained outside Git. No new broad task was marked completed.

Full22-field report: docs/faculty-availability-acceptance-release-report-20261021.md. Private local/School receipts and plan-scoped logs retained; no source identities, credentials or business records added to Git.

## Current blockers and next safe action

Owner confirmed Actions quota/billing cannot presently be handled, then instructed that CI checks will use a separate cloud conversation. At each CI gate, give the Owner a copyable prompt with exact repository/branch/HEAD, commands, required workflows, artifact and non-deployment boundaries. Do not start another conversation or poll/rerun CI on the Owner's behalf under this preference.

Real authenticated Admin/Faculty API and browser acceptance is still outstanding; current Chrome control times out. Never extract browser storage/tokens or manufacture Faculty credentials. Independent SQL scope tests and synthetic390px browser evidence do not replace real sign-in.

Remain Draft/unmerged. After cloud results: verify their exact SHA and distinguish cloud execution from actual GitHub Actions. Required exact-head CI/artifact, real authenticated acceptance, refreshed main, exact-main CI/artifact and coordinated University API then Hosting-only release still apply. Never use static-only compatibility mode.

## DO NOT REDO

Do not replay056, completed540 migration, MASTER source application, CCC replacement, earlier policy operations, or old business before-images. Do not drop an additive unused proc to hide an incomplete release. Do not cut over old273. Preserve latest main History and all27 gate values.

