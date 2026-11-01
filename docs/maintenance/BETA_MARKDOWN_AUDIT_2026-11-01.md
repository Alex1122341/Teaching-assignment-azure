# PAWS Beta Markdown audit — 2026-11-01

**Source:** `Alex1122341/Teaching-assignment-azure`, `main` `5752b148b1966943910e87e1cfe2c272b934b072`. This is a GitHub source review, **not** live SQL, API or Firebase acceptance.

## Inventory

- **422 Markdown files**, **2,896,123 bytes** in the reviewed tree.
- **181** files in `agent.Ai/updates/` (historical handoff records).
- **89** specifications and implementation plans under `docs/superpowers/`.
- **16** formal audit files under `docs/audits/`.
- Long chronology: `agent.Ai/PROJECT_STATE.md` (~188 KB) and `TASK_CHAIN.md` (~158 KB).

## Current problems

1. `agent.Ai/AGENT.md` and `agent.Ai/README.md` label **2026-10-15** PR/deployment checkpoints as current, though GitHub main has advanced. Separate current source status from historical events.
2. `docs/PAWS-DOE-Data-Readiness.md` and `docs/PAWS-Data-Quality-Needs-Review.md` give **2026-10-04 SQL counts**. These are dated snapshots, not a current MASTER/DOE reconciliation.
3. `docs/azure-sql-migration.md` labels a **2026-09-24 Azure SQL lab load** as “Current post-load live state”; this is not a November live inventory for the University SQL Server.
4. Many one-off governance, freeze-promotion and intermediary integration notes repeat release evidence already in Git and substantive acceptance reports.
5. `AGENTS.md` requires full project/task history on every context restart. A concise verified current-status entry would reduce noise without deleting historical decisions.

## Candidates for removal after reference and CI verification

The following 17 notes appear superseded and have no current **exact-file** references in GitHub code search. **These are review candidates, not deleted by this audit.** Each original should remain recoverable in Git history.

- `docs/faculty-availability-archive-reconciliation-20261020.md`
- `docs/faculty-availability-history-reset-reconciliation-20261020.md`
- `docs/faculty-availability-main-reconciliation-20261020.md`
- `docs/faculty-availability-integrated-governance-20261020.md`
- `docs/faculty-availability-governance-20261020.md`
- `docs/faculty-availability-release-governance-20261020.md`
- `docs/doe-list-policy-column-freeze-20261011.md`
- `docs/doe-list-status-policy-freeze-20261011.md`
- `docs/doe-review-reasons-freeze-20261011.md`
- `docs/lookup-source-bubbles-freeze-20261011.md`
- `docs/role-periods-freeze-promotion-20261011.md`
- `docs/developer-support-freeze-promotion-20261009.md`
- `docs/login-ingress-governance-20261017.md`
- `docs/hicc-visc-directory-freeze-promotion-20261022.md`
- `docs/person-name-constitution-release.md`
- `docs/swap-doe-columns-governance-20261018.md`
- `docs/selected-schedule-export-release-20261015.md`

Combined size: **31,033 bytes**.

## Preserve

- All 181 `agent.Ai/updates/` handoffs, historical `PROJECT_STATE.md`, `TASK_CHAIN.md`, owner decisions, and the 89 historical plans/specifications until a separate provenance review is complete.
- Current `AGENTS.md`, `PAWS_CONSTITUTION.md`, `SETUP.md`, permissions and operational runbooks, database migration/rollback sources, substantive DOE acceptance, historical audit and restoration evidence.
- `docs/dashboard-history-reset-baseline-20261020.md` as a superseded **owner decision** documented in the later restoration, not a data-deletion instruction.

## 2026-11-01 source boundary

`main` is `5752b148...` (merge of PR #154). PR #155 (Faculty future activation / SQL065) and PR #125 are open **Draft** PRs, not merged into this main. No claim of SQL065 migration, Firebase hosting deployment, or real database parity follows from the GitHub PR tests.

**Proposed future simplification:** one concise current-source checkpoint for new agents, one substantive PR handoff rather than a memo per small commit, and a current documentation index pointing to dated sources. No deployment, SQL/data modification, or runtime change is authorized by this review.
