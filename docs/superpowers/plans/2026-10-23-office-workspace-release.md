# Office workspace integrated release implementation plan

> **For agentic workers:** Use superpowers:executing-plans, sequential implementation and one fresh whole-branch review. The owner explicitly chooses recommended routine options and continuous execution; do not pause for routine plan approval.

**Goal:** Complete Dashboard/Assignments navigation and produce an integrated, reviewable candidate meeting merge/release gates.

**Architecture:** Generalize presentation options in the existing navigation module; one office adapter moves existing route/header nodes and syncs authorized visibility from validated page profiles. Original page controllers retain all data/workflow authority.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, node:test, current deterministic static/release builders and Git-object freezes; no dependency.

**Spec:** docs/superpowers/specs/2026-10-23-office-workspace-release-design.md

## Global Constraints

- Calendar remains universal normal home; explicit authorized URLs and password requirements preserved.
- Last name, First name uses existing shared formatter; original identity/audits/PDFs unchanged.
- Preserve main8bb40c6 Role & Appointment repairs and all API/SQL bytes; no live writes/migrations or permission changes.
- Preserve64px/224px navigation, narrow drawer, existing lazy/data boundaries and separate immutable governance promotion.
- No Demo mock data/business logic or new production destinations; synthetic fixtures stay private.

## Review Focus

1. Identity/profile changes during load: privileged entry cannot remain visible or actionable after lock.
2. Drawer resize with an open native business dialog: modal remains usable and return focus stays on-screen.
3. Formal/legacy roles differ between real routes: new helper must match existing Assignments admission exactly, without widening it.
4. Long names, many tabs, dense numeric tables and200% text: no lost actions or whole-page horizontal overflow.
5. Concurrent main changes: role serialization/SQL fix and old immutable receipts must survive integrated promotion.

### Task1: Preserve current main in integrated source

**Files:** tests/workspace-release-integration.test.js; merge-conflicted governance/history/continuity files only.
**Interfaces:** consumes main8bb40c6 and PR139/138fdc1; produces a merge ancestry preserving both histories, with main governance retained until Task5.

- [ ] Add failing tests for main ancestry, no API/SQL diff against main, and byte-identical faculty-role-periods.js plus058 SQL.
- [ ] Run `node --test tests/workspace-release-integration.test.js`. Expected RED on pre-merge branch.
- [ ] Merge origin/main without auto-commit; preserve main active freeze and both historical UI/role receipt tests. Resolve continuity by retaining both histories and a new current header. Commit integrated product.
- [ ] Run integration and role-period focused tests. Expected0 failures; active freeze drift is intentional until final product promotion, never bypass it.

### Task2: Shared shell options and office adapter

**Files:** frontend/scripts/workspace-navigation.js; new frontend/scripts/office-workspace.js; frontend/scripts/faculty-access.js; tests/workspace-navigation.test.js; new tests/office-workspace.test.js.
**Interfaces:** navigation.mount gains optional pageTitle/shellClass/backgroundSelector/measureHeader; existing defaults stay identical. office.mount({document,window,page}) returns sync(profile), preserving original nodes. Shared canOpenTeachingAssignments(profile) matches current route admission.

- [ ] Add failing tests for custom title/shell/background, original Schedule defaults, real-node identity/idempotence, route-role matrix, lock/identity switch, no I/O or fake routes.
- [ ] Run targeted suites and observe missing adapter/options RED.
- [ ] Implement optional presentation parameters and office adapter with existing route nodes/handlers and shared helpers. No page business controls move into global navigation.
- [ ] Run new plus landing/auth/helper tests. Expected0 failures; commit product slice.

### Task3: Wire Dashboard and Assignments

**Files:** frontend/pages/faculty-admin.html, teaching-assignments.html; frontend/scripts/faculty-admin.js, teaching-assignments.js; frontend/styles/workspace.css; tools/static-assets.json; corresponding existing page tests.
**Interfaces:** validated profile invokes office.sync(profile); every gate/lock invokes office.sync(null). Current handlers own views, self-mode, permissions and API calls.

- [ ] Add failing wiring/auth-state tests: modules load first, lock hides rail, Faculty self-mode/admin tabs unchanged, Assignments capabilities and route defaults unchanged, no doubled listeners.
- [ ] Implement controller hooks and scoped office layout/table/control rules; add office-workspace.js and faculty-route-access.js to allowlist89→91.
- [ ] Run office/page/auth/assignment/role-period/asset tests. Expected0 failures; commit product.

### Task4: Browser and real read-only acceptance

**Files:** private generated-route fixture preview and screenshots; docs/ui living assessment/evidence.
**Interfaces:** actual generated assets; private fixture startup replaces only data/auth and blocks real mutations. Authenticated acceptance uses existing University API with server authority.

- [ ] Capture matched before/after at1440/1280/768/390, inspect dark/long/large/empty/loading/error and native200% text if supported; exercise search, tabs, focus, Escape and resize.
- [ ] Fix material findings with RED→GREEN regressions, retaining route guards and data semantics.
- [ ] Use RDC to verify current live API/source/gates read-only; check Faculty self/admin reads and401/403 without writing or disclosing credentials. Record precise execution and limits.

### Task5: Integrated governance and full verification

**Files:** separate tools/beta-freeze.js, tools/beta-baseline.json and scoped governance tests/receipt after final product commit.
**Interfaces:** final product includes main plus UI;91 static assets,115 API runtime files plus3 inputs protected by full current/frozen manifest union.

- [ ] Commit final product, then separately promote its immutable Git object. Preserve historical anchors and enforcement algorithm.
- [ ] Run targeted tests, `npm test`, server suite and emulator coverage as required/available; `node tools/build-beta-release.js`; all four static/API source/artifact freezes. Expected0 failures with exact source and artifact evidence; no invented CI result.
- [ ] Request fresh independent whole-branch product/governance review. Fix Important/Critical findings with failing regressions and complete verification.

### Task6: PR and release readiness

**Files:** release acceptance/rollback manifest, living assessment, agent.Ai update/state/chain; focused integrated PR.
**Interfaces:** exact reviewed HEAD and artifact hashes, current main, mandatory CI or owner-authorized equivalent evidence.

- [ ] Recheck main, preserve concurrent work, publish integrated draft PR targeting main and attach it. Existing136/139 remain traceable until supersession is established.
- [ ] Verify required checks or prepare an exact-head cloud verification prompt if usage/environment blocks them. Do not claim missing gates pass.
- [ ] Prepare static-only Hosting/API-compatibility rollout and rollback from verified current live state. Record no business-data mutations.
- [ ] Update all continuity and evidence; mark ready only when required technical/role/browser/integration checks are complete. Merge/publication status is explicit and never inferred from a candidate build.

## Self-review

Tasks1→5 share immutable product ancestry; Tasks2→3 share only presentation sync and native nodes; Task4 can reveal product fixes before Task5. All review focus items have test/browser ownership above. User-directed autonomy replaces routine approval pauses, not production authorization or evidence requirements.


Implementation ruling: Dashboard explicitly prohibits loading legacy faculty-access.js. Reuse its capability contract through a pure faculty-route-access.js projection with matrix parity; legacy helper delegates when that projection is present. Office pages load only the pure module, navigation and adapter. Preserve the existing legacy/Firestore bans. Three explicit local presentation modules increase Dashboard script elements27→30; controller sync hooks require a bounded60300-byte limit (prior60000, actual60172). No dependency, data fan-out or business authority is added.
