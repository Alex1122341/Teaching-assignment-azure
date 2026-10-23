# Dual-environment immutable freeze promotion

| | |
|---|---|
| Product anchor | `413e87fd9256fae51a8b1722bcf667d60a8a3a55` (the `feat/paws-testing-environment` product tip, after merging `main` @ `15dd739`) |
| Previous anchor | `fe1fa7002ef956f02e767053fbe2f6fea8daf748` (Dashboard History operation grouping, PR #126) |
| Superseded candidate | The earlier promotion in this PR (`1d8880a`, anchor `709e466`) was based on `main` @ `6addfb9`. Merging `main` restored main's anchor (`fcb61b1`); this commit re-promotes. |

This separate governance commit changes no product runtime bytes and adds no drift exceptions. The reporting hashes in `tools/beta-baseline.json` are derived from the product anchor's Git blobs.

**Static protection: 81 → 82.** It adds `paws-environment-nav.js`. Thirteen existing static files change: bulk-import-ui.js, developer-support.js, faculty-access.js, faculty-admin.html, faculty-admin.js, index.html, password.html, paws-api-origin.js (generated from `config/environments/production.json`, same Production values), paws-data-client.js, teaching-assignments.html, teaching-assignments.js, timetable.js and user-management.html.

**API runtime coverage: 104 → 105.** It adds `server/src/runtime/environment.js`; protected paths go from 107 to 108. Six existing API files change: data/sql-connection.js, data/write-gates.js (exposes its gate→variable map; behaviour identical), runtime/swa-sql-runtime.js, runtime/university-api.js, runtime/university-http-server.js and support/support-service.js. No SQL migration changes.

**Regression.** `tests/beta-baseline.test.js` pins the exact static/API delta from `fe1fa70`, with no dropped protected paths, no `database/` changes and anchor ancestry. The repository and the generated static/API artifacts must report zero drift.

**Reviewer note.** The anchor is a commit SHA. If `main` moves and is merged again, or the product changes, regenerate the anchor, the hash report and this regression in a new governance commit.

**Deployment prerequisite.** The promoted API requires `PAWS_ENVIRONMENT=production` on every Production API host before the next API deploy (`docs/dual-environment/03-setup-and-deployment.md` §0). Without it the runtime refuses to start, by design.
