# Agent Update — ADFA SWAP acceptance and Task02 continuation

**Date:** 2026-10-15  
**Agent/model:** Codex  
**Repository:** Alex1122341/Teaching-assignment-azure  
**Task status:** ADFA UI extension COMPLETE (candidate); Task02 NEXT; live release pending

## 1. Goal

Extend existing ADFA SWAP with current/projected DOE and Check availability, then continue the full-directive queue. Owner approved UI/API/SQL test seams, prohibits grilling and now permits essential questions. Missing source-dependent work can be skipped and recorded.

## 2. Starting breakpoint

- Parent a60aa98bd4e866fb5e11f2eacefb2e8ebc258c8a / draft Calendar PR98.
- Branch feat/adfa-swap-doe-preview-20261014 / draft PR99.
- Worktree C:/Users/xinyu.zhu1/Desktop/Teaching-assignment-azure-worktrees/afc-record-management-20261013.
- Prior Calendar release-preparation update remains valid. Default Teaching-assignment-main cwd is another repository.

## 3–4. Work performed / components

Readonly SQL042 + opaque mapping and SQL acceptance harness; authenticated GET preview reusing real DOE services; six-row searchable ADFA table; current/projected/target/remaining/server-derived change; refreshed selection/submission; honest unavailable/stale states; mode-switch cancellation and draft preservation. Existing SWAP state machine/approvals/apply remain authoritative. See docs/adfa-swap-review-20261014.md and docs/adfa-swap-governance-20261014.md.

## 5–6. Architecture / data and algorithms

SQL business authority/Firebase identity unchanged. Server SQL profile governs ADFA DTO; only sanitized fields reach browser. No client DOE arithmetic, audit persistence, private reason disclosure, new role memberships or expanded apply permission. New proc only EXECUTE granted to existing read role. Unknown amounts/timing stay Needs Review. Saved-session preview switches to original form for schedule edits. Static75, API73runtime/76protected; immutable protection semantics unchanged.

## 7. Verification

Accepted product0f81c3e0b7e63a9b9357755b7e957406018894fd; separate reviewed governance/headc6dab5d39ba3e15fad825c587327dabf51974665. Independent product + fix-pass review Ready, separate governance review Ready; all findings resolved with observed regressions.

- Exact-head Beta38678006715 SUCCESS: root849/817pass/32skip, server597/595pass/2environment skip, emulator849/849 zero skips, build/container/repository+artifact freezes, governance57/57.
- SQL38678006632 SUCCESS: thirteen observed two-connection races, guarded rollback, new ADFA preview/rollback acceptance.
- SQL migration38678007053 SUCCESS.
- Local Node22 root849/817pass/32emulator skip/0fail; Windows server597/596pass/1SQLskip/0fail.
- Chrome actual UI/client/API/DOE with synthetic sources and stub Auth: aliases, faculty privacy, search/paging, selection, changed availability blocked, error clearing, mode draft preservation; responsive390px DOM fit and horizontal table; override reset. Owned browser tab/server closed.
- Downloaded CI artifact11947096027 digest a7504ea380c102594fd96cb80e9e27db28e28a9d7af7fca737fa287e52623ff6 verified. Both artifact freezes match accepted product; no private source/test/recovery paths. Artifact expires2026-10-22T03:49:52Z. PR merge artifact name usesc20beef, associated feature headc6dab5d.

## 8–9. Live operations / state

No live mutation, SQL migration, role binding, gate change, merge or deployment. PR99 depends on unmerged PR98. Current deployed prior release remains unchanged; no fresh live counts asserted. Preparation-only least-privilege identity prerequisite remains unresolved.

## 10. Open items

Live release needs separate concrete authorization/prerequisites. Broader original Task01 automated transition-coverage audit is not claimed complete just because this ADFA extension passes. Missing specialty/teaching-area metadata skipped; name search uses actual candidate fields.

## 11–12. Breakpoint / next action

Save this documentation, refresh PR99 evidence, then start a separate stacked Task02 branch from this accepted candidate in the same isolated worktree. First inspect existing workspace-tasks.js, session/availability APIs and SQL scope; write the six-part reuse/gap review before product edits. Extend current Tasks; missing information is Needs Review, and closing review must never suppress an unresolved underlying conflict. Obtain only essential design/seam choices now that owner permits questions. Never invoke grilling.

## 13. Do not redo

Do not repeat prior AFC/LAB release, archived faculty actions, retained row812 insertion, Calendar implementation/reviews, live migration/deletion, or alter external untracked server/test/fixtures/calendar-activity-race-wait-observe.sql. Preserve Calendar's unfinished live-phase workspace and rulings. Scratch and downloaded ADFA artifacts are outside repo under AppData/Local/Temp/paws-adfa-swap-20261014.
