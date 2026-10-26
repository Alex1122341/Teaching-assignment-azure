# GOV-01 / SEC-01 effective access

## Intent and approved decisions

Owner explicitly selected Teaching-assignment-azure/Beta/SQL for ledger26–27 on2026-10-26. Stop grilling; proceed sequentially under standing recommended-choice authority. Five confirmed decisions: real persisted business access is required, not explanatory text alone; HICC groups are collaboration only; only Owner changes access, last usable Owner protected; revocation applies to the next request with client private-state invalidation; reason, before/after preview, persisted readback and immutable actor/time audit are mandatory. No production account/group grants are changed during acceptance.

## Baseline / scope

Start at deployed maine7d3ffec1609fef4b5b503ff92a21df6a8a4fafe plus local documentation checkpointb932986. Firebase Auth identifies; SQL paws.UserProfile authorizes. Fresh read-only aggregate18:07:31Z:7ready adfa_general,3adfa_regular,1developer,2faculty,1hicc,1visc. This is not a grant migration. Existing published reports, History, AFC PDFs, CCC and DOE remain intact. Exact deployed95asset/119API/27gate evidence is preserved in the reports release receipt, to be refreshed for candidate publication.

## Approach

Considered: (1) read-only explanation—useful but insufficient under Q1; (2) browser or server dual-write of SQL and Firestore roles—cannot make independent direct-rule grants atomic and leaves revocation ambiguity; (3) SQL authority plus authenticated server adapters for surviving legacy groups/announcements, with direct privileged Firestore paths closed. Choose3 as the implementation recommendation under the user's go-ahead. It preserves group functionality without granting group-derived course rights.

## Account access contract

Existing SQL profiles only. New Auth provisioning, password reset/change and arbitrary course grants are separate capabilities, not silently added. Editable fields are role, active and linked canonical FacultyId. Existing password-required status is displayed and preserved, never cleared by editing a role. Names/email remain source identity, not editable grants. Role choices are the existing SQL-supported owner, administrator, faculty, hicc, visc, adc and lab; canonical aliases preserved through shared policy. Developer accounts and grants are protected from this Owner editor. Unknown legacy roles display Needs review, never silently map. Faculty-facing grants require an active canonical faculty link. Existing server role/scope policies remain authoritative; no new broad office access.

Owner-only bounded account list and allowed identity choices; no UCID/HR/DOE joins. Preview binds actor/target versions, desired role/active/faculty link, reason and a10minute private handle. Commit uses a UUID operationId and the exact private preview. The database rechecks Owner, versions, target and last-ready-Owner under serializable locks, performs update and AuditEvent atomically, and returns persisted state. Duplicate operationId with identical intent is idempotent; changed intent conflicts. Empty reason, unsupported keys, stale/ABA target, changed actor, self-disable/demotion, protected Developer or removal of last ready Owner are rejected. Add rowversion and dedicated operation table/SQL procedure in migration060, no existing role/data rewrite. Fresh reads authorize from SQL on every request; unsupported roles remain fail closed.

## Surviving legacy features

Replace browser User Management Firestore account/group operations with SQL-authenticated routes. A server-only Firestore adapter preserves existing faculty_groups and information_center documents and historical account_audit; these stores do not determine access. Owner manages groups; an active SQL HICC may update members of its existing own group only. Owner/course association cannot be changed by HICC, and membership grants no timetable, approval or DOE powers. Candidate directory for HICC is sanitized canonical faculty IDs/names/roles, no emails/UCIDs/login directory. SQL owner resolution and Firestore group expected version are rechecked before transaction commit; preserve historical/unresolved membership explicitly rather than invent or silently delete identities. Announcements retain current10message limit via SQL-authenticated read and Owner publish. Neither service provisions accounts or edits assignments.

The final Beta Firestore rules deny direct legacy privileged account/group/settings/announcement/approval/bulk operations. Keep only required own compatibility profile get/password completion and deny every other client path; those compatibility fields cannot grant SQL access. Preserve old audits and records; rules retirement is a reviewed separate coordinated security deployment, never an incidental Hosting deploy. All affected legitimate features require replacement and emulator proof first. API adapter permission errors are explicit503, never fallback or broad service permissions.

## UI and revocation

Reuse current User Management layout, shared names/role helpers, data client and state styles. Owner sees effective SQL role, linked scope, active and password gate with explicit source labels, reason and before/after preview, then saved readback/audit. HICC sees only own collaboration group; other roles see only their own effective access summary. Legacy account creation/bulk/password-gate toggles are not presented as working SQL authority. Existing user-controlled Firebase password change remains separate and accurately explains any remaining SQL gate.

No role/UID/token cached as authority. New self-access status and shared client guard compare canonical identity/role/active/faculty binding on requests/focus/periodic checks; a changed/denied binding clears private state and requires refresh/sign-in. SQL next-request denial does not wait for polling/token expiry. In-flight mutations recheck actor under database locks. Readiness/error states never expose previous private payload.

## Acceptance / boundaries

Seams: real HTTP public API behavior (roles, identity, preview/commit/readback/idempotency); SQL disposable database procedure (atomic audit, concurrency, rollback, last Owner); rendered UI + Firestore emulator (no direct bypass, HICC own-group retained, stale session clear). These use the previously approved API/SQL/UI test boundaries and current standing recommendation authority. No real account permission write, test identity provisioning, announcement, email or group edit against production.

Follow independent product/standards review, separate static/API freeze governance, exact-head and exact-main build/root/server/emulator/SQL tests. Publish only official accepted artifact, coordinated API+Hosting+security rules with rollback boundaries recorded. Read-only real-role smoke only. Keep SEC-01 pending until those full gates pass; documentation or hidden menus alone do not complete it. Ledger26 is refreshed baseline;27 retains explicit staged milestones and user signoff.
