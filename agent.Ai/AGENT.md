# PAWS Beta — Agent Startup and Handoff

## Minimum startup (in order)

1. Read the root [`AGENTS.md`](../AGENTS.md) for binding security, privacy, approvals, protected runtime and release gates.
2. Read [`CURRENT.md`](CURRENT.md) for the most recently **source-verified** repository status, with an explicit date and scope.
3. Verify the task's exact GitHub PR, branch, head SHA, CI, and the relevant current code/tests before modifying anything.
4. Read the **specific** spec, policy, owner decision or runbook needed for the change. Use [`DECISIONS.md`](DECISIONS.md), [`PROJECT_STATE.md`](PROJECT_STATE.md), [`TASK_CHAIN.md`](TASK_CHAIN.md), and `updates/` only for a needed historical detail or prior operation.

Do not require full historical records at every restart. Do not restart architecture from scratch simply because the chat context is new.

## Authority and evidence

Latest explicit Owner direction and verified live state govern operational decisions. Verify PR, CI, deployed version, SQL counts and gate values afresh. Exact requested source and binding decisions outrank dated reports. `CURRENT.md` is a **GitHub source checkpoint**, not proof of the live University environment.

Keep **Experimental / GitHub Pages Demo** separate from **Beta / University SQL**. A code feature, a merged PR, a published artifact and live acceptance are four different states. Do not infer SQL migrations, DOE approval, Firebase publication or Faculty data changes from source files alone.

## No-repeat and safety

Before any repeat migration, reset, import, credential/role change, deployment or merge, consult the exact prior receipt in `updates/`/`PROJECT_STATE.md`, inspect the live target and obtain applicable authorization. Never replay an already accepted SQL migration because a session lacks context. Never bypass frozen runtime/baseline protections, release reviews, role/privacy boundaries, or required tests. Follow the root `AGENTS.md` and `PAWS_CONSTITUTION.md`.

## End of substantive PR / checkpoint

- Record exact repository, PR/head/base, changes, test/CI evidence, current release state, blockers and the next safe step in **one concise handoff** if needed.
- Refresh `CURRENT.md` when verified repository state advances. Update `DECISIONS.md` **only** for an actual Owner decision; update architecture docs only when the contract changes.
- Preserve older `updates/`, `PROJECT_STATE.md` and `TASK_CHAIN.md` as chronological history. Do not add one note per small commit or make every agent reread the full chronology.
- Never put secrets, connection strings, private identifiers, student records, AFC reasons or other confidential source values in handoffs.
