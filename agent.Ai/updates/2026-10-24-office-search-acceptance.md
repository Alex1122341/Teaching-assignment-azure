# Agent Update — supplemental office search acceptance

**Date:** 2026-10-24  
**Agent/model:** Codex  
**Repository:** Alex1122341/Teaching-assignment-azure  
**Task status:** VERIFICATION IN PROGRESS / RELEASE BLOCKED

## Goal and starting breakpoint

Continue PR140 to release standards without routine approval loops. Starting HEADd441daf, branch feat/paws-workspace-release-ready-20261023, main8bb40c6. Latest attachment explicitly targets this Beta repository; preserve the downloaded Desktop Teaching-assignment-main snapshot and separate Pages repository. Previous update:2026-10-24-office-workspace-release-candidate.md.

## Work performed

- Re-read current PR/head/base/CI:140 remains draft/open/mergeable, main8bb/head d441daf before this fix; workflow40103482274 successful. School RDC offline8h and temporary API domain NXDOMAIN. No remote mutation attempted.
- Actual generated-page supplemental acceptance found Teaching Summary/Roles search used raw displayName while labels use structured shared formatter. Both reject a visible surname when source displayName differs. Corrected only these two predicates; kept original aliases/ID/type/status conditions and shared formatter.
- Productfcc36231cd0b0c02a2b9b0871ffdf64fcc0e8788 committed first; separate immutable governance8133ecdffe3ec9f8c16d06ecc211ea8fa8925b4b. Historical a6c5092/4de4a3e remains pinned; enforcement algorithm and protected inventory unchanged.
- Real generated browser1280×720/390×900: `müller` returns six matching rows in both tables; role-type HICC clears and VISC restores six; result drill-down opens original Lookup/profile. No warning/error console entries. Mobile page remains within viewport; table scrolls locally. Viewport override reset.
- Private matched desktop before/after screenshots and supplemental390 screenshot saved outside repo. Synthetic records only. No live-role rerun while upstream unavailable.
- Independent supplemental reviewer:0Critical/Important/Minor; read-only d441daf..8133ecd. Prior whole-branch review remains valid for unchanged code.

## Files and contracts

Runtime: frontend/scripts/faculty-admin.js (two predicates). Regression: tests/office-aggregate-name-search.test.js. Separate governance updates freeze anchor/report/active tests plus historical receipt. Continuity/acceptance docs refreshed. No change to identity, matching, permissions, state machines, DOE/AFC, server/API/SQL/rules, dependency inputs or network behavior. Static bundle91files2338302bytes (+70bytes vs preceding candidate).

## Verification

- Node22.20.0 new search tests:11total,6pass/5expected failures before fix;11pass/0fail after.
- Matching search/page/auth/name suites:57pass/0fail.
- New governance tests:3pass/1expected anchor failure before promotion;4pass/0fail after.
- Full local root and sequential combined build/four freezes: pending at this update; record their final output before committing the receipt.
- Prior successful CI40103482274 and artifact12563489384 apply to d441daf, not the new candidate. Final PR head requires fresh checks; do not reuse the old artifact as this product.

## Live operations and current breakpoint

No SQL writes/migration/reimport, API/config/gate/CORS/permission changes, merge or deployment. All relevant source bytes still match main8bb. Existing release blockers remain: restore school RDC/API ingress, re-read actual runtime/gates and complete actual-origin authentication before release. Native200% zoom and full populated lazy-view coverage remain explicitly unverified.

Finish the full local run sequentially, validate combined source/artifact freezes, push the updated existing PR and inspect exact-head evidence. Preserve external recovery block. No new architecture, production SQL work, separate frontend source, or stale PR136/139 freeze merge. Follow the existing release runbook after connection restoration; latest UI directive still distinguishes readiness from explicit merge/publication authorization.

## DO NOT REDO

Do not rerun completed initial UI/Names phases, full backend suites for unchanged bytes merely to consume time, or simultaneous root/emulator/build operations sharing .azure-production. Do not silently repin historical receipts, bypass freezes, patch a served artifact or invent a restored server state.
