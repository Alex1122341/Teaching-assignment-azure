# P3B4 — Approved AFC PDF Artifact Implementation Plan

**Status:** Plan prepared for owner approval. No runtime implementation or SQL migration has started.
**Specification:** docs/superpowers/specs/2026-10-04-p3b4-afc-approved-artifact.md
**Branch:** feature/p3b4-afc-approved-artifact
**Current branch head:** 3a4bfb8566c4e904cf013c9f2c4fefb0dc953b95
**Current P3B3 source head:** 7eb0514976e0c09caa070dd7455266b541b1984a

## Goal

Implement the approved artifact design as a review-only candidate on the P3B4 feature branch. For one finally approved AFC request, the authenticated University API will render a PDF from SQL-authoritative request and approval evidence, atomically store it once in SQL, and return those stored bytes only to an authorized caller. Retrying or racing requests returns the same immutable artifact.

## Approval and scope gates

- This plan itself requires explicit owner approval before any runtime code, tests for runtime behavior, dependency changes, or SQL migration are written.
- After plan approval, the first implementation action is to synchronize the latest P3B3 branch into P3B4 with a normal history-preserving merge; do not rebase or rewrite shared history.
- All implementation and SQL migration files remain on feature/p3b4-afc-approved-artifact. Migration 011 is never applied to VetMed-Ops in this plan.
- No live SQL reads or writes, SQL grants, runtime-identity changes, Firebase/Firestore/Azure/Cloudflare changes, deployment, merge to main, frontend cutover, or PR merge is included.
- Do not add test identities, production sample data, public storage, signed URLs, or a second AFC workflow authority.
- Never log PDF bytes, signatures, signature images, AFC reasons, or source snapshots.
- Use no browser-supplied user identity, FacultyId, role, status, approval, template, or PDF bytes as authority.

## Contracts fixed by the approved specification

- Route: authenticated POST /api/v1/afc/requests/{uuid}/approved-artifact; the request body must be empty.
- Only an active SQL profile with MustChangePassword = 0 may proceed. SQL rechecks that the request is finally approved and the caller is the requester, a Firebase UID on an actual approved paws.AfcApproval stage, or an active administrator. Hide request existence from unrelated callers.
- The authoritative snapshot includes only fields and stored signatures available from the approved SQL request and actual approval records. Browser data and Firestore are not consulted.
- The existing PDF template is copied to server/src/afc/assets/absence-from-campus-app.pdf; its SHA-256 must equal the reviewed source template hash 481677829217736B15CB3CBB010F49CB553A8664FE53F8604782093E99896547.
- Pin pdf-lib@1.17.1 exactly in both server/package.json and swa-api/package.json, with both lockfiles updated. The API artifact builder must include the template and resolve the pinned renderer package in its deployment bundle.
- Use an 8,388,608-byte maximum PDF size consistently in renderer, API, and SQL constraints/procedures. Enforce it before SQL persistence and before HTTP transmission.
- SQL persists PDF SHA-256, byte length, source snapshot SHA-256, template SHA-256, renderer version, creation time, and creating Firebase UID. Hash and length must match the actual bytes.
- Appointment Type and Expiry Date currently have no verified authoritative SQL source. Render those template fields blank; do not infer them or fall back to browser/Firestore data.
- Success is application/pdf with Cache-Control: private, no-store, X-Content-Type-Options: nosniff, and attachment filename afc-approved-{validated-request-uuid}.pdf. Errors keep the fixed JSON envelope.
- The artifact is insert-once and unique by AfcRequestId. No update, replace, or delete procedure is provided. Rollback 011 must refuse to drop the table when artifact rows exist.

## Ordered implementation tasks

### Task 1 — Synchronize and establish the test baseline

- Verify the P3B4 worktree is clean and on the expected branch; fetch the P3B3 source and verify its exact head is 7eb0514976e0c09caa070dd7455266b541b1984a.
- Merge origin/feature/p3b3-afc-frontend-api into P3B4 without rewriting history. Resolve only conflicts caused by continuity-document updates and preserve both histories.
- Record the new P3B4 parent/head and run existing server tests plus static/API freeze checks before feature edits. Stop if the merge changes protected runtime files unexpectedly or the baseline fails; investigate before proceeding.

### Task 2 — Add the template and pinned renderer dependency

