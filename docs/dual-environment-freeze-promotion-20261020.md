# Dual-environment immutable freeze promotion

Product anchor: `709e46611fdecea81c73969df98c46a3290ebf42`, the tip of the `feat/paws-testing-environment` product commits, rebased on `main` @ `6addfb9`.
Previous anchor: `846858a242cf2a96b0257822ac22d8ab6a770c94` (Faculty Lookup AFC/Leave/DOE).

This separate governance commit promotes the shared static/API baseline to the reviewed dual-environment product. It changes no product runtime bytes and adds no drift exceptions. Reporting hashes in `tools/beta-baseline.json` are derived from the product anchor's Git blobs. The Lookup governance regression now reads its own historical report instead of asserting that it is still the live anchor, the same pattern as the previous promotion.

**Static protection:** 81 → 82 files, adding `paws-environment-nav.js`. Twelve existing static files change: bulk-import-ui.js, developer-support.js, faculty-access.js, faculty-admin.html, faculty-admin.js, index.html, password.html, paws-api-origin.js (now generated from `config/environments/production.json`, with `main`'s current API origin), teaching-assignments.html, teaching-assignments.js, timetable.js and user-management.html.

**API runtime coverage:** 103 → 104 files, adding `server/src/runtime/environment.js`. Five existing API files change: data/sql-connection.js, runtime/swa-sql-runtime.js, runtime/university-api.js, runtime/university-http-server.js and support/support-service.js. No SQL migration changes.

**Regression test:** it pins the exact static/API protected delta from the previous anchor, no dropped protected paths, no migration changes and anchor ancestry. The repository and the generated static/API artifacts must report zero drift.

**Reviewer note.** The anchor is a commit SHA. If the product commits are rebased again, the anchor, the hash report and this regression must be regenerated in a new governance commit.

**Deployment prerequisite.** The promoted API requires `PAWS_ENVIRONMENT=production` on every Production API host (the University API service on ITAPPVETOPSDB01 and any ACA app) before the next API deploy. Without it the runtime refuses to start, by design.
