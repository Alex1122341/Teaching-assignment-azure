# PAWS Agent Continuity Memory

This directory is a **non-runtime continuity layer for AI agents and human handoff**.

It exists so that work can continue safely when a chat reaches its context limit, when a different model/agent takes over, or when a task moves between computers. Nothing in this directory is intended to be imported by the application, used as runtime configuration, or treated as a database.

## Purpose

Every agent working on PAWS Beta should be able to answer, before changing anything:

1. What repository/track am I in?
2. What is the current architecture?
3. What is the current project breakpoint?
4. Which decisions are locked?
5. Which features are intentionally out of scope?
6. Which PR/branch/commit is the active work based on?
7. What was the last agent trying to do?
8. What tests/evidence already exist?
9. What is the next safe action?
10. What must not be repeated?

## Files

- `AGENT.md` — mandatory startup and handoff protocol for every agent.
- `PROJECT_STATE.md` — latest concise project state and exact breakpoints.
- `ARCHITECTURE.md` — big-picture repository/runtime/data architecture.
- `DOMAINS.md` — domain-by-domain structure, ownership and current status.
- `ALGORITHMS.md` — important algorithms, invariants and matching/review rules.
- `TASK_CHAIN.md` — ordered workstream, completed/in-progress/next/blocked tasks.
- `DECISIONS.md` — locked decisions, superseded assumptions and do-not-reopen items.
- `UPDATE_TEMPLATE.md` — required format for every future agent handoff update.
- `updates/` — chronological append-only task updates.

## Mandatory agent behavior

If an agent starts work without reliable recent context, it must read:

1. repository root `AGENTS.md`
2. `agent.Ai/AGENT.md`
3. `agent.Ai/PROJECT_STATE.md`
4. `agent.Ai/TASK_CHAIN.md`
5. the newest file in `agent.Ai/updates/`

Then read the architecture/domain/algorithm files relevant to the task.

Before finishing any substantive task, the agent must leave an update using `UPDATE_TEMPLATE.md`.

## Evidence rule

This directory is continuity memory, **not automatically the source of truth for mutable state**.

For mutable facts such as PR heads, workflow results, live Azure configuration, SQL row counts, deployed runtime and Firestore contents:

- verify the exact current source before acting;
- if reality differs from these files, record the discrepancy;
- update this continuity layer as part of the handoff.

For architectural decisions and scope, `DECISIONS.md` and the latest owner instructions control until explicitly superseded.

## Security

Never store in this directory:

- passwords
- access tokens
- refresh tokens
- service-account JSON
- SQL connection strings
- Firebase private credentials
- UCIDs
- private Firebase UIDs
- student identifiers
- AFC reasons/details
- other sensitive source records

Use de-identified counts and decision labels only.
