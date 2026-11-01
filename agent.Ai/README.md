# PAWS Beta Agent Continuity

## Start here

- **Binding project, security, freeze and release requirements:** [`../AGENTS.md`](../AGENTS.md).
- **Latest verified source checkpoint:** [`CURRENT.md`](CURRENT.md).
- **Startup and handoff rules:** [`AGENT.md`](AGENT.md).

These are documentation-only files. They do not authorize SQL changes or prove live deployment.

## Read history only when relevant

- [`DECISIONS.md`](DECISIONS.md) — locked/superseded Owner decisions.
- [`PROJECT_STATE.md`](PROJECT_STATE.md) — extensive chronological state, **not** a guaranteed current snapshot.
- [`TASK_CHAIN.md`](TASK_CHAIN.md) — historical task sequence and breakpoints, **not** a current action queue.
- [`ARCHITECTURE.md`](ARCHITECTURE.md), [`DOMAINS.md`](DOMAINS.md), [`ALGORITHMS.md`](ALGORITHMS.md), [`WORKFLOWS.md`](WORKFLOWS.md), [`DATA_MODEL.md`](DATA_MODEL.md) — relevant domain architecture.
- [`TEST_RELEASE.md`](TEST_RELEASE.md) and root `AGENTS.md` — testing, protected baseline and publishing gates.
- [`UPDATE_TEMPLATE.md`](UPDATE_TEMPLATE.md), `updates/` — prior acceptance, handoffs and no-repeat evidence.

For a fresh task: read the root requirements and `CURRENT.md`, then verify the exact PR/code and read only the relevant policy or historical receipt. Produce one concise handoff per substantive PR or major checkpoint, not per small commit. Never silently rewrite/delete historical evidence.

Never store credentials, sensitive source records, private IDs, AFC reasons, or secrets in agent documentation.
