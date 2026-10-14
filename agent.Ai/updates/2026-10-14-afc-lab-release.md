# Agent Update — AFC controls and grouped LAB published

**Date:** 2026-10-14
**Agent/model:** Codex
**Repository:** Alex1122341/Teaching-assignment-azure
**Task status:** COMPLETE — API, Hosting and final Chrome acceptance completed

## 1. Goal

Complete the owner-authorized PR94 release: enable AFC create according to server permissions, remove visible internal IDs, support audited AFC cancellation, and display grouped LAB/SRL details with real source intervals and explicit missing groups.

## 2. Starting breakpoint

PR94 merged b9dc273; SQL rollback acceptance exposed timestamp conversion and was corrected by reviewed SQL-only PR95, merged ca465bf1401b457ca3b74048cfaf170bedc7694a. Protected product/trust anchor remains fb2c625745957fa7d9990033f15a7b1ef91974a5. Prior update: 2026-10-13-afc-version-encoding-hotfix.md.

## 3. Work performed

- Reviewed product/governance and SQL correction merged with preserved history.
- SQL036 and037 applied to VetMed-Ops after compile rollback checks and exact-main CI.
- Manual/imported cancellation, retry/audit, stale version, faculty denial and concurrent row-lock rollback acceptance passed; fixtures and audits rolled back.
- Bound only the exact cancellation procedure role to the existing runtime principal. Existing temporary Beta permissions retained.
- Prepared and attested65 University source/package files; guarded API cutover passed and enabled only the new AFC cancellation gate.
- Hosting-only CLI released the exact final-main artifact; all71 protected public assets match its bytes. No Firestore rules/indexes/Functions release.
- Chrome acceptance confirmed the grouped live LAB/SRL tables and AFC controls. The Delete confirmation was dismissed; no real faculty record was created or cancelled for UI testing.

## 4. Files / components changed

Product and migration files are documented by PR94/95. This final checkpoint changes documentation only; no runtime/freeze changes or new deployment follow from it.

## 5. Architecture / invariants

Firebase identity -> University API -> SQL authority preserved. No Firestore fallback, wider faculty privacy access, invented groups/times or hard AFC deletion. Independent exact-true gates preserved; only afcCancel is newly enabled.

## 6. Data / algorithm changes

Cancellation sets Active=0 and retains history/audit. SQL037 explicitly casts rowversion to binary(8) before hex text; view columns/order/grants and procedure unchanged. LAB groups only already authorized rows of the exact course/date/year/academic-year. DOE algorithms and prior gate values unchanged.

## 7. Tests / CI evidence

- Local root npm test:813 total,781 passed,32 skipped,0 failed. Server npm test:509/509. LAB helper/controller:6/6.
- PR95 Beta38453064230 / SQL38453064219 success.
- Exact-main ca465bf: Beta38453614170 / SQL38453614145 success, including emulators/container/repository+artifact freezes.
- Final artifact11841223478 digest4815c25424fec4878c553f7d8e8a7a7b8ce523dc1d7cdf63bc82eb4a4d69953b verified. Static71/API67 freezes zero drift; University65 source/package files attested.
- SQL markers: AFC_SCHEMA_COMPILE_ROLLBACK_OK, AFC_VERSION_ENCODING_REGRESSION_OK, AFC_CANCEL_ROLLBACK_ACCEPTANCE_OK, AFC_IMPORTED_ROLLBACK_ACCEPTANCE_OK, AFC_STALE_ROLLBACK_ACCEPTANCE_OK, AFC_FACULTY_DENIED_ROLLBACK_ACCEPTANCE_OK, AFC_CONCURRENT_CANCEL_SERIALIZED_OK, AFC_CONCURRENT_HOLDER_ROLLBACK_OK, AFC_NARROW_RUNTIME_MEMBERSHIP_OK.
- GitHub Hosting38454750572 stopped before deploy because its old DOE-off check conflicts with existing authorized enabled DOE gates. The guard/workflow was not changed and DOE was not disabled. Repository-prescribed Hosting-only CLI deployed the same tested artifact after independent API/auth401/CORS checks.
- Hosting CLI:72 artifact files (71 protected assets plus SWA config), deploy exit0. Public verification checked all71 protected assets with0 mismatches. Evidence: output/afc-release/firebase-deploy-20261014.log and public-static-verification-20261014.json.

## 8. Live operations

Applied SQL036/037, added narrow cancellation-role membership, source-attested API cutover and Hosting-only release. All business acceptance fixtures rolled back; observed803 active imported AFC,0 manual rows,0 cancellation audits,0 invalid tokens after release. No imports, credential/account changes or unrelated18788 process stop. Temporary18789 validation process cleaned up.

## 9. Current state

Public API and Hosting release: ca465bf1401b457ca3b74048cfaf170bedc7694a. API trust: fb2c625745957fa7d9990033f15a7b1ef91974a5. API PID17348 on18787. Current public runtime/SQL health both ok; afcSingle/afcCancel true. URL: https://tester-teaching.web.app.

## 10. Chrome acceptance

Connected Chrome authenticated as the existing ADFA owner. The actual course206 /2026-10-16 modal shows Spinal Cord08:30–12:30 and Bovine Distant Exam09:15–16:15, plus Chronic Pain research14:30–15:30 and Neuro Exam LA15:30–16:30. Each row displays its stored instructors and Edit Session / Manage Instructors / SWAP request controls. Missing rooms and group rotations are explicit; no reference-image rotations or rooms were invented. The table screenshot was visually inspected with all four rows and buttons visible.

AFC loaded803 records. All803 active rows expose Delete; Create AFC Record is enabled. The rendered UI and faculty option labels contain no GUID. Delete opened a native confirm, which was dismissed. A subsequent fresh Dashboard read still loaded803 records; no live creation/cancellation was performed. Chrome's old-tab focus timeout after dismissal was resolved by a new tab in the same connected browser; the dialog was no longer present.

Local screenshots: output/afc-release/lab-live-20261014.png and afc-live-20261014.png. The timetable LAB tab is retained as the user-facing result. SQL mutation acceptance is the rollback evidence in section7, not a claim of a live UI write. Per-row modal handlers are covered by the accepted controller tests; UI acceptance only inspected their controls.

## 11. Exact breakpoint

Functional release and browser acceptance complete. This documentation checkpoint is reviewed separately before merge. Published runtime remains ca465bf; documentation-only main commits need no additional deployment.

## 12. Next safe action / rollback

Continue only under a concrete new owner task after acceptance. For a release fault disable afcCancel/remove only its role membership and restore the prior verified launcher/artifact. Keep timestamps and audits; do not delete business history.

## 13. DO NOT REDO

Do not rerun migrations/imports/rollback fixtures or redeploy this completed release merely to resume. Do not stop unrelated18788, change existing DOE gates, weaken frozen enforcement or fabricate source data.
