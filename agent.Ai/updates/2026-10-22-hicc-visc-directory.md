# Agent Update — Teaching Schedule HICC–CC / VISC directory

## 1. Goal
Replace the Teaching Schedule Course List with HICC–CC List and VISC List (read-only, minimal projection), test, govern, and prepare release. Owner brief 2026-10-22.

## 2. Starting breakpoint
- base: `main` @ `924cc6761a3b2dfba4f19c2df912436cbd965b43` (contains a46c3bd and PR #130)
- branch: `feature/hicc-visc-directory-20261022`; product `de4d3cac`, governance `d8dfcada`
- PR: not yet opened (handed to Sakib to push/open)
- open PR #125 (dual environment) overlaps freeze files; not touched

## 3. Work performed
Inspection/reuse report, new API module + repository + status module + route, UI module/CSS, Course List removal, tests, LocalDB SQL check under the runtime read role, headless responsive acceptance, governance promotion, release manifest. See `docs/hicc-visc-directory-20261022.md`.

## 4. Files / components changed
Static: index.html, timetable.js, paws-data-client.js, leadership-directory.js/.css, tools/static-assets.json. API: server/src/roles/{leadership-directory-api,role-effective-status}.js, server/src/data/sql-leadership-directory-repository.js, server/src/runtime/swa-leadership-directory-functions.js, swa-sql-runtime.js. Governance: tools/beta-freeze.js, tools/beta-baseline.json, tests.

## 5. Architecture / invariants affected
Preserved: SQL authority, server-side authorization, admin Roles endpoint unchanged, no write gate, no migration, no Firestore. New read route under /api/v1/dashboard (Developer Support compatible).

## 6. Data / algorithm changes
Authorization: all supported active accounts may read the directory projection. Status rules mirror faculty-role-periods.js (parity test). No DOE, role-edit, or data change.

## 7. Tests / CI evidence
Linux root 1036/983 pass/1 env fail/52 skip; server 842/832/5 env fail/5 skip — same env failures as main 924cc676. Windows root 1036/984 pass/0 fail/52 skip; Windows server 842/835/3 Docker fail/4 skip. LocalDB SQL check pass. UI 8/8 layouts pass. Emulator NOT EXECUTED. GitHub Actions not used (per brief).

## 8. Live operations
### Performed
None. LocalDB PAWSTestSim on the developer laptop only (rolled-back transaction).
### Explicitly NOT performed
No push, merge, production SQL read, API stage/cutover, Firebase deploy, recovery change, SQL data change.

## 9. Current state after task
Candidate ready for Owner review; production release BLOCKED on Owner access/authorization (see doc §5).

## 10. Blockers
Live SQL reconciliation, stage/cutover on ITAPPVETOPSDB01, Firebase Hosting deploy, independent governance review, merge order with PR #125.

## 11. Exact breakpoint
Branch committed locally; Sakib to push `feature/hicc-visc-directory-20261022` and open the PR.

## 12. Next safe action
Owner review; run `tools/leadership-directory-reconcile.sql` on production (read-only); follow doc §5 release sequence.

## 13. DO NOT REDO
Do not widen /api/v1/dashboard/roles; do not map the legacy combined role label; do not infer dates from the academic year.

## 14. Suggested next-agent prompt
"Read docs/hicc-visc-directory-20261022.md and continue the release from §5 after verifying the PR head."
