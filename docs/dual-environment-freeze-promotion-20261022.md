# PR125 integrated dual-environment freeze promotion — 2026-10-22

## Reviewed product and exact boundary

Product `35a84164d4a330e6f6d0427b4850a7836445832f` merges original PR125 head `2994c73df92d1e692aa28094bb5c1ceec72403c8` with current main `924cc6761a3b2dfba4f19c2df912436cbd965b43`. Independent Standards and Spec reviews of that immutable product reported no remaining actionable product finding. This is a separate governance promotion; it changes no runtime bytes and adds no drift exceptions.

The shared static/API anchor is that product. Static protection grows85→86, adding only `paws-environment-nav.js`; API runtime grows110→111, adding only `server/src/runtime/environment.js`. No protected paths disappear. API build/package inputs remain protected, giving114 API paths and200 static/API/build/package paths altogether. Static reporting hashes are generated from immutable product Git blobs.

Compared with current main, the reviewed delta is exactly14 static files and7 API files, enumerated in `tests/dual-environment-integration-governance.test.js`. All remaining protected files are byte-identical; Availability, CCC Schedule and restored History readers and SQL056/057 are explicitly checked. The27 write-gate names and exact-true behavior remain unchanged.

## Historical receipts

- Original dual-environment product413e87f, governancecd7f0a6: retained as fixed historical82static/105API expectations, independent of the current anchor.
- CCC Schedule product5b135df, governance1193335: retained as a fixed historical85static/110API promotion, with its exact prior delta and reporting hashes. Availability archive tests now read that immutable receipt and verify it is an ancestor of the current anchor.
- All earlier Availability, History, DOE, AFC/LAB and prior governance assertions remain active.

No freeze is weakened: repository and artifact checks still use immutable Git objects, union historical/current protected paths, and reject unauthorized byte/config changes. Historical tests are preserved rather than rebound to a newer product whose delta is different.

## Verification status

Product server suite:860total,856pass,0fail,4skip. Corrective focused tests45/45; merged UI tests82/82. Root/full governance and artifact verification are in progress and will be recorded in the deployment-readiness report. The historical LocalDB44/44 receipt does not cover this update; new reader SQL acceptance remains unexecuted because current local tools lack LocalDB. Testing infrastructure and deployed UAT remain prerequisites; no release readiness is implied by this governance promotion.
