# Effective Multiple Teaching Roles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans. The owner chose sequential implementation and independent final review; do not dispatch implementation agents or restart grilling.

**Goal:** A Faculty account can concurrently exercise explicitly granted, dated HICC/course and VISC/area responsibilities without gaining unrelated access.

**Architecture:** Reuse the existing SQL responsibility/assignee/course/group graph. Add a pure effective-role policy and scoped identity reads, versioned/audited Owner leadership grants, and per-package capability checks. Preserve BaseRole, global administrators, existing approvals, legacy collaboration ownership and DOE.

**Tech Stack:** Existing Node22/CommonJS, SQL Server, vanilla HTML/CSS/JS, Firebase Auth and retained server-only Firestore collaboration store. No new dependencies.

**Spec:** docs/superpowers/specs/2026-10-27-effective-multiple-teaching-roles.md

## Global constraints

- Same PR148, Teaching-assignment-azure/Beta/SQL; feature worktree only.
- Tim remains Faculty, HICC/CC only VTMD505, VISC only Bovine, AY2026–27 and2026-05-01 through2027-04-30 inclusive with explicit default provenance for missing CC dates.
- Canonical SQL mappings grant authority; names, DOE, source text and collaboration memberships do not.
- Missing/ambiguous/inactive mappings fail closed; no production test identities/packages or business fixtures.
- Preserve Owner/Administrator/Developer boundaries, privacy, stale previews, atomic audit/readback, existing27 gate values, effective scope revocation and immutable historical freezes.
- No real grant application before the exact configuration preview and command/recovery acceptance. No cutover until full acceptance; existing user permission authorizes the bounded Tim configuration, not other scope changes.

## Review focus

1. A dual-role user sees both permitted action kinds but cannot self-approve a prohibited prior action or use another package's scope.
2. Expiry/midnight Calgary, changed academic year and absent periods revoke capabilities without waiting for a new Firebase token.
3. Assignee or scope changes A→B→A invalidate prior preview and pending private results.
4. A mixed-course package, unrelated area or historical acceptance responsibility never broadens the approved505/Bovine mapping.
5. A lost grant-command response retries one operation; recovery preserves historical operations/audits and does not replace other grants.

### Task1 — Pure effective teaching authority and identity contract

**Files:** Create server/src/access/effective-teaching-access.js and server/test/effective-teaching-access.test.js. Identity-loader integration follows the versioned SQL foundation in Task2/3.

**Interfaces:** deriveEffectiveTeachingAccess({profile,assignments,academicYear,asOfDate,authorityVersion}) returns {baseRole,effectiveRoles,responsibilities,scopeVersion}. Trusted rows carry canonical FacultyId, assignment/responsibility IDs, kind, year, dates, course/group scope and immutable version tokens. The retained authority epoch invalidates even empty→grant→empty snapshots. effectiveRoles never rewrites profile.baseRole. Public self output contains own scoped descriptors only; no other faculty contact/DOE/HR.

- [x] RED combined Faculty+HICC+VISC, wrong person/year/course/group, missing scope/date, future/expired/end-exclusive dates, protected/global base roles and scope-version changes. Observed missing-module failure before implementation.
- [x] GREEN smallest pure policy without wiring unfinished SQL/API behavior.9/9 pass; base role remains unchanged and canonical course/group checks are explicit.
- [x] Existing access/collaboration plus new policy30/30 pass. Identity/API/HTTP scope and cached-binding tests follow in Task3 after SQL schema versions exist. No live-role completion claim from this pure slice.

### Task2 — SQL leadership grant/version/audit command

**Files:** Create database/azure-sql/061_effective_teaching_access.sql and062_leadership_access_commands.sql, their disposable acceptance and guarded rollbacks; reuse tools/test-account-access-sql.ps1 through test-teaching-access-sql.ps1 and extend Account Access workflow markers; add server/src/data/sql-leadership-access-repository.js, leadership-access-api.js and tests. Add bounded parameterized identity-loader queries over the resulting canonical/versioned graph; no source-label matching.

**Interfaces:** read/list scope catalog and preview grant intent; commitLeadershipAccess({actorUid,actorVersion,targetUid,targetVersion,academicYear,grants,reason,operationId,intentHash,definitionVersions}) returns persisted audited receipt. Owner-only preview/commit is separate from the060 base-role command. Explicit canonical responsibility, course/area/date definitions and assignee changes are versioned.

Earlier Task2 slice: exact eba55ebfbe54ac6f3171c57a26c103b5b05a29ed SQL run40605457721/job122543708622 passes27 markers, including concurrent intent serialization and recorded VISC area/date bounds. A subsequent actual failing SQL test reproduced implicit definition widening; hardened061/062 now also bind the approved semantic scope and exact assignee window, with complete recovery values. Fresh hardened061–063 actual proof is required before Task2/3 acceptance. The own identity composer is now mounted for access/self and Teaching Assignments, queue/capability/rechecks implemented;991full server pass/0fail/7skip before latest additions. Source/migration changes are not live. Keep061 foundation/062 commands/063 workflow separately recoverable and preserve ScheduleVersion.

- [x] RED scope/grant/source collisions, grant and revoke atomicity, A→B→A for assignee and scope metadata, actor revocation, concurrent commands, conflicting/replayed UUID, response loss, protected Developer and used rollback. SQL command acceptance initially failed with missing command before implementation; source/date/scope/recorded VISC and concurrent cases now run in real disposable SQL. Response-loss handling is exercised through the actual API boundary and persisted-operation recovery.
- [x] Implement additive schema/procedure/version maintenance using existing responsibility/assignee tables. Preserve Date storage convention, profile values, old scopes and existing audit. Refuse unknown existing principals/schema and unreviewed scope widening.
- [x] Hardened061–063 actual disposable SQL passed all34 markers at327b4aabdd5aac94b2f8564d1d13accc02854ff7, run40610807118/job122561576272, including exact empty/used recovery. Later Task4 catalog/history edits require fresh35-marker proof; the34-marker result is historical for those newer bytes. Never run fixture/acceptance SQL on VetMed-Ops. Final whole-branch product/governance review remains Task5.

