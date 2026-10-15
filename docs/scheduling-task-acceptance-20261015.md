# Scheduling Tasks acceptance — 2026-10-15

Status: product review fixes verified; separate freeze governance and final CI/artifact acceptance in progress. No merge, live SQL/data change, role/gate change or deployment has occurred.

The independent governance review was interrupted by an explicit workspace-credit error before a final report. The local promotion draft has not been committed or pushed. Do not infer acceptance from the reviewer's preliminary message.

## Independent review and correction

Fresh reviewer reviewed b53c23e1621c6a98c2d9b4c62198fdefdebeaf0f..277a51c05cd4674cc9e1e6c5ecb9264926ce549e. It found four Important issues, no Critical/Minor. Native single fix pass accepted at a3dd9ca9e5324cc6889d09c7a0a1ad08993c8bca:

| Finding | Reproduced failure | Correction / evidence |
|---|---|---|
| Empty or unresolved assignment recreation reused review | Actual SQL38771404030/job116547858078 atbc430dd: empty assignment recreation failed54390 | Owner approved trigger plan adjustment. Derived retained version plus all assignment versions; real normal replacement, supported Undo, unresolved changes and rollback pass in38771955259 |
| Related course missing from filters/facets | Same actual SQL run failed related-course assertion54390 | Include either authorized course; one issue/count per pair; regression passes |
| Refresh/open reused permanent session cache; new server year ignored | Shipped adapter/cache test returned1 stale row instead of2; browser had0 options for returned new year | Fresh authorized scope, fresh target fetch, explicit current detail object, missing/failure message, account guard and no subscriber recursion; tests pass |
| Facet selection became invisible | Browser course selector returned empty while active request retained206 | Preserve selected option and its safe label with “not in current issues”; year/source-change regression passes |

## Verified product evidence

- Full SQL workflow38771955259/job116549777131 SUCCESS at a3dd9ca. Detection, eight issue kinds, strict interval boundaries, scoped facets/filter/paging, duplicate suppression, privacy, missing/unassigned/unresolved/undated-only-year records, durable review/roles/audit, supported recreation/Undo, source rollback and narrow runtime permissions pass.
- Seven actual observed connection lock waits: Session writer first; assignment INSERT/DELETE first; AFC writer first; Calendar time writer first; reviewer before Session writer; competing reviewers. Stale writes fail; exact audit count checked.
- Guarded migration rollback: audit/populated/bound refusals and actual SCHEDULING_TASK_ROLLBACK_OK. Existing Calendar atomic/race/rollback and ADFA preview/rollback lanes remain present and pass.
- Windows server full suite via Node22/npm10:613 total,610pass,3 explicit SQL-environment skips,0fail. Prior API+transport regression46/46; client export-inventory regression27/27.
- Actual installed headless Chrome via existing bundled Playwright:7 browser workflows plus2 tests executing shipped timetable adapter/cache,9/9,0skips. Browser plugin unavailable; no application dependency added. Covers paging/review/reopen/stale/error/identity, both links and metadata, mobile390px/focus/no overflow, absent facets and server years. Separate client/timetable suite102 total,95pass,7 browser-lane skips,0fail.
- Root diagnostic before promotion:855 total,812pass,6fail,37skips. Five were pending immutable-freeze governance; sixth was old closed client export inventory, corrected and focused27/27. This diagnostic is not a green full-suite claim. Final full root/emulator evidence must replace the pending status below.
- Final sequential local `npm test` with the proposed uncommitted governance draft:860 total,821pass,39 explicit emulator/browser-lane skips,0fail (225.5s). A prior overlapping manual build caused ENOTEMPTY in the existing shared artifact test; sequential execution passes without source changes. This local result is not exact-head remote/emulator CI.
- After all tests finished, `node tools/build-static.js` and `node tools/build-beta-release.js` succeeded. Static repository/artifact freezes75/75; API repository/artifact freezes76 runtime/79 protected paths; zero drift against product a3dd9ca. Canonical local inventory153 files:76 app (75 manifest+host config),77 API (76 runtime+inventory). No private/workbook/test/recovery paths. Combined local normalized-path content SHA256 `71d64b84d8a0a9a7294a1b9c01b0601c071bb9f2b638d3fd5782916f8cb8cde6`; this is not a downloaded CI archive digest.

## Remaining acceptance checks

- Separate independent governance review of shared immutable product anchor,75 static files,76 API runtime/79 protected paths, exact deltas and unchanged attack/inventory checks.
- Final full root, server, Auth/Firestore emulator, synthetic SQL and container-build CI at exact candidate head. Java is unavailable locally; emulator acceptance remains in CI after reviewed governance is pushed.
- Canonical generated candidate and downloaded exact-head CI artifact digest/inventory/static+API freezes. Run artifact verification after test suites finish because existing tests create/remove the same generated output directory.
- Release readiness remains conditional on dedicated least-privilege University identity and explicit merge/migration/activation/deployment authorization. Production-scale performance remains unmeasured.
