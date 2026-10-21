# Agent update — PR130 release order decision and SQL 057 fixture arithmetic

**Date:** 2026-10-21
**Agent:** ChatGPT GPT-6 (source inspection and GitHub patch only)
**Repository:** Alex1122341/Teaching-assignment-azure
**Task status:** PARTIAL / NOT RELEASED

## Goal and starting breakpoint

Assess independently whether PR125 or PR130 should be merged first, review PR130 release-preflight evidence and close any demonstrable code/test defects. PR130 was Draft at `7540d64f0f00535b55ebb330cc571d506cf20618`, main `a46c3bd9075af146177b7a0b614a4955e829c2fd`. PR125 was open, non-draft, not mergeable, latest `2994c73df92d1e692aa28094bb5c1ceec72403c8`; both had zero GitHub formal reviews.

## Work performed

- Verified via GitHub connector that PR125 and PR130 overlap on exactly 12 files, including `tools/beta-freeze.js`, `tools/beta-baseline.json`, `tools/static-assets.json`, frontend entry points and frozen source checks.
- Inspected PR125 readiness documentation: Testing infrastructure not provisioned, additional production launcher env requirement, LocalDB-only earlier source tests; PR125 is not release-ready.
- Inspected PR130's newly authored SQL057 disposable acceptance fixture and found a definite unexecuted fixture defect. There are 12 synthetic CCC rows: 10 belong to 2026-27 after excluding next year's row and an inactive-faculty row. The fixture asserted only 9 rows in 8 assertions. Its existing static guard checked referenced names/columns but not arithmetic.
- Committed correction `f12d9e96421b712a8615043882e0cca33656a8f1` to original PR130 branch: updated the SQL acceptance comment, all eight expected counts to 10, and added a static cardinality regression test deriving the expected count from fixture dates and active state.
- Executed a deterministic JS source-inspection preflight against the retrieved SQL fixture before commit: 12 rows, 10 active in academic year, 8 consistent expected-cardinality checks. This is **not** an actual Node test-suite execution or SQL Server acceptance.

## Release sequencing recommendation

**PR130 first, PR125 second**, provided PR130 independently completes SQL057 actual execution, product/security and freeze governance approvals, and a PR130-specific CI billing alternative authorization (or CI resumes). PR130 is a small additive read-only feature with complete reported Node22 suites and approved-source-independent pending gates. PR125 is larger, nonmergeable and lacks its proposed Testing infrastructure and owner UAT. This ordering avoids forcing a new CCC freeze promotion before CCC's first release.

After PR130 is merged, PR125 must not simply rebase and resolve textual conflicts: recompose its product changes against accepted main, produce a new product anchor and separate governance promotion covering the union, and rerun full suites and environment UAT. Never let either merge overwrite the other's manifest/anchor/historical receipts.

## Files changed

- `database/azure-sql/057_ccc_schedule_read_acceptance.sql`: correct fixture expectations (10 instead of 9).
- `server/test/ccc-schedule-sql-acceptance.test.js`: new arithmetic guard for fixture coverage.
- This update document.

No changes to protected static/API runtime bytes, migrations 001–057 product SQL, DOE, Availability, CCC live records or freeze anchors.

## Tests and live operations

Previous executor reported root 1025 total / 1006 pass / 19 skip / 0 fail; server 817 total / 813 pass / 4 skip / 0 fail; static 85/API110 artifact freeze zero drift at older head `7540d64`. These numbers have not been rerun against `f12d9e` and may not be presented as exact-head acceptance.

No live writes, SQL migration, database reset, Firebase Hosting deploy, PR merge, formal review or production cutover.

## Outstanding blockers / next safe action

1. Run the updated `server/test/ccc-schedule-sql-acceptance.test.js` and actual SQL057 disposable acceptance + rollback on an approved isolated SQL Server, not production. The scripted full SQL acceptance remains untested.
2. Obtain independent review/approval of PR130 accepted product commit `5b135df...` and governance commit `1193335...`, including the new acceptance test change.
3. Resume GitHub CI after billing is repaired or explicitly authorize an owner-approved PR130 local acceptance replacement.
4. Coordinate exact-commit merge/deployment after those gates, then independently re-anchor PR125 to the newly accepted main.

**DO NOT REDO:** do not run SQL reset harness on production or reapply migrations 001–056; do not weaken freeze tests, self-approve independent review, merge PR125 ahead of PR130, or claim SQL acceptance without execution.
