# PAWS Agent Startup and Handoff Protocol

This file is the canonical continuity instruction for AI agents working in the PAWS Beta repository.

## Mandatory startup rule

If you do **not** already have reliable, recent PAWS project context in your current conversation/session, stop before implementation and read, in order:

1. repository root `AGENTS.md`
2. `agent.Ai/README.md`
3. `agent.Ai/PROJECT_STATE.md`
4. `agent.Ai/TASK_CHAIN.md`
5. `agent.Ai/DECISIONS.md`
6. the newest file in `agent.Ai/updates/`
7. only then, the relevant sections of `ARCHITECTURE.md`, `DOMAINS.md`, and `ALGORITHMS.md`

If the task references a PR/branch/commit, verify that exact ref before using conclusions from a different branch.

Do not restart architecture from scratch merely because the chat context is new.

## Source-of-truth order

When sources disagree, use this order:

1. **Latest explicit owner instruction**
2. **Fresh verified live evidence** for mutable operational facts
3. **Exact requested repository/PR/commit source**
4. **Locked decisions in `agent.Ai/DECISIONS.md`**
5. **Current state in `agent.Ai/PROJECT_STATE.md`**
6. Older reports, prompts, comments and historical notes

Never silently “correct” the owner’s product choice with an older architecture report.

## Current strategic priority — verified 2026-10-15

The Beta is **already deployed as a University SQL-backed modular application**. The historical BETA-R1 connection milestone and old DOE-out-of-scope instruction are completed/superseded for later owner-approved modules, not today's task.

Current documented deployment: Firebase Hosting (tester-teaching.web.app) -> Firebase Authentication -> temporary Cloudflare HTTPS ingress -> University Node.js API -> SQL Server ITAPPVETOPSDB01 / VetMed-Ops. SQL UserProfile is the role/scope authority. This is university-hosted SQL Server, not a direct browser-to-Azure-SQL connection.

Review these active workstreams before implementing:

1. Preserve the accepted Oct14 AFC/LAB API + Hosting release ca465bf and its immutable trust anchor fb2c625; no repeat migration or deployment solely for continuity.
2. DOE is a current Beta module (Worksheets, Rule Book Draft/Preview, manual/target operations, engine). The candidate 2026-27 Rule Book remains a **Draft** in the latest documented SQL receipts; do not claim published Active policy or run recalculation without separate authorization.
3. Existing SQL Teaching Assignment, Session/SWAP, Faculty Dashboard, Role periods, Developer Support and Tasks are implemented subject to role/scope/write gates.
4. Draft PR #97 (design), #98 (Calendar working activities/exact AFC migration), #99 (ADFA SWAP DOE preview), and #100 (Tasks conflicts) are **not in main and not live**. Read their exact HEADs, dependencies and CI before acting; #100 most recently had a failing Beta Build.
5. Before any new Calendar/AFC migration or destructive source data operation: confirm dedicated narrow-permission service identity, exact preflight, review and owner-authorized release. Do not use existing temporary db_owner membership as evidence of least privilege.
6. Graph Outlook and Brightspace/D2L synchronization are future interfaces, NOT verified PAWS implementations.

Distinguish **present in source**, **merged**, **released**, and **live accepted** for every feature. Current main/ref, runtime gates, policy status and SQL counts are mutable and must be freshly verified. Read ARCHITECTURE.md, DOMAINS.md, WORKFLOWS.md, ALGORITHMS.md and the newest dated update for current diagrams and boundaries.

## Two-track rule

Do not conflate:

- `Alex1122341/Teaching-assignment` = Experimental / feature-forward / Firebase demo track.
- `Alex1122341/Teaching-assignment-azure` = controlled Azure Beta / migration / release track.

Features move from Experimental to Beta deliberately. There is no automatic parity requirement.

## No-repeat rule

Before repeating a migration, reset, import, provisioning step, live write, deployment or merge, read `PROJECT_STATE.md` and the newest update.

In particular, do not rerun the Azure SQL reset or the initial empty-database loader merely because a new agent does not remember that they already completed.

## Mandatory end-of-task update

For every substantive task, before the agent declares completion:

1. create a new file in `agent.Ai/updates/` using `UPDATE_TEMPLATE.md`;
2. update `PROJECT_STATE.md` if the current breakpoint changed;
3. update `TASK_CHAIN.md` if task status/order changed;
4. update `DECISIONS.md` only when the owner/architect actually changed a decision;
5. update architecture/domain/algorithm docs if an implementation or invariant materially changed.

Do not rewrite old update files. They are chronological evidence.

## Update filenames

Preferred form:

`YYYY-MM-DD-HHMM-<short-task-name>.md`

If exact time is unavailable:

`YYYY-MM-DD-<short-task-name>.md`

## Handoff completeness checklist

Every update must state:

- repository
- base branch/SHA
- working branch/SHA
- PR number if any
- task goal
- files/areas changed
- architecture/invariants affected
- tests/CI and exact outcomes
- live operations performed, if any
- live operations explicitly not performed
- blockers/unresolved questions
- exact current breakpoint
- next safe action
- things the next agent must not redo

## Safety

This continuity system never stores secrets or sensitive source records.

Do not put credentials, tokens, connection strings, private IDs, student identifiers, AFC reasons or other restricted values in these files.
