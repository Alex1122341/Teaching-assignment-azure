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

## Current strategic priority

The immediate Azure Beta priority is **not DOE** and **not a full P3.1 Azure rebuild**.

The current priority is:

```text
Existing Azure Beta frontend
        ↓
Firebase Authentication
        ↓
PAWS backend/API
        ↓
Existing Azure SQL database
        ↓
Beta users can read real SQL-backed timetable data
```

DOE algorithm/engine development stays in the Experimental/Demo repository for now and must not be moved, redesigned or used to block the Beta connection task unless the owner explicitly changes scope.

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