### Task3 — Teaching Assignments and SWAP use explicit multiple responsibilities

Implementation progress: reuse the versioned account profile reader for current own identity rather than duplicating UserProfile SQL in another reader. Self/workflow runtime, role gates, one SQL union queue, per-package capabilities and awaited profile/package/history/SWAP/DOE-preview rechecks are implemented/tested. SQL063 actual mixed/self-review/expiry/SWAP ownership and exact rollback proof passed at327b4aa. Task4 client/UI followed in0deedde; live Tim mapping and final release acceptance remain later tasks.

**Files:** server/src/teaching-assignment/teaching-assignment-api.js, server/src/data/sql-teaching-assignment-workflow-repository.js, SQL061 replacements of affected authority functions/procedures, server/src/swap/swap-api.js if its checks require change, and related server/test files.

**Interfaces:** API actor keeps baseRole and effectiveRoles; work queue unions HICC/VISC scope, package read returns canDraft/canSubmit/canReview/canFinalSubmit. SQL CanActOnTeachingAssignmentPackage remains the final package authority. SWAP consumes the same explicit ownership graph.

- [x] Wire the accepted authority loader through the existing versioned sql-account-access-repository profile reader and runtime identity composer, rather than duplicating an unversioned UserProfile query in sql-user-repository. Public self/API/HTTP tests cover own descriptors and changed scope fingerprints; account AccessVersion is preserved.
- [x] RED baseFaculty with two assignees gets both permitted queues, unauthorized/mixed scope denied, duplicate queues deduplicate, expired/current-year changes, prohibition of self-review where applicable, and stale revision behavior unchanged.
- [x] Replace BaseRole-only exclusions with trusted effective capabilities, never user-requested role/context. Preserve office/global checks and exact SQL rechecks; unknown ownership stays denied.
- [x] Workflow/SWAP regressions and the34-marker disposable SQL core proof pass. Subsequent Task4 history has its own new35-marker gate; no release claim from the older core proof.

### Task4 — Collaboration, client invalidation and UI

**Files:** server/src/access/collaboration-api.js; frontend/scripts/{paws-data-client,effective-access-guard,user-management,teaching-assignments,faculty-access}.js; frontend/pages/user-management.html; matching existing CSS/tests.

**Interfaces:** own self scopeVersion participates in guard comparisons; role helpers accept effective roles without changing old base-role classification. Owner can preview explicit dated leadership grants; Faculty self shows own roles/scopes; package actions use returned capabilities. HICC group ownership remains exact UID.

- [ ] RED multi-role own summary/role labels, current-year changes, capability-based buttons, scope fingerprint revocation, sanitizer, no-owned-group empty state and VISC-only group deny. Test actual handlers and user flow.
- [ ] GREEN reuse current tables/forms/name helpers, no new bundles/eager imports. Keep Owner grant reason/preview/confirm/readback and unclear outcomes visible.
- [ ] Actual-app synthetic desktop/narrow/keyboard/error/long text plus normal Tim login; no business mutation. Compare screenshots and console. Commit.

### Task5 — Tim mapping preview and independent review

**Files:** trusted CLI/release tooling and docs/audits/2026-10-26-effective-access/; no hardcoded Faculty identity in runtime.

- [ ] Resolve exact current profile/Faculty/source IDs and versions, canonical505 and Bovine definitions. Keep historical P2 responsibilities and Firestore ownership untouched. Do not invent real packages or session-area associations.
- [ ] Generate exact reasoned preview: baseFaculty retained, two scoped grants, inclusive dates and default provenance; show all creates/updates/retained entries, hash and recovery plan. User's explicit505/Bovine scope authorization persists; stop only on an actual mismatch or broader data change.
- [ ] Request one independent whole-branch standards/spec review, reproduce/fix actionable issues. Commit reviewed product, then separately reviewed immutable freeze promotion with exact manifest/API counts and historical unions intact.

### Task6 — Final acceptance, coordinated release and original workbook

- [ ] Exact-head root/server/emulator and all isolated SQL workflows, build, four freezes and official ZIP digest verification. Earlier8311 evidence does not verify new runtime bytes.
- [ ] Stage reviewed migration/API with old runtime/config/rules/recovery backup. Apply only the requested grant intent transaction; verify exact persisted scope/readback/audit and other grants/DOE/business data preserved. Do not apply acceptance fixtures.
- [ ] Normal Tim login demonstrates Faculty plus505 HICC/CC and Bovine VISC, scope and expiry negatives from isolated tests, actual authorized read/deny smoke. Preserve unconfigured area/session gaps explicitly.
- [ ] Merge accepted PR, fresh exact-main official package/checks, coordinated API/Hosting/separate restrictive rules, public hashes/gates/SQL/CORS/recovery. Update original Excel26/27 and continuity; human business signoffs remain unsigned.

## Self-review and execution

Each scope/version/date/recovery requirement has a test-owning task. Responsibility graph reuse avoids a second grant authority; business appointment evidence stays distinct. Sequential execution and final independent review are the previously selected method. Continue under the owner's explicit scope approval and standing recommendation authority; do not ask them to choose the same execution method again.
