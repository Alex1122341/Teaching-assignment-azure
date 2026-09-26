# PAWS Agent Update Template

Copy this into a NEW file under `agent.Ai/updates/`.

Do not overwrite an older update.

---

# Agent Update — <task name>

**Date:** YYYY-MM-DD  
**Agent/model:** <model>  
**Repository:** <owner/repo>  
**Task status:** COMPLETE / PARTIAL / BLOCKED / READ-ONLY REVIEW

## 1. Goal

What exactly was this task supposed to accomplish?

## 2. Starting breakpoint

- base branch:
- base SHA:
- working branch:
- starting SHA:
- PR:
- relevant prior update:
- live environment assumptions:

## 3. Work performed

Concise list of actual actions.

Separate:

- code/docs changes;
- analysis/review;
- live reads;
- live writes;
- deployment/release actions.

## 4. Files / components changed

List important paths and what changed.

If no files changed, say so.

## 5. Architecture / invariants affected

State whether this task:

- preserved existing architecture;
- changed an invariant;
- introduced a new decision;
- superseded an earlier decision.

If a decision changed, also update `DECISIONS.md`.

## 6. Data / algorithm changes

Record any change to:

- identity matching;
- normalization;
- session grouping;
- authorization;
- workflow state machine;
- concurrency/versioning;
- DOE;
- AFC;
- publication;
- migration logic.

If none, say none.

## 7. Tests / CI evidence

Include exact:

- test command/workflow;
- run number if known;
- pass/fail counts;
- head SHA tested.

Do not just say “green”.

## 8. Live operations

### Performed

State exact live mutations, if any.

### Explicitly NOT performed

Examples:

- no SQL writes;
- no Firebase mutation;
- no deployment;
- no merge;
- no reset;
- no DOE changes.

## 9. Current state after task

- final branch:
- final SHA:
- PR:
- merge/deploy state:
- relevant live counts/state if reverified:

## 10. Blockers / unresolved questions

List only genuine unresolved items.

## 11. Exact current breakpoint

One paragraph describing where the next agent should resume.

## 12. Next safe action

Give the next task in executable terms.

## 13. DO NOT REDO

List completed/destructive/expensive actions the next agent must not repeat.

## 14. Suggested next-agent prompt

Optional but recommended for complex handoffs.

Keep the prompt tightly scoped to the current breakpoint.
