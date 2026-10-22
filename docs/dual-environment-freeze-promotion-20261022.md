# PR125 integrated dual-environment freeze promotion — 2026-10-22

## Reviewed product and exact boundary

Current product `424242603af2d6ff313d6db3520e6d04ad5f9024` merges latest main `ad605dbb9ab92457df972703c723e2b991fa284c` (PR131 faculty Last, First presentation) into the previously reviewed PR125 integration35a8416. Original PR125 head2994c73 remains an ancestor. Independent Standards and Spec reviews of both immutable products reported no actionable finding. The latest merge preserves both name formatting and environment navigation in the conflicting HTML files. This separate governance promotion changes no runtime bytes and adds no drift exceptions.

The shared static/API anchor is that product. Static protection grows85→86, adding only `paws-environment-nav.js`; API runtime grows110→111, adding only `server/src/runtime/environment.js`. No protected paths disappear. API build/package inputs remain protected, giving114 API paths and200 static/API/build/package paths altogether. Static reporting hashes are generated from immutable product Git blobs.

Compared with latest main, the reviewed delta is exactly14 static files and7 API files, enumerated in `tests/dual-environment-latest-main-governance.test.js`. All remaining protected files are byte-identical; current Availability, CCC Schedule, name formatting and restored History readers and SQL056/057 are explicitly checked. The27 write-gate names and exact-true behavior remain unchanged. Server bytes and package inputs are identical to35a8416.

## Historical receipts

- Original dual-environment product413e87f, governancecd7f0a6: retained as fixed historical82static/105API expectations, independent of the current anchor.
- CCC Schedule product5b135df, governance1193335: retained as a fixed historical85static/110API promotion, with its exact prior delta and reporting hashes. Availability archive tests now read that immutable receipt and verify it is an ancestor of the current anchor.
- All earlier Availability, History, DOE, AFC/LAB and prior governance assertions remain active.
- The first integrated checkpoint35a8416/governancea30ad39/report correction637203c remains pinned to its immutable receipt in `dual-environment-integration-governance.test.js`. It passed full root1032/0fail/52skip before main advanced.
- PR131 productba915e9/governance31e4bee remains a fixed historical18-file presentation-only promotion, independently of the newer integrated anchor. Historical Availability/name assertions read that receipt and require its ancestry.

No freeze is weakened: repository and artifact checks still use immutable Git objects, union historical/current protected paths, and reject unauthorized byte/config changes. Historical tests are preserved rather than rebound to a newer product whose delta is different.

## Verification status

Prior product server suite:860total,856pass,0fail,4skip. Corrective focused45/45, merged UI82/82; first integrated full root1032pass/0fail/52skip. Latest-main focused name/config/tooling/role tests88/88. Latest integrated root 1093total/1041pass/0fail/52skip; complete server serial 860total/856pass/0fail/4skip. Current/historical governance6/6 and latest build/artifact freezes pass. Default-concurrency host parser timeouts and unexecuted SQL/UAT remain recorded in the readiness report. Reporting hashes use the repository's canonical SHA-256, including the PDF, from immutable Git blobs. Historical LocalDB44/44 does not cover this update; new reader SQL acceptance remains unexecuted because current local tools lack LocalDB. Testing infrastructure and deployed UAT remain prerequisites.
