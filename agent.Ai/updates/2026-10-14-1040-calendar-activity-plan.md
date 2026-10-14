# Agent Update — Approved activity design and implementation plan

**Date:** 2026-10-14
**Agent/model:** Codex
**Repository:** Alex1122341/Teaching-assignment-azure
**Task status:** PARTIAL — plan ready for owner review, execution method pending

## 1. Goal

Continue from the owner's explicit written-design approval by preparing the first-module implementation plan.

## 2. Starting breakpoint

Base main0d4b4d9ea2e658719e87f16ef5132b82544bc6c1; working branch docs/paws-directive-assessment-20261014 at346c93db4181949d9de2d020361ea7e5222d3b72. Existing draft PR97. Prior update2026-10-14-1015-full-directive-source-and-archive.md. Runtime ca465bf/trustfb2c625 remains unchanged.

## 3. Work performed

Read writing-plans skill, accepted design, exact runtime/API/SQL/SWAP/Calendar/import/dependency sources. Wrote seven sequential implementation tasks with exact interfaces, tests, migrations, privacy, shared locks, saved SWAP availability versions, bounded XLSX parsing, source manifests, recovery and release gates. Self-review corrected independent SQL test order, newly introduced identity ambiguity, CRC checks and postcommit recovery artifact timing. Proposed Native execution with independent whole-branch review; alternative per-task subagents remains available.

## 4. Files / components changed

docs/superpowers/plans/2026-10-14-calendar-working-activities-implementation.md; approved-status markers in the spec; current checkpoint/decisions and this chronological update. Documentation only.

## 5. Architecture / invariants

Owner approved the first proposed SQL CalendarActivity range design. No new schema/runtime/algorithm implementation or release permission follows from plan creation. The remaining25-task directive stays outstanding.

## 6. Data / algorithm changes

None. The plan preserves source exclusions/OPA/leave, exact two-sided activity+AFC transaction, scoped reads, Needs Review and no inferred times/year/DOE. Current source evidence must be refreshed before commit.

## 7. Tests / CI evidence

No product tests rerun because only documentation changed. Unchanged-product baseline evidence is recorded in the preceding update (root813total/781pass/32skip; server509pass; proper static/API freezes). This turn runs git diff whitespace checks and plan self-review only; it does not claim future planned tests passed.

## 8. Live operations

None this turn: no SQL/query/mutation, browser action, import, archive, permission/gate/account change, merge, deploy or process restart. PR97 documentation is updated with the plan checkpoint.

## 9. Current state

Draft PR97 contains approved design and proposed plan. Published runtime remains unchanged. Product implementation has not started.

## 10. Blockers / unresolved questions

writing-plans skill requires owner review of this concrete implementation plan and an execution-method choice before implementation. Prior design approval permits writing the plan, not skipping that stage. Real source exceptions, generic Faculty metadata defect and least-privilege release prerequisite remain recorded; they do not prevent plan review.

## 11. Exact current breakpoint

Seven-task plan saved/self-reviewed. Ask the owner to review it and choose Native or per-task subagent execution. Continue through the chosen execution skill only after response.

## 12. Next safe action

Following approval, use the existing isolated Beta worktree and a feature branch from the committed plan, read executing-plans or subagent-driven-development as selected, then start Task1 tests before product implementation. Track staged acceptance without live source deletion.

## 13. DO NOT REDO

Do not rerun the completed archive, prior PR94/95 migrations/imports/releases, create the excluded departed person, insert source row812 again, treat541 as a fixed expected commit count, change Faculty metadata silently, relax freeze/privacy, infer clock/course/year/DOE or use Impact Preview for read-only reconciliation.