- Add a template-integrity test that fails unless the server-local PDF exists and matches the approved SHA-256.
- Copy the reviewed PDF into server/src/afc/assets/absence-from-campus-app.pdf.
- Add exact pdf-lib@1.17.1 dependencies and lockfile entries to the server and SWA API workspaces. Add a bundle test proving the API artifact contains the template and resolves the pinned renderer package.
- Do not alter the browser renderer or existing frontend asset loader.

### Task 3 — Define and test additive SQL migration 011

- First add static SQL contract tests for database/azure-sql/011_afc_approved_artifact.sql and rollback_011_afc_approved_artifact.sql.
- Add only the new paws.AfcArtifact table: one row per request, unique/foreign-key constrained AfcRequestId, PDF bytes, content type, SHA-256 values, byte length, template and renderer versions, UTC creation metadata, and the 8 MiB check.
- Add the three narrowly scoped procedures named in the specification:
  - paws_api.GetApprovedAfcArtifactSource
  - paws_api.CreateOrGetApprovedAfcArtifact
  - paws_api.GetApprovedAfcArtifact
- The source procedure returns a deterministic SQL-built JSON snapshot and its SHA-256, with approved request and actual approval-stage signatures only. Define and test one byte encoding for that hash and use the same encoding in Node.
- Every procedure checks active profile, MustChangePassword = 0, final approval, and actor scope from SQL tables. The API passes only the verified Firebase UID; it does not pass a trusted role or approval flag.
- The create/get procedure serializes concurrent creation per request inside a transaction, re-forms the source snapshot under locks, compares its hash, verifies PDF hash and DATALENGTH, inserts once, and writes exactly one afc_artifact_created audit event without PII. Repeat calls return the stored row unchanged.
- Provide no update/delete path. The rollback script checks for existing artifact rows and throws without dropping data; otherwise it drops only objects created by migration 011.
- Tests inspect only the migration text and mocked procedure contracts. Do not connect to any live database or execute the migration.

### Task 4 — Implement the SQL repository behind procedure-only calls

- Add repository contract tests first in server/test/p3b4-afc-artifact-repository.test.js.
- Add server/src/data/sql-afc-artifact-repository.js using parameterized stored-procedure calls only. Assert exact procedure names, parameter names/types, and byte/hash mapping; no ad hoc table DML or text-built SQL.
- Test that SQL authorization/conflict/not-found outcomes map to bounded domain errors and never leak source JSON, signature data, or PDF bytes on failure.

### Task 5 — Implement deterministic server-side PDF rendering

- Add renderer tests first in server/test/p3b4-afc-artifact-renderer.test.js for known form fields, embedded PNG/JPEG signatures, missing optional fields, malformed signature data, template hash mismatch, deterministic output, and both sides of the 8 MiB bound.
- Add server/src/afc/afc-approved-artifact-renderer.js using the pinned local PDF library and local reviewed template only. Do not fetch a CDN or accept caller-supplied template/PDF.
- Map confirmed SQL snapshot fields and actual stage signatures to the existing form. Keep Appointment Type and Expiry Date blank until an authoritative SQL source is verified and separately reflected in the plan.
- Return bytes plus SHA-256, byte length, renderer version, and template hash. Reject malformed or oversized input before persistence. Do not log rendered content or signatures.

### Task 6 — Implement authorization and idempotent orchestration

- Add API behavior tests first in server/test/p3b4-afc-artifact-api.test.js for missing/invalid token, inactive profile, password-change-required profile, requester, each real approved-stage approver, active administrator, unrelated caller, missing request, unapproved request, invalid UUID, non-empty body, oversized PDF, and source-hash conflict.
- Add server/src/afc/afc-approved-artifact-api.js. Verify Firebase identity, resolve active SQL profile, and call the repository using only token UID. The renderer runs only after approved source retrieval succeeds.
- Use insert-once storage and return the stored artifact on retries. Add a concurrent-call test proving there is one insert/audit outcome and every response has byte-identical stored content. No regeneration or replacement may occur after an artifact exists.
- Return the same not-found class for absent, unapproved, and out-of-scope requests where needed to prevent existence disclosure. No PDF bytes on any denial or failure.

### Task 7 — Wire the University API route and exact binary response

