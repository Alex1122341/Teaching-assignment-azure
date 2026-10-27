# Effective Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Implement sequentially, TDD per vertical slice, then independent whole-branch review. Standing owner instruction selects recommended implementation choices and no further grilling.

**Goal:** Complete ledger26 baseline and27 actual Owner-managed SQL access with enforceable revocation and preserved scoped collaboration.

**Architecture:** SQL UserProfile owns effective access; an atomic versioned command records every permission change. SQL-authorized adapters retain surviving legacy collaboration/announcements, replacing direct Firestore privileges.

**Tech Stack:** Existing vanilla JS, Node22/CommonJS, SQL Server, Firebase Auth/Admin, existing tests and emulator; no new dependency.

**Spec:** docs/superpowers/specs/2026-10-26-effective-access-design.md

## Global constraints

- Beta/SQL explicitly selected; preserve protected downloaded folder and existing worktree; feature branch only.
- Owner-only existing-profile grants; Developer protected; no new Auth/password/course permissions, no production account/group mutations during acceptance.
- Reason, preview, rowversion, last-ready-Owner, idempotency, persisted readback and atomic audit required.
- Groups grant collaboration only. Preserve actual HICC own-membership functionality through server; sanitized names, no other Faculty contact/UCID/DOE.
- No broadening current roles, support impersonation, DOE logic, approval or Firestore rules. New access-control gate defaults false; existing27 gates unchanged.
- Bounded list1000profiles with sentinel, search and50row pages; previews10minutes,2own/8global; reason1–1000chars, JSON32KiB. Reject unsupported/duplicate input keys.

## Review focus

- Actor demoted or disabled during await: SQL recheck rejects; no write/audit partial result.
- Target goes A→B→A: rowversion rejects old preview, even matching values.
- Two Owners edited concurrently: serializable last-owner check prevents lockout/deadlock retry from double-committing.
- SQL-revoked but Firestore-privileged identity: direct rule requests denied, group/info routes deny from fresh SQL, client clears private state.
- Successful commit with response/readback failure: idempotent retry identifies same intent; never falsely reports changed access or reapplies another patch.

## Task1 — Fresh baseline and authority inventory

- [x] Pin both main refs, release/API/SQL aggregate receipts, legacy consumers, existing supported roles. Write docs/audits/2026-10-26-effective-access/{BASELINE,DIFFERENCE_LEDGER,ACCESS_MATRIX}.md. Classify historical task26 and remaining27 accurately.
- [x] Record approved decisions and sequential plan; no business writes. Preserve prior release docs as history.

## Task2 — SQL access command and Owner API

Files: server/src/access/account-access-policy.js, account-access-api.js; server/src/data/sql-account-access-repository.js; database/azure-sql/060_account_access.sql and060_account_access_acceptance.sql; server/test/account-access-{policy,api,sql}.test.js.

Interfaces: normalizeAccessPatch(input) -> {role,active,facultyId}; createAccountAccessApi({verifyToken,findUser,repository,writeEnabled,clock?,randomId?}) -> self(token),list(token,{search,offset}),preview(token,{targetUid,expectedVersion,changes,reason}),commit(token,{previewId,operationId}),history(token,{targetUid,offset}). repository.list/read/commit/history/eligibleFaculty; commit receives actorUid,actorVersion,targetUid,expectedVersion,after,reason,operationId,intentHash. Returns persisted profile and immutable operationId/audit/time, replay flag.

- [x] RED Owner/Faculty/admin/Developer allow-deny via public API; unknown fields, scope/link validation; implement minimal policy and readback.
- [x] RED preview/commit, changed actor/target, expiry/cross-owner/ABA, reason/gate and protected/self/last-owner behavior; GREEN one slice at a time.
- [x] Add SQL060 rowversion + operation receipt table + atomic stored procedure, version/reason/Owner rechecks and idempotent intent. No profile grants rewritten.
- [x] Disposable SQL acceptance must prove persisted readback + audit, conflicting retries, stale/ABA, two-Owner concurrency and rollback; add guarded workflow test integration. Do not use production for fixtures.

## Task3 — Scoped legacy server adapters and closed client boundary

Files: server/src/access/collaboration-api.js, legacy-access-store.js; server/test/collaboration-api.test.js; tests/effective-access-rules.test.js; firestore.rules; frontend/scripts/information-center.js.

Interfaces: createCollaborationApi({verifyToken,findUser,repository,store}) -> groups/list/updateMembers, Owner group save, announcement read/publish, legacyAudit read. Store uses existing Firebase Admin app, lazily; group revision is Firestore document updateTime, actor authorization checked inside transaction before write. Group DTO canonical member FacultyIds, explicit unresolved membership count/version; no contact directory for HICC.

