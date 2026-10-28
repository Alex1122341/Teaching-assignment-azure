# Effective access immutable freeze promotion

Reviewed product: `179fa70ebce42e252a29826d76057799d6af43a7`.
Previous shared anchor: `19d5042473917bc96434b141ab1f9a41f8e8eb1e` (PR149 HICC/LAB display).
Integrated main: `42622acf42558e4478a3ce3018f5357b6effdedc`.

This separate governance change promotes the reviewed product's Git blobs, not mutable working-tree hashes. Static/API share one anchor. Verification algorithms, canonicalization, baseline/current manifest unions, API discovery roots, build definition and package-input protection are unchanged. The reporting JSON is regenerated from immutable product blobs and remains non-authoritative.

- Static:95 →96; only `effective-access-guard.js` added, no removed public path. Fourteen changed/new protected assets are enumerated in `tests/effective-access-freeze.test.js`.
- API:121 →127 runtime files, plus the unchanged Dockerfile and two server package inputs:130 protected inputs. Six new access/runtime modules and four existing changed modules are enumerated in the same test.
- Earlier SQL migrations, indexes, dependency graphs and build definitions remain byte-identical. SQL060 is additive and separately tested. Restrictive Firestore rules are explicitly reviewed security changes, not a Hosting deploy side effect.
- Historical promotions remain pinned to their original product/governance commits. PR149 tests now read its immutable governance receipt and require that product to remain an ancestor; its three-file display diff and zero API/SQL/security diff remain tested. Report-theme historical95-file union is checked at its historical product, while current union coverage is96.

Product review findings and RED→GREEN fixes are recorded in `PRODUCT_REVIEW.md`. Exact-product account SQL run40443398849/job121988807832 succeeded, including all nine mandatory markers and existing-principal refusal. The six SQL regression workflows passed at the same product. Product Build failure before this promotion was expected frozen-runtime drift; it is not accepted as a green release result. Full checks must run against the final governance HEAD.

Independent governance review and final verification results are recorded separately when available. This promotion neither installs SQL060 nor enables gates, updates live rules, restarts the API or publishes Hosting. Server credential probe `ADC_UNAVAILABLE` remains a release prerequisite; no actual role/group/announcement mutation is authorized for acceptance fixtures.

Independent governance review completed with no substantive findings. The reviewer independently verified all96 canonical Git-blob hashes, complete96/130 protected unions, unchanged algorithms and preserved PR149 receipts. Governance commit: `c17f3515f8200abe1c39a541ea4fe98c6da671eb`.

Its exact-head Build40444593897 passed root1299/1354 (55 skipped) and server934/942 (8 skipped), both zero failures. The subsequent emulator step exposed14 obsolete positive browser-Firestore expectations. Four legacy suites are now explicitly historical and load immutable19d504 rules; their previous positive/negative scenarios remain intact. Current-rule probes additionally deny the retired opaque indexes, statistics and bulk-job events. Actual local emulator run:20/20, zero failures/skips. Rules/runtime were not changed to accommodate tests. Full final-head checks remain required after this test-only correction.