- Add runtime/route tests before implementation in server/test/p3b4-afc-artifact-runtime.test.js and extend server/test/university-http-server.test.js.
- Add server/src/runtime/swa-afc-artifact-functions.js and wire it through server/src/runtime/swa-sql-runtime.js using the existing authenticated University API path.
- Extend server/src/runtime/university-http-server.js with a narrow Buffer response path that writes bytes unchanged, exact content length, the specified private headers, and the UUID-derived attachment name; keep JSON error serialization unchanged.
- Test actual response bytes against the repository buffer, success headers, empty request body, authentication before repository access, and fixed JSON errors without PDF bytes.

### Task 8 — Review migration and rollback contracts

- Run the migration text tests and perform a human diff review against migrations 009/010 and existing AFC approval procedures.
- Confirm every new object is additive, schema-qualified, idempotently guarded as appropriate, least-privilege-ready, and absent from all live execution scripts/workflows.
- Confirm rollback is guarded against existing rows and does not alter 009/010 objects.
- Do not execute either script against VetMed-Ops, a shared database, or another external SQL environment.

### Task 9 — Promote the API freeze and verify the candidate

- Extend tools/beta-api-freeze.js and tests/beta-api-freeze.test.js to protect server/package.json and server/package-lock.json as runtime inputs. Preserve every prior protected path.
- Expected API freeze count is 34: the existing 27 plus the five new server/src artifacts (four JS modules and the PDF template) plus the two server package files. Confirm the exact path delta; no static protected asset may drift.
- Run focused P3B4 tests, the complete server suite, root suite, SQL-runtime authorization tests, beta baseline/deployment/governance tests, static/API freeze checks, syntax checks, and secret/scope scans. Record exact counts and outcomes.
- Build the SWA API artifact and verify the new route, package, and PDF asset are present. Do not deploy it.
- Separate product and governance commits so the immutable API freeze anchor points to the tested product candidate. Run Azure Beta Build only for the exact reviewed candidate head and record its run ID/result. Do not promote the static baseline unless the exact diff shows zero static runtime drift.

### Task 10 — Final candidate review and handoff

- Review the full diff, SQL forward/rollback pair, route exposure, auth scope, privacy behavior, package-lock changes, bundle contents, freeze path delta, and test/CI evidence.
- Commit only the approved P3B4 branch work; push the feature branch if remote authentication is already configured. Open a PR only if Architect #5 explicitly requests it.
- Append a new continuity update and refresh the current-state/task files with the exact implementation breakpoint and test/CI evidence.
- Stop after branch review. No merge to main, live SQL apply/grants, Azure/Firebase/Cloudflare/IIS/firewall/service/certificate changes, deployment, or frontend cutover.

## Acceptance criteria

1. All authorization, approval, request-body, insert-once, concurrency, source-hash, byte-integrity, privacy, and fixed-error tests pass.
2. One approved request maps to at most one immutable SQL artifact and one creation audit event. Retries/races return identical persisted PDF bytes.
3. Every accepted PDF is rendered from the reviewed local template plus SQL-authoritative fields/signatures; unavailable fields remain blank.
4. SQL rechecks current source hash, final approval, and actor scope at persistence/retrieval. The API never trusts caller identity fields or PDF bytes.
5. Success is an exact-byte private PDF attachment; failures remain fixed JSON with no partial PDF.
6. API freeze protects the full runtime dependency and template inputs; the API freeze reports exactly 34 paths and zero drift, while static freeze reports zero drift.
7. The candidate is branch-only and unmerged/undeployed; migration 011 is unapplied and no live database or cloud changes occurred.

## Stop conditions and rollback limits

- Stop before coding unless the owner approves this plan.
- Stop if the P3B3 merge cannot be made without unexplained runtime changes or if its verified baseline fails.
- Stop if the source snapshot cannot be reconstructed deterministically from current SQL fields, if an AFC PDF field would require guessing, or if actual approved approver identities cannot be proven from SQL.
- Stop if SQL procedure permissions/behavior cannot enforce actor scope without expanding live grants; record the branch-only requirement for later DBA review.
- Stop if the renderer is nondeterministic, signature encoding is unsupported, the template hash differs, size limits disagree, or the binary response path changes existing JSON behavior.
- Migration rollback must refuse to destroy any persisted artifact. Any request to remove real artifacts or apply/undo the migration on live VetMed-Ops is outside this plan and requires a separate explicit owner task.
