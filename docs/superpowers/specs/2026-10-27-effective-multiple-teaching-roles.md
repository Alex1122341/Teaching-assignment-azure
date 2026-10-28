# Effective multiple teaching roles in PR148

## Owner clarification and observed gap

On October27 the owner explicitly selected Tim's existing account for Faculty/HICC/VISC acceptance, then approved extending this same PR: retain Faculty; HICC/Course Coordinator limited to VTMD505; VISC limited to Bovine; enforce academic year and effective dates. Continue sequential execution and independent final review under the existing recommended-choice/no-routine-question instruction. The technical design below is the implementation recommendation, not a claim that the owner reviewed every implementation detail.

Read-only live evidence: Tim's UserProfile BaseRole is faculty. AY2026–27 RoleAssignment contains Course Coordinator `VTMD 505: Clinical Skills III` (legacy dates absent) and VISC `Production Animals - Bovine only` with RoleAppointmentSchedule2026-05-01 through2027-04-30. There is no TeachingResponsibilityAssignee for Tim in that year. The only existing workflow505 responsibility found is explicitly historical P2 acceptance infrastructure; do not relabel/reuse it as Tim's production responsibility. Legacy Firestore collaboration group Bovine has another owner and Tim as a member; do not transfer it or infer course authority from membership.

Current API/UI and SQL gates compare a single BaseRole. Consequently the previous successful Tim smoke proves Faculty access only. It is not HICC/VISC acceptance. Previously green8311e99 remains valid for that narrower revision, not this new scope.

**October28 evidence correction:** the earlier group-owner sentence above was inferred from a dropdown that excluded the current baseFaculty owner. Fresh UID-filtered SQL-authorized reads resolve existing Bovine document0ZFIKsy6v5MumieBlEgQ to Tim; its version1788893413.228534000 predates this work(September8). No Firestore write/transfer occurred. Preserve its actual source UID, not the mistaken label. The approved505/Bovine assignees have since been saved once and activated; earlier no-assignee evidence remains the pre-implementation baseline. See the dated role-accepted-owner-picker update and COLLABORATION_OWNER_GOVERNANCE.md receipt.

## Approach and reuse

Reuse SQL TeachingResponsibility, TeachingResponsibilityScope, TeachingAssignmentGroup/GroupHicc and TeachingResponsibilityAssignee as explicit authority records. Their stable IDs and canonical CourseId/group relationships define scope; labels, DOE numbers, workbook prose and collaboration membership never grant authority. RoleAssignment/RoleAppointmentSchedule remain business appointment evidence and are not silently converted into access grants.

Add effective teaching-role descriptors alongside the existing baseRole, rather than replacing Faculty or fabricating global Owner/Administrator rights. One person may hold both hicc and visc responsibilities. Existing global Owner/Administrator/Developer policies remain unchanged. A faculty-scoped profile must still be active, password-ready and linked to its active canonical Faculty.

Use a small shared server policy module to derive effective roles and a scope fingerprint from trusted responsibility rows for a requested academic year and Calgary date. An HICC responsibility must have explicit canonical course scope; a VISC responsibility must have explicit canonical group/area scope. Missing, ambiguous or inactive mappings fail closed. No keyword/species matching over session topics or arbitrary RoleAssignment labels.

## Dates and versioning

Keep the existing assignee storage convention: ActiveDate inclusive, ExpirationDate exclusive. Present inclusive end dates to users; May1 2027 in storage means April30 2027 on screen. Match the existing Calgary role-period semantics; an expired or future appointment grants no current write capability. Selected historical years do not revive expired authority.

Tim's proposed grant windows are2026-05-01 through2027-04-30 inclusive. VISC has that recorded schedule. The CC grant uses the owner's earlier explicit default window for appointments without dates; label this default provenance in the exact preview/audit. Do not rewrite the legacy RoleAssignment dates or DOE values as part of an access grant. The preview must show source appointment, canonical Faculty binding, course505/Bovine and dates before any command.

Preserve AccessVersion for account edits. Add separately versioned responsibility/scope metadata and include the effective scope fingerprint in self status, client invalidation and awaited server rechecks. Revoke/regrant A→B→A must invalidate earlier intent. The actual SQL command rechecks actor, target, source definitions and versions inside its transaction. Record a stable operation UUID, reason, before/after and persisted receipt atomically with AuditEvent. A lost response retries the same intent; never rerun with a new operation automatically.

## Consumers and boundaries

Teaching Assignments must combine the authorized HICC and VISC work queues without duplicates and return per-package capabilities. HICC draft/submit/final-submit and VISC review use explicit current responsibility scope; the browser cannot select a role to enlarge access. Mixed-course or unmapped packages remain denied unless all required scope checks pass. Preserve revision, stale review and concurrency protections. Preserve separation of approval stages; a dual-role person must not newly self-approve their own proposal where existing checks prohibit it.

SWAP continues to use package/session ownership and explicit VISC responsibility. Update any remaining BaseRole-only gate that incorrectly excludes an explicitly assigned Faculty profile. Unknown/unowned sessions do not acquire VISC coverage through a topic/area string. Owner/ADC/LAB approvals and DOE calculation rules are unchanged.

Collaboration group management recognizes an effective HICC, but still reads/modifies only that person's existing owned groups. VISC and Faculty do not gain ownership; group membership grants no teaching authority. Tim may legitimately have no owned collaboration groups. Sanitized choices must not expose contacts, UCIDs, DOE, HR or AFC reasons.

Self summary and navigation show Faculty plus scoped HICC/CC and VISC responsibilities with dates/year. Owner account editing keeps the base-role operation separate from explicit leadership grants. Search/preview/readback/history must distinguish them. Use existing shared name and role formatters, Last name, First name, no new dependency or technology.

## Release and live boundaries

SQL060 was applied at2026-10-27T16:52:24Z,15 existing profile business values unchanged,0 account operations/audits; reviewed feature role bound only to the existing runtime principal, whose pre-existing db_owner is unchanged. The accepted8311 candidate runs only on18789, with both new gates disabled and the preceding27 preserved. Production API remains e7d3ffec/ef2d053; Hosting95/95 matches PR149 anchor19d504; live rules are unchanged. Existing default-database-only service IAM authorization and bounded reads pass.

No new real grant is installed merely to obtain a passing smoke test. Prepare and verify the owner-approved Tim mapping as an actual requested configuration with exact preview, transactional application and durable recovery/audit. Do not mutate business sessions, assignments, announcements, real collaboration groups, DOE or other faculty grants as fixtures. No synthetic packages or new test identities in production. Once accepted, use independent product/governance review, new exact-head/main checks and official artifacts, then coordinated API/Hosting/separate restrictive rules release. Preserve historical evidence and user signoffs.
