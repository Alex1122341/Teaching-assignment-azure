# PAWS Beta — Verified Source Checkpoint

**Date:** 2026-11-01. **Scope:** connected GitHub repository/PR/CI metadata, **not** live University SQL, API, browser, Firebase or private MASTER reconciliation.

## Repository and tracks

- **Beta:** `Alex1122341/Teaching-assignment-azure`, default branch `main`.
- **Verified Beta main at this documentation review:** `5752b148b1966943910e87e1cfe2c272b934b072` (PR #154 integrated). Re-fetch current `main` after this note changes.
- **PR #156:** documentation audit/cleanup on `docs/beta-markdown-audit-20261101`; initial audit head `66ce2a39de165ae4ddbec3ce036aa22db066be8f`. Its final head and checks must be re-fetched, not assumed.
- **PR #155:** open **Draft** as checked 2026-11-01; Faculty future start/create/assignment restrictions are **not** in Beta main by virtue of this PR. Do not modify or merge it during documentation cleanup.
- **PR #125:** open **Draft** as checked 2026-11-01; treat as separate work.
- **Testing/Demo:** `UCVM-Teaching-Assignment/Teaching-assignment` (GitHub Pages/synthetic browser-local data) is a different repository and not evidence of Beta SQL parity.

## Architecture and safety

- Documented Beta route: Firebase Hosting (`https://tester-teaching.web.app`) → Firebase Auth → temporary Cloudflare HTTPS ingress → University Node API → `ITAPPVETOPSDB01` / `VetMed-Ops` SQL. **No live health/deployment validation occurred during this review.**
- SQL is the Beta business-data authority; do not infer Firestore business writes or deployed SQL migrations from code/PR status.
- `AGENTS.md`, `PAWS_CONSTITUTION.md`, protected Git-object runtime freeze, role/privacy controls and all owner/review/CI/release approvals remain binding. A documentation-only merge is **not** a Hosting/API release.
- Old Azure Static Web Apps deployment guidance and September Azure SQL lab-import counts are historical. Read `docs/azure-sql-migration.md` only for the **2026-09-24 lab** provenance, not current University SQL inventory.
- The 2026-10-04 DOE/data-quality reports are **dated snapshots**. DOE Rule Book publication, Faculty-level parity with MASTER, roles, migration status and live gate values require fresh evidence; do not guess.

## Agent startup and continuity

Read root [`AGENTS.md`](../AGENTS.md), this file, exact current PR/source and only the task-specific references. Search `PROJECT_STATE.md`, `TASK_CHAIN.md`, `DECISIONS.md` or `updates/` for particular historical evidence before replaying operations. One brief handoff per substantive PR/major checkpoint is sufficient. Never rewrite original acceptance receipts.

**Documentation index:** [`docs/README.md`](../docs/README.md). **Audit/dispositions:** [`BETA_MARKDOWN_AUDIT_2026-11-01.md`](../docs/maintenance/BETA_MARKDOWN_AUDIT_2026-11-01.md).
