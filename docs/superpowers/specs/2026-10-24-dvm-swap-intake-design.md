# DVM SWAP requirements and initial implementation

## Request and authority

The Owner supplied two DVM Office screenshots (comparison dated 2026-09-25 and Topic Update & Swap Form), requesting a capability comparison and implementation of missing features where possible. Routine choices follow the Owner's standing recommendation/inline execution preference. The screenshots describe requested behavior, not proof of the currently deployed workflow. No production request, approval, email, role or SQL mutation is part of implementation acceptance.

Repository: Teaching-assignment-azure / controlled Beta. Base main `87a7f943f40bc5bf87b54b1b0059a2593ebc3b7d`. The unrelated SEC-01 audit remains on branch7051227 and PR142 remains at78a7fcf; neither is bundled into this feature.

## Existing implementation and reuse

Reuse `swap-workflow-sql.js` native dialog, existing `swapContext` field capabilities, assignments, sanitized candidates, revision snapshots, notify checkbox, SQL inbox and decision routes. Keep `adfa-swap-panel.js` DOE/availability checks and shared Last name, First name formatter. Use existing SWAP stylesheet and workspace tokens. SQL030/039 own the request state machine and apply transaction; API and role checks are authoritative.

## Twelve-item comparison before changes

These are source capability assessments, not a new complete live acceptance.

| ID | DVM requirement | Current assessment | Evidence / remaining work |
| --- | --- | --- | --- |
| DVM01 | Distinct CC/instructor/student/ADFAD/DVM access | Partial | Faculty/self, scoped VISC, ADFA, ADC and LAB exist. No student role or separate scoped CC initiation grant; HICC status alone is not permission to propose any topic. |
| DVM02 | Visible request entry for authorized users | Present | Session/LAB `SWAP request` entry and `SWAP inbox`; server denies out-of-scope access. |
| DVM03 | Instructions followed by Topic change / Swap / Session type change | Partial | Generic form/instruction exists; no explicit three-mode choice. Implement in this slice. |
| DVM04 | Pending topic does not alter live timetable | Present | SQL request/revision stores proposals separately; apply only through final authorized decision transaction. |
| DVM05 | Topic/swap approvals: ADFAD then DVM | Missing | Existing optional target/VISC, then relevant ADC→LAB→ADFA ordering differs. Requires separately versioned policy and real DVM role/scope; do not reorder existing pending requests. |
| DVM06 | Email to departments, CC and ADC as applicable | Missing | Current notification is replacement consent in the SQL inbox, not email. Needs approved recipients, sender/service and transactional outbox/delivery handling. No email sent in this slice. |
| DVM07 | Several sessions in one topic/swap request | Missing | Current request has one SessionId/snapshot/assignment. Requires request header/items, aggregate authorization, revision/availability/DOE validation and atomic apply; repeated single requests are not equivalent. |
| DVM08 | Choose fields to switch and provide comment | Partial | Editable fields and note exist, but no explicit inclusion checkboxes or submit-time comparison. Implement both. |
| DVM09 | Persistent/revisitable admin checklist: invite, DVM hub, D2L | Missing | Existing scheduling conflict tasks are not a request-linked administrative checklist. Needs server persistence and audit; browser storage is not an acceptable replacement. |
| DVM10 | Final approval updates timetable and writes change log | Present | Existing SQL transaction applies and audits; revision/snapshot/identity/availability checks remain. |
| DVM11 | Session-type request goes to ADC | Partial | Type belongs to ADC/ADFA and can require ADC review. Instructor cannot currently propose it; no automatic ADC email, and incompatible recorded DOE blocks application pending evidence. |
| DVM12 | Persisted review history and revisitable proposal | Present | SQL revisions/decisions/queue/detail, push-back, withdrawal and stale protection exist. Detailed approver display requires richer sanitized history DTO; this slice does not invent missing names. |