- [x] RED SQL role mismatch/inactive/password/Owner/HICC own/cross-group; sanitized directory and no course privilege; GREEN server adapters using synthetic stores.
- [x] RED Firestore emulator direct privilege probes for every former account/group/info path; all denied. Required self compatibility reads/password path remain narrow. Preserve all historical records/audits.
- [x] Replace Information Center browser calls with SQL-authenticated server methods; test load/error/publish and role/session change. No live announcement.

## Task4 — HTTP/runtime/client and revocation

Files: server/src/runtime/swa-account-access-functions.js, swa-sql-runtime.js, swa-api/index.js; frontend/scripts/paws-data-client.js and new effective-access-guard.js; tests and server/test equivalents.

Routes /api/v1/access/self GET, /accounts GET, /preview POST, /commit POST, /history GET, /groups GET/POST, /groups/{id}/members PATCH and /announcements GET/POST. Support routes remain denied. JSON no-store, bounded closed schemas and explicit405.

- [x] RED anonymous/wrong verb/duplicate JSON/query/oversized input and support context; GREEN route wrapper/runtime/client, dedicated gate false by default.
- [x] RED next-request SQL revocation with unchanged Firebase token and client old role/faculty state; GREEN shared guard and async generation invalidation; no Firestore fallback/token role authority.

## Task5 — Effective User Management UI

Files: frontend/pages/user-management.html, frontend/scripts/user-management.js, frontend/styles/user-management.css; tests/user-management-access.test.js.

- [x] RED Owner can list/search/edit role-active-faculty link, provide reason, see before/after, confirm and persisted readback/history. Unsupported role and Developer are explicit protected/review states.
- [x] RED Faculty own-summary only, HICC own-groups with sanitized candidates; stale identity, error/retry, long names and keyboard workflows. GREEN reuse existing form/style/name/role helpers, remove misleading legacy create/bulk/forced-password grant controls.
- [x] Actual synthetic browser desktop/narrow/dark/empty/large/error and readback; no real permission mutation. Persist comparable screenshots privately. 200% CSS zoom checked as an approximation, not a claim of native browser zoom coverage.

### Implementation rulings / release dependencies

- Catalog GET supplies canonical faculty choices, supported roles and actual gate state. Dedicated accountAccess and collaboration gates default false; the preceding27 domains are unchanged (candidate total29).
- Group creation uses a caller-stable creationId; unknown, ambiguous and inactive historical members are retained. They never confer course/DOE rights. Final SQL rechecks occur after awaited directory/readback operations.
- Retiring direct Firestore access exposed active Calendar helper reads. Replace their internals with existing scoped SQL faculty APIs; the Availability entry reuses the existing lazy Faculty Availability panel, including incomplete-coverage warnings. It does not invent a second bulk availability algorithm or claim guaranteed free time. Password completion remains separate.
- The new AccessVersion column has an explicit column-scoped SELECT grant on the unbound feature role. Re-run exact-head disposable SQL after this addition.
- Server read-only credential probe on2026-10-26 returned ADC_UNAVAILABLE; process/user/machine ADC path and default ADC file absent, launcher removes FIREBASE_SERVICE_ACCOUNT_JSON from child environment. The approved server Firestore adapters therefore need trusted credential configuration and bounded live read acceptance before security cutover. This is distinct from the waived dedicated Windows SQL runtime-account requirement. Do not expose credentials in chat, invent a browser fallback, or deploy rules while HICC/info replacement access is unavailable.

## Task6 — Independent review and security acceptance

- [x] Full-branch standards/spec review; reproduce/fix actionable findings RED→GREEN. Separate independently reviewed freeze promotion preserves union and algorithms. Product179fa70, governancec17f351; three substantive fixes, no outstanding review findings. Historical emulator expectations corrected with unchanged runtime/rules;20 actual local probes pass.
- [x] Exact-head root/server/emulator/disposable SQL and build/four freezes pass at7a7ebde (Build40445289953 and six SQL workflows). Rules/app/API rollback and staged identity coverage prepared in RELEASE_CHECKLIST.md. No production acceptance writes. Production role/adapter acceptance remains Task7, gated by actual trusted credentials.

## Task7 — Controlled publication and original tracker

- [ ] Merge only accepted PR; exact-main CI official ZIP + freezes. Stage API/read-only role checks and compare all previous gates; retain old runtime/config/artifact.
- [ ] Coordinate API, Hosting and separately reviewed restrictive Firestore rules using accepted files; verify fresh source/rules identity/public hashes/SQL/CORS/recovery/normal login. Do not activate unaccepted grants or mutate real accounts.
- [x] Write original Excel26/27 with precise scope and pending human signoff, preserve native features; fresh continuity update.27 changed cells,0stylechanges;39tasks/46checks/16passed/29open/1N/A. SEC-01 completion still requires actual full acceptance above, not this plan or an explanatory UI.
