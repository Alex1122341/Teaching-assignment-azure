# P3B4 — Approved AFC PDF Artifact

**Status:** Owner-approved design; implementation is pending owner review of this written specification and a separately approved implementation plan.
**Repository:** Alex1122341/Teaching-assignment-azure
**Base:** feature/p3b3-afc-frontend-api @ 1454934473d2e1431402f22c8b02d9584b8be4d0
**Scope:** Branch-only specification and later branch implementation. No live activation is authorized.

## 1. Decision

Store one immutable, server-generated approved AFC PDF artifact per approved request in VetMed-Ops SQL using varbinary(max), served only through the authenticated University API. This follows the existing locked decision in agent.Ai/DECISIONS.md that SQL binary storage is preferred at the observed artifact size. No new storage service, public object URL, or Firestore authority is introduced.

The artifact is evidence attached to the existing AFC request. It does not create a second absence request or replace paws.AfcRequest, paws.AfcApproval, or paws.AuditEvent as workflow truth.

## 2. Evidence and gap

- Legacy afc-actions.js renders the approved PDF in the browser, computes SHA-256 and byte length, then stores 350,000-byte base64 chunks under the Firestore request.
- The saved Firestore inventory records one approved AFC PDF as four chunks.
- SQL 009_afc_request_foundation.sql and 010_afc_approval_foundation.sql store request and decision signatures and state, but define no PDF artifact table or retrieval procedure.
- The current University HTTP adapter emits JSON responses only; binary PDF responses need an explicit, tested response path.
- The locked AFC decisions require immutable final documents and prefer SQL binary storage.

## 3. Architecture and request flow

1. The browser calls one authenticated, idempotent POST /api/v1/afc/requests/{afcRequestId}/approved-artifact with no caller-supplied business data or PDF bytes.
2. The API verifies the Firebase ID token and resolves the active SQL UserProfile; actor UID comes only from the verified token.
3. SQL confirms the request is finally approved and its required approval stages are approved. The request's authoritative fields and stored signatures come only from SQL.
4. The server renders the existing AFC form template with a pinned, server-local PDF renderer. It does not call a browser renderer, remote CDN, Firestore, or public storage.
5. SQL atomically inserts the PDF if no artifact exists for this request. Repeated or concurrent calls return the already stored bytes and metadata; they never replace or regenerate an existing artifact.
6. The API returns the stored PDF bytes. No public link or bearer-free download route is created.

The API may return application/pdf on success and the existing fixed JSON error envelope for failures. Responses must be Cache-Control: private, no-store, X-Content-Type-Options: nosniff, and an attachment filename derived only from the validated request ID. Enforce a bounded artifact size before persistence and before sending the response.

## 4. Authorization

- Require a valid Firebase ID token and an active SQL profile that does not require a password change.
- Permit access only to the request's authenticated requester, the Firebase UIDs recorded on its actual approved AfcApproval stages, or an active administrator role.
- SQL must re-check final approval and actor scope when reading source data and when persisting/returning the artifact. A browser-supplied FacultyId, requester UID, approver UID, role, status, template, or artifact bytes is never trusted.
- Return no artifact bytes to unauthenticated or out-of-scope callers. Avoid exposing request existence to an unrelated caller.
- Do not place signature images or raw signature data in ordinary AFC list responses.

## 5. SQL evidence record and immutability

Proposed additive table: paws.AfcArtifact.

Minimum columns:

- AfcArtifactId primary key and AfcRequestId unique foreign key;
- ContentType constrained to application/pdf;
- PDF bytes in varbinary(max), SHA-256, and byte length;
- canonical authoritative source snapshot SHA-256;
- renderer/version and template SHA-256;
- creation time and creating Firebase UID.

The source snapshot is formed by SQL from the approved request and actual approval records. The API hashes and renders that returned snapshot. Before insertion, SQL re-forms the current snapshot under a request/approval lock and requires the source hash to match. This prevents persisting a PDF built from stale or caller-modified values without storing another full copy of sensitive source JSON.

Add stored procedures for approved-source retrieval and insert-once artifact persistence/retrieval. They must enforce approval state and actor scope, serialize concurrent creation, return the existing immutable artifact on repeat calls, and append an afc_artifact_created AuditEvent on first insertion. The unique request constraint is the final duplicate guard. Do not provide update, replace, or delete behavior.

Migration 011, tests, and procedures may exist on the feature branch only in this stage. Do not apply 009, 010, 011, grants, or new procedures to live VetMed-Ops. Runtime permission activation is a later, separately authorized step.

## 6. Integrity, failure, and privacy

- The PDF is generated from SQL-authoritative fields and signatures only after final approval.
- Persist PDF SHA-256, exact byte length, source snapshot hash, template hash, and renderer version. SHA-256 establishes byte integrity; it is not by itself a claim of legal non-repudiation.
- Artifact creation is idempotent by AfcRequestId. A lost response and retry return the same stored artifact. A source hash mismatch fails closed and requires a fresh SQL read/render.
- A not-finally-approved request has no downloadable artifact. Authorization, SQL, renderer, size-limit, or integrity failures return bounded errors and no partial PDF.
- Successful downloads are private, non-cacheable attachments. No signed public URL, public bucket, or CDN cache is used. SQL remains the only artifact authority.
- The PDF and embedded signatures contain sensitive personal data; do not log binary content, signature images, or request details.

## 7. Alternatives not selected

- Firestore chunks: rejected because Firestore must not regain authority for VetMed-Ops workflow documents.
- Client-rendered PDF: rejected because the browser can alter content and the generated file cannot serve as authoritative SQL evidence.
- Cloud object storage or signed URLs: deferred; they add a new service and public-link lifecycle when the existing locked SQL decision already covers the observed size.

## 8. Acceptance criteria

1. Unauthenticated requests return 401 and no PDF bytes.
2. An inactive, password-change-required, unrelated, or unapproved identity cannot create or retrieve the PDF.
3. The requester and actual approver(s), plus active administrators, can retrieve an artifact only after SQL reports final approval.
4. The PDF fields and signatures match one authoritative SQL snapshot; altered request-body identities or client PDF bytes are ignored/rejected.
5. First creation stores exactly one artifact and one creation audit event. Concurrent and repeated calls return byte-identical stored content without replacing it.
6. Stored SHA-256 and byte length match the returned bytes; stale-source and renderer/size failures fail closed.
7. The HTTP adapter returns private, no-store PDF attachments and preserves JSON error responses.
8. No Firestore access, SQL browser access, public URL, unauthenticated endpoint, live SQL mutation, Firebase mutation, or frontend origin cutover is introduced.
9. Regression tests cover authorization, approval-state gates, idempotence/concurrency, source-hash conflict, exact bytes/hash, response headers, and error behavior. Existing 401-only retry behavior remains: one forced Firebase refresh/replay at most; 403/404/5xx/transport errors do not replay a non-idempotent request.

## 9. Explicit non-goals and rollout boundary

This specification does not authorize live SQL migration, new production tables/procedures/grants, runtime permission activation, Firebase/Firestore changes, real-user changes, deployment, merge, tunnel/DNS changes, or a live frontend cutover. Code and SQL migration work remain on the feature branch until separately reviewed and accepted.

Before implementation, the owner must review this saved specification. A written implementation plan must then identify the exact files, migration 011 contract, renderer dependency and version, concurrency/auth tests, API freeze update, and rollback limits; that plan requires its own owner approval.
