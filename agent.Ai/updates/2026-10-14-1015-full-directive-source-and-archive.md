# Agent Update — Full directive source audit and authorized Archive

**Date:** 2026-10-14
**Agent/model:** Codex
**Repository:** Alex1122341/Teaching-assignment-azure
**Task status:** PARTIAL — archive complete; full directive design awaiting review

## 1. Goal

Audit all25 requested modules; reconcile approved AFC tracker; exclude departed source identity and archive the existing departed Faculty with history preserved.

## 2. Starting breakpoint

Base main/working SHA0d4b4d9ea2e658719e87f16ef5132b82544bc6c1. Branch docs/paws-directive-assessment-20261014; no new PR. Prior update2026-10-14-afc-lab-release.md. Published ca465bf, trustfb2c625, University API PID17348/18787.

## 3. Work performed

Three independent read-only domain audits completed. Wrote full25 assessment and focused first-module design. Independent final document review found no Critical/Important issues; two Minor snapshot/count clarifications corrected. Inspected original XLSX read-only and reconciled hashed canonical/alias/accepted-source-lineage keys with exact live AFC dates/purpose. Owner confirmed OPA retained, four departed unmatched-person rows excluded; Course Calendar capability only.

Existing Faculty UI archive failed503; normal stored procedure failed1934. Read-only sys.sql_modules confirms persisted QUOTED_IDENTIFIER0. Both attempts rolled back. Completed the specifically authorized existing Faculty archive by executing the unchanged reviewed procedure body as parameterized admin batch under correct session settings, preserving actor/target uniqueness and all original permission/version/transaction/audit checks. No stored procedure repair.

## 4. Files / components changed

docs/paws-full-directive-assessment-20261014.md; docs/superpowers/specs/2026-10-14-calendar-working-activities-design.md; this update and PROJECT_STATE/TASK_CHAIN/DECISIONS. Ignored output contains source hashes/diagnostics/test logs and Archive screenshot. No product code changed.

## 5. Architecture / invariants

Existing University SQL authority preserved. Proposed range-activity design requires owner review; not implemented. Archive uses existing Inactive Faculty/Restore, keeps original identity/history/accounts. Permanent AFC work cleanup is a different future operation requiring source-bound atomic migration.

## 6. Data / algorithm changes

One existing Faculty Active flag changed from1 to0 with updated timestamp and one FacultyDeactivated audit. No relationships deleted. One departed source person has no canonical identity;4 input rows excluded, not created. OPA retained. Original workbook unchanged.

## 7. Tests / CI evidence

Unchanged runtime main0d4b4d9: root npm test813 total/781pass/32skip/0fail, server509pass/0fail. node tools/build-static.js71assets. Repository static/API freezes and properly packaged Beta static/API artifact freezes pass. Raw static-only artifact check failed ancillary SWAconfig until documented Beta packager used; no guard modified. No new module test or migration applied.

## 8. Live operations

Performed: narrow SELECT-only schema/count/source reconciliation; one specifically authorized reversible Faculty archive with original audit logic through trusted admin tooling. SQL verifies119active/2inactive, exact targetinactive, one archiveaudit, Sessions1937 andAssignments4970 unchanged. Chrome confirms Inactive Faculty card and saved screenshot output/full-directive/canton-archived-20261014.png.

Not performed: workbook import, permanent AFC deletion, Course replacement, DOE/policy/published writes, stored-procedure/schema changes, permission/gate/account changes, merge, release or process restart. Concurrent user application AFC changes were observed803→804→805; not agent fixtures.

## 9. Current state

Draft documentation PR97 opened and attached: https://github.com/Alex1122341/Teaching-assignment-azure/pull/97. Reviewed documentation commit ad012710e4ac857414315d1e4e5cbb310e8fcd6b; this checkpoint adds only the PR identity. No merge. Published runtime unchanged. Refreshed source match541 worktargets; row812 nowexists and must not beinserted again.

## 10. Blockers / unresolved questions

Written activity design review then implementation-plan review required by brainstorming skill before new subsystem implementation. Dates256/525 invalid, faculty307/purpose487 missing; quarantine. Scope/time mappings cannot be invented. Generic Faculty deactivateAPI remains defective because persisted moduleQUOTED_IDENTIFIER0; focused SQL correction needs review/release authorization. Least-privilege expansion prerequisite remains.

## 11. Exact breakpoint

Archive request completed; full25 source/architecture audit and first-module proposed design are ready for review. No actual working activities have been migrated. Latest concrete targetpreview541 is evidence only and requires regeneration beforecommit.

## 12. Next safe action

Review first-module written design, produce exact implementation plan upon approval. Prepare a separate scoped SQL metadata correction with rollback/stale/authorization/audit tests and reviewed deployment. Regenerate sourcebound migrationpreview only after accepted activity/availability integration.

## 13. DO NOT REDO

Do not archive the completed record again, create the excluded departed person asactive, insert row812 again, rerun priorreleaseSQL/fixtures/imports, deploy newmodules, repair storedmetadata silently, recalculateDOE or stop unrelated18788. Never use old803 count as deletion authority.
