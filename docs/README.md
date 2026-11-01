# PAWS Beta documentation index

**Start here:** [`SETUP.md`](../SETUP.md) for repository setup; [`AGENTS.md`](../AGENTS.md) and [`agent.Ai/CURRENT.md`](../agent.Ai/CURRENT.md) for binding agent rules and a **dated, source-verified** checkpoint. Neither is a live runtime attestation.

## Active references

- [Repository layout and boundaries](architecture/repository-layout.md)
- [PAWS Constitution: person-name presentation](../PAWS_CONSTITUTION.md)
- [Architecture and domains](../agent.Ai/ARCHITECTURE.md) / [domain map](../agent.Ai/DOMAINS.md)
- [Agent startup and handoff](../agent.Ai/AGENT.md) / [locked decisions](../agent.Ai/DECISIONS.md)
- `operations/`, `sql/`, and `../deploy/windows/` — review relevant operational/SQL evidence before any live action.
- `superpowers/specs/` and `superpowers/plans/` — dated specs/plans; not direct authorization to execute.

## Dated evidence — **not current live state**

- [2026-09-24 Azure SQL lab import](azure-sql-migration.md) — historical lab-only source migration; never replay into University SQL.
- [2026-10-04 DOE data-readiness audit](PAWS-DOE-Data-Readiness.md) — historical DOE counts, **not** an up-to-date MASTER reconciliation.
- [2026-10-04 data-quality report](PAWS-Data-Quality-Needs-Review.md) — historical issue counts, not today's work queue.
- [2026-10-21 Faculty Availability acceptance/release report](faculty-availability-acceptance-release-report-20261021.md) and [local-release authorization](faculty-availability-local-release-authorization-20261021.md) — dated evidence and release boundaries.
- [2026-10-22 HICC–CC/VISC directory design and verification](hicc-visc-directory-20261022.md).
- [2026-10-15 selected schedule export acceptance](selected-schedule-export-acceptance-20261015.md) and [governance review](selected-schedule-export-governance-20261015.md).
- [Historic Azure frontend retirement audit](azure-frontend-retirement-audit-20261022.md) — legacy references may remain for University API/build compatibility.
- `performance/`, `audits/`, and [`agent.Ai` history](../agent.Ai/README.md) — chronological records, not automatically current.

## Maintenance

- [2026-11-01 Markdown audit and file-by-file deletion decisions](maintenance/BETA_MARKDOWN_AUDIT_2026-11-01.md).
- Delete only verified redundant notes; keep SQL migration/rollback, security, Owner decisions, substantive acceptance evidence and historical Agent records. Verify exact PR CI, runtime freeze, and source status before a release.
