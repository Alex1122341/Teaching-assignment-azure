# Documentation map

- [Repository organization](architecture/repository-layout.md): current source folders, shared build behavior and safety boundaries.
- [Azure frontend audit](azure-frontend-retirement-audit-20261022.md): prior cleanup and remaining non-database cloud deployment work.
- `operations/`, `sql/` and `../deploy/windows/`: operational evidence and reviewed server/SQL procedures.
- `superpowers/specs/` and `superpowers/plans/`: dated specifications and implementation records; check current Owner decisions before executing historical plans.
- `performance/`: preserved historical reports, not new benchmark claims.
- Other dated reports preserve release, acceptance and governance evidence. They are not executable instructions for a new release.

Current active setup: [SETUP.md](../SETUP.md). Agent instructions and chronology: [AGENTS.md](../AGENTS.md) and `../agent.Ai/`.

**2026-11-01 documentation audit:** [Beta Markdown review](maintenance/BETA_MARKDOWN_AUDIT_2026-11-01.md) inventories 422 files and identifies historical notes for conservative pruning. This audit does not verify live SQL, authorize deleting migration evidence, or deploy an application. Old 2026-10 checkpoints are dated historical snapshots; verify current PR/release status from GitHub and the live system.
