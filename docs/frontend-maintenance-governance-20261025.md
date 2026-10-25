# Integrated Calendar and History maintenance — 2026-10-25

Reviewed product: `90b8c2f263ce49ba97eaa48db5fad749f64b436f`.

Accepted main: `c7ca3d978437918ee503d2b64e84f5512c195971` (PR144); live API/Hosting baseline before this frontend release: main `c2c1de44d03262dc439dcffb9764b06ce7181cd1`, product `50e7e5c4241debe078080adda7a7dcbd383a2ba1`.

PR141 and PR142 are integrated with history-preserving merges. PR143's published SWAP workflow/SQL059 and PR144's reviewed Azure retirement are ancestors. PR139 was already delivered through PR140 and is closed as superseded, not re-merged.

Independent Standards and Spec review found the same remaining Calendar race: returning to an unsettled A range rejoined its abandoned promise and left Loading indefinitely. Three public integration regressions failed before the fix and pass after: unresolved A→B→A, working-type off/on, and bounded automatic recovery/manual Retry. Stale renders do not repaint or retry. Product re-review on both axes reports no remaining blockers. Focused Calendar/History/SWAP UI tests: 80 passed, zero failed.

Static protection increases from 91 to **92**, adding only `calendar-search.js`. Exactly five frontend source paths differ from accepted main: `index.html`, `calendar-activities.js`, `calendar-search.js`, `change-history.js`, `timetable.js`. All other served assets retain their accepted bytes, including SWAP panels/styles, names, API origin, auth, DOE and shared lazy loaders. History recovery is byte-identical to the independently reviewed PR142 product.

All **116 API runtime files plus three build/dependency inputs (119)** are unchanged. SQL/schema/permissions/rules/dependencies/gates and original sources are unchanged. No API restart, SQL migration/reimport or business mutation is part of this maintenance release.

This separate promotion changes the frozen commit reference and derived reporting hashes only; Git-blob authority, union protection, source/artifact checks and the API's shared trust anchor stay intact. Historical office, History and SWAP receipts are tested against their immutable governance objects, with independent exact current-anchor/92/119/unchanged-backend checks. No historical runtime object or receipt is rewritten to accommodate the new file.

Release gates: final exact-head root/server/emulator/build/freeze CI, independent governance review, merge, successful exact-main CI with official artifact, Hosting-only publication, all92 raw served hashes, real Faculty/ADFA read-only browser smoke, API health/401/CORS and all27 unchanged live gates. Source checks and candidate previews alone are not publication. Native200% zoom and broader DVM requirements remain outside the certified scope.
