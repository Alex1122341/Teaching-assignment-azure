# PAWS Beta Markdown audit — 2026-11-01

**Reviewed source:** `Alex1122341/Teaching-assignment-azure`, `main` `5752b148b1966943910e87e1cfe2c272b934b072`; documentation PR #156. This is a **GitHub source audit**, not live SQL, API, Firebase or Faculty UAT.

## Inventory and scope

- Baseline `main` inventory: **422 Markdown files**, **2,896,123 bytes**. PR #156 initially added this audit report, so its pre-cleanup branch had **423 Markdown files**. Includes 181 chronological `agent.Ai/updates/` handoffs, 89 `docs/superpowers/` specs/plans, 16 `docs/audits/` records.
- Disposition of original 17 candidates: **10 deleted**, **7 retained** after individual source reading, exact-filename GitHub code searches (no hits against the baseline default branch), later-document comparison and Git-history recoverability review.
- Verified post-cleanup Markdown inventory: **414** = 422 baseline + 1 PR audit report - 10 deleted + 1 new `agent.Ai/CURRENT.md` (complete Git tree, not truncated). The existing historical Agent handoffs, SQL migrations, rollback, security, Owner decisions and substantive acceptance records remain.
- Scope of edits: Markdown only; no protected static/API asset, University SQL, Firebase, DOE rule, Faculty source, migration or deployment changes.

## Deleted after individual provenance review

| File | Why safe to remove from the working tree |
|---|---|
| `docs/faculty-availability-archive-reconciliation-20261020.md` | Superseded by the 2026-10-21 final Availability report: SQL056 applied-once proof, protected business hashes, 241-record parity, staging and no-cutover status are recorded there. |
| `docs/faculty-availability-history-reset-reconciliation-20261020.md` | Interim History PR128 reconciliation; final Availability report and immutable Git ancestry preserve accepted PR129 restoration, no-runtime-overwrite and release boundaries. |
| `docs/faculty-availability-main-reconciliation-20261020.md` | Interim PR126/127 branch-conflict reconciliation; later merged main/History and final acceptance records supersede these temporary blockers. |
| `docs/faculty-availability-integrated-governance-20261020.md` | First intermediate integration/promotion, superseded by final Availability governance and the 2026-10-21 final acceptance report. Exact Git anchors remain recoverable. |
| `docs/faculty-availability-governance-20261020.md` | Early product/promotion proposal; product 23e35c8, disposable SQL acceptance, freeze and later corrections are consolidated in the final report. Git history preserves original review. |
| `docs/faculty-availability-release-governance-20261020.md` | Pre-final PR128 integration proposal; the subsequent 370c30a / ad24936 final report includes the accepted product and protected history. |
| `docs/doe-list-policy-column-freeze-20261011.md` | Small October 11 DOE visual-width-only freeze note, superseded as runtime status by immutable Git product c756a20 and current protected-asset checks; no DOE numeric rule or decision changed. |
| `docs/role-periods-freeze-promotion-20261011.md` | Small date-editor frozen-anchor note, superseded by current role-period documentation and immutable Git commit dfbd5bc; no schema/rollback artifact deleted. |
| `docs/hicc-visc-directory-freeze-promotion-20261022.md` | Duplicate small protection-delta note: comprehensive 2026-10-22 HICC/VISC directory document contains product/governance, source scope, SQL constraints, tests and protected delta. |
| `docs/selected-schedule-export-release-20261015.md` | Old Task03 pre-release checklist: later selected-schedule-export acceptance and governance records contain product, CI/artifact, rollback and dependency constraints. No signoff evidence was deleted. |

These were **intermediate or duplicate prose notes**, not source migration/rollback/scripts, current runtime anchors or sole acceptance receipts. Their full bytes and commit provenance remain available in Git history. The later authoritative reports above remain in the active tree. Do not infer new approval or live state from a historical cleanup.

## Retained after individual review

| File | Reason |
|---|---|
| `docs/doe-list-status-policy-freeze-20261011.md` | Retain: recorded DOE status presentation policy and provenance semantics are not fully replaced by a later authoritative UX contract. |
| `docs/doe-review-reasons-freeze-20261011.md` | Retain: detailed privacy-safe DOE Needs Review popover behavior and accessibility acceptance conditions. |
| `docs/lookup-source-bubbles-freeze-20261011.md` | Retain: explicit Owner source/reference presentation preference and its accessible UI behavior. |
| `docs/developer-support-freeze-promotion-20261009.md` | Retain: Developer Support authorization/Undo scope and SQL guard evidence. |
| `docs/login-ingress-governance-20261017.md` | Retain: login ingress security, freeze-governance and release-safety boundary. |
| `docs/person-name-constitution-release.md` | Retain: PAWS Constitution-related person-name presentation, identity constraints and original governance proof. |
| `docs/swap-doe-columns-governance-20261018.md` | Retain: substantive SWAP DOE field semantics, server authority, privacy and accepted testing evidence. |

## Agent/startup simplification

- Root `AGENTS.md` still governs constitution, privacy, service/SQL permissions, testing, immutable Git-object freeze, Graphify refresh and release. Only the mandatory reading/handoff policy is streamlined.
- `agent.Ai/CURRENT.md` is a concise **dated GitHub-only** checkpoint, linked from root and Agent guidance. It is not a live SQL/hosting status.
- `agent.Ai/AGENT.md`, `agent.Ai/README.md` and `docs/README.md` direct new agents to the short checkpoint and task-specific source; `PROJECT_STATE.md`, `TASK_CHAIN.md`, `DECISIONS.md` and all chronological handoffs remain available on demand.
- One concise handoff per substantive PR/checkpoint replaces repeated minor-commit freeze or handoff prose. A future actual Owner decision or release still requires its necessary immutable evidence and approvals.

## Dated operational warnings

- `docs/azure-sql-migration.md`: September 24 **Azure lab** workbook load, not the present University SQL state or permission to rerun a reset/import.
- `docs/PAWS-DOE-Data-Readiness.md` and `docs/PAWS-Data-Quality-Needs-Review.md`: October 4 **historical counts**, not current MASTER/DOE or Faculty parity.
- Historic Cloudflare URLs, Azure Static Web Apps wording and PR/release statements: dated evidence only. Beta architectural guardrails and approved University ingress remain subject to fresh verification.
- `docs/README.md` now indexes active setup, source maps and the retained dated acceptance/provenance reports.

## Verification requirements for PR #156

- Changed-path audit: Markdown-only, and no SQL, rollback, baseline, test, deployment or runtime asset touched.
- No exact-filename code-search references found for the original 17 candidates on baseline main. Recheck any new references before future deletion, and keep historical Git commits intact.
- Run final-head GitHub Actions **PAWS Beta Build** (including root/server/emulator/build/freeze/baseline checks) and **Azure SQL Migration Tests**. Verify their **final-head** conclusions, not previous commit CI, before merge.
- Confirm the PR actually merges, exact merged `main` and final CI; a docs-only PR does **not** request Beta API/Hosting release. No live database or Firebase action is authorized.

## PR boundaries

- This change does **not** merge, modify or deploy Draft PR #155 (Faculty future start/create/SQL065) or separate Draft PR #125.
- No claims of University SQL data parity, approved DOE policy, Firebase Hosting publication or live browser acceptance are made by this documentation update.
