# Agent Update — PR125 local Testing design

**Date:** 2026-10-22 (America/Edmonton)

**Repository:** Alex1122341/Teaching-assignment-azure

**Task status:** PARTIAL / written-design review pending

## Goal and starting breakpoint

Existing PR125 branch feat/paws-testing-environment at099d6b809f9bf3618e77bb5f5a139043b28d10e4. Owner explicitly approved current computer VET-C31293 for temporary LocalDB/API/tunnel with separate Firebase project. Azure is retired. Prior update:2026-10-22-pr125-non-azure-release-inventory.md. No relevant global memory hit.

## Work performed

Read brainstorming skill and targeted current environment/SQL/reset/account/provenance/workflow code; reused existing inventory. Created and self-reviewed docs/superpowers/specs/2026-10-22-pr125-local-testing-design.md. It defines component boundaries, guarded actual ODBC18/native driver use, private LocalDB/profile/paths, real Firebase identities, startup/tunnel-drift detection, reset backups, candidate versus main evidence, local staging plus GitHub public verification/Hosting, acceptance and coherent University API/Hosting rollback. Official Microsoft LocalDB/SQL2025 Windows requirements support feasibility; actual installation/native-driver behavior remains unverified.

## Changed files and invariants

Written design and documentation continuity only. Updated DECISIONS/PROJECT_STATE/TASK_CHAIN with approved host and next review stage. Prior audit docs are retained as historical snapshots. No source/runtime/workflow/freeze edits, dependency installation, local DB creation, Firebase or Production operations. No new test run: this stage authors documentation only. Git diff whitespace and scope checks apply before committing.

## Source/evidence state

Prior accepted CI/artifact remains bound to source099d6b8 and synthetic-mergee28e7a6 tree, not any newly implemented provider. Do not report desktop Testing installed/live or PR125 merged/released. Written spec will be a documentation commit on the existing branch; no push requested at this review stage.

## Exact next action

Ask Owner to review the linked written design. Under brainstorming, approved direction permits this spec, not implementation. Written-design approval permits writing-plans; a concrete plan and execution method must then be reviewed before provider implementation or installations. Previously selected sequential execution remains the recommended method. Continue on the same PR/worktree and preserve independent product/governance review and exact-main evidence. Do not repeatedly ask for the already-approved host or general release authorization.

## Do not redo

Do not provision Azure, create a self-hosted runner, copy real data/credentials into Testing, replay540migration/413CCC/MASTER, publish DOE, change27gates or restart healthy Production for design work. Do not overwrite historical receipts or treat old local acceptance as current deployed testing.