Baseline: **4 present, 4 partial, 4 missing**. This slice aims to complete DVM03/DVM08's intake presentation; DVM01/DVM11 and the four backend workstreams remain open. Existing privacy and real-role enforcement remain prerequisites to a complete DVM process acceptance.

Implemented candidate `2d896b8`: DVM03/DVM08 intake behavior is implemented and locally exercised, bringing the candidate source assessment to **6 present, 2 partial, 4 missing**. This does not change the published source assessment or close the full SWAP role/state-transition acceptance.

## Approaches considered

1. Replace the whole workflow now: reaches the intended process but requires new role/scope authority, migrations, pending-request policy and an email provider. Incorrect defaults could change who approves real work.
2. **Chosen:** deliver the existing-contract intake improvements now, and specify separately testable backend packages. This produces usable improvements without pretending that three buttons create DVM routing or emails.
3. Browser-only checklist/batch/email simulation: rejected because it would have no shared persistence, real atomicity or authoritative recipient/permission enforcement.

The selection is the implementer's recommendation under the Owner's instruction to minimize questions, not a claim the Owner separately signed a new role matrix.

## Intake behavior

- Show three labelled request modes inside the existing dialog: Topic change, Swap, Session type change. Default Swap retains the current DOE replacement flow. Existing revisions infer a mode and keep it fixed to protect retained changes and role-owned fields.
- Topic mode shows Topic only; type mode shows Session type only; Swap retains the full existing combination form through its standard-request action. Every mode respects the exact server field editability. Read-only fields remain explanatory; no new client-side grant.
- Explain one-session scope, unchanged live timetable until approvals, field selection and inbox-only notifications. Do not display the proposed DVM approval order as current behavior.
- Editable schedule fields have explicit inclusion checkboxes. Editing an included field proposes its value; unselected editable fields do not get submitted. Start/end are selected together. Existing editable revision fields start selected; protected revision changes remain intact.
- Switching modes with a draft incompatible with the destination is blocked with an explanation until the user clears those selected changes. Never silently discard a replacement or pending topic/type proposal. Notes and replacement-consent preference survive valid mode changes.
- First submit presents a compact, escaped From/To comparison and note for the exact selected proposal. Second submit confirms the same payload. Edits invalidate confirmation. Recheck DOE/availability on final submission, keep existing idempotent request ID, expected revision, snapshot and current-user/generation guards. Prevent duplicate in-flight submission.
- Preserve existing ADFA direct panel, standard-form draft handoff, error/reload behavior, privacy and names. No private faculty DOE for ordinary Faculty.

## Follow-on backend packages

1. Request-linked checklist: SQL checklist items with request/revision, completion/undo, actor/time, version and audit. Only authorized administrators update; an application checklist is not evidence an external invite/D2L update actually occurred.
2. Versioned DVM review policy: explicit scoped DVM/CC authority and student read-only decision; persist policy per request, target consent rules, ADFAD→DVM ordering and no application after only stage one. Preserve legacy pending routing and HICC group-swap boundaries.
3. Atomic multi-session requests: one header, ordered unique items, all canonical snapshots, all-item permissions and transaction; any stale/conflict/unknown DOE blocks the whole apply.
4. Email outbox: allowlisted institutional recipients derived server-side, delivery idempotency, retry/status/audit, minimal content and private details behind login. Needs a configured sender; do not send actual mail or guess recipients from the screenshot.

## Acceptance

Use the agreed SWAP page seam, server/API invariants and existing SQL contracts. TDD covers mode selection, role-disabled fields, explicit selected fields/time pairs, notes/escaping, confirmation/edits, existing mixed/protected revision data, duplicate submission and stale/user-switch responses. Existing API/SQL suites remain unchanged, since this slice does not modify those layers. Verify actual generated-assets preview at desktop/narrow widths, keyboard and 200% text; screenshots are synthetic and comparable. Product and freeze promotions are separate reviewed commits. No merge/deploy claim before required exact-head/main checks.
