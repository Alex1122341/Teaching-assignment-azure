# PAWS Beta Domain Map — 2026-10-15

**Scope:** controlled Beta main 0d4b4d9, last documented live API/Hosting ca465bf (2026-10-14). This supersedes old BETA-R1 descriptions of empty SQL profiles, Firestore-backed live business data, and DOE/Teaching Assignments being Experimental-only. Do not treat source implementation as proof of a live enabled write.

| Domain | Canonical authority | Current Beta functionality / boundary |
| --- | --- | --- |
| Identity / account | Firebase Auth identity; SQL paws.UserProfile for API role | Verified token/exact UID, Active and password-change gate, BaseRole, FacultyId self scope; limited legacy Firebase/Firestore user/group tooling remains separate |
| Faculty / professional profile | SQL paws.Faculty and profile/alias/joint appointment tables | Lookup, roster, rank/stream/FTE/HR profile, authorized Edit Faculty, active/archive restoration and audit |
| Course / Subject | SQL Course and Subject catalog | Course used for timetable and DOE mapping; Subject is not Session Topic |
| Working Sessions | SQL paws.Session, paws.vCalendarSession | Day/Week/Month/List, filters, edit/create/batch and SQL procedures gated by account/operation; unpositioned/uncertain time remains visible as Needs Review |
| Assignment result | SQL paws.SessionAssignment | Canonical Faculty teaching allocations; signed role/DOE sources are not a second final-assignment authority |
| Stable responsibility | SQL paws.TeachingResponsibility, Scope and Assignee | HICC/VISC stable duty, exact scope and dated assignee; Person != responsibility; roles alone do not grant package access |
| TA groups/packages/review | SQL TeachingAssignmentGroup, Package, revisions, contributions, reviews, finalizations | HICC submits; VISC approves/pushes back; HICC final submit; ADFAD finalizes; server-side stale revision and scope checks |
| Published TA | SQL TeachingAssignmentPublicationRelease and immutable published snapshots | Faculty reads active explicit release; working != published, finalization != publish |
| LAB details | Authorized SQL LAB/SRL sessions | Course/date/year grouped display with actual intervals/instructors; missing room/rotation/group/roster stays unknown; student roster not automatically published |
| AFC admin records | SQL AfcRecord/AfcManualRecord and unified view | Imported/manual/active history; admin single/batch create and guarded cancel without hard-delete; no visible UID in Faculty selection |
| AFC request / approval / artifact | SQL AfcRequest, AfcApproval, AfcArtifact | Faculty request/signature and decision/artifact lifecycle where gates and reviewer configuration allow; private reasons, immutable signed artifacts |
| SWAP / Change Request | SQL SwapRequest/Revision/Decision/Notification | Session or teacher replacement request, approvals, stale revision/availability and date checks. Distinct from Teaching Assignment package review |
| DOE policy | SQL DoePolicyVersion, DoePolicyRule, mappings, exceptions and audit | Draft/validate/impact/publish/recalculate lifecycle with roles/gates; a Draft is never implicitly Active |
| DOE faculty calculation | SQL worksheet source rows, session/role facts, supervision source, DoeFacultyTarget, DoeCalculationRecord and recorded allocations | DOE Overview/List/Worksheet, target override, per-source provenance, reserve, Needs Review, signed manual DOE, academic-year scope |
| Role effective periods | SQL RoleAppointmentSchedule | Active/Inactive as-of date, up to 12 nonoverlapping periods and optimistic concurrency; dates do not auto-prorate DOE |
| Tasks | SQL-backed scoped timetable projection + SWAP queue | Published all-year quality Tasks; full SQL overlap/conflict feature still only draft PR #100 |
| Developer Support | SQL SupportContext/Operation/Change capture | Real Developer-only 30-minute audited delegation and guarded Undo; excludes credential/unsupported artifact writes |
| Notifications/Outlook/D2L | Not yet a production integrated authority | CSV/ICS export exists; Graph and Brightspace sync are future explicitly scoped integrations |

## Critical access and privacy invariants

- SQL UserProfile.BaseRole and server-resolved FacultyId are the authority. Frontend role, Firebase custom role claim, client facultyId and Firestore role are not SQL grants.
- Formal API groups: developer / adfa_general / adfa_regular (administrative); faculty / hicc / visc (Faculty-linked self service); adc / lab (office contribution). Legacy owner/administrator/admin normalize; retired other_office/viewer fail closed.
- Same person may hold multiple HICC/VISC responsibilities, and a stable responsibility may transfer over activeDate/expirationDate half-open periods; eligible DOE date proration is case-by-case, not implicit.
- Faculty directory privacy: another person's UCID, email, DOE, HR and AFC reasons are never supplied to ordinary faculty through general availability queries. Return only Available/Unavailable and permitted timetable conflict metadata.
- Only server-authorized suggestions become candidates; ADFAD final result lives in SessionAssignment; only an explicit release becomes published.
- Missing DOE input or mapping is Needs Review, not zero; incomplete source/workload data should never be guessed from name, role, rank or title.
- SQL business records have no Firestore fallback. Legacy user/group pages are a special retained boundary; do not broaden them into timetable/DOE/AFC persistence.

## DOE authority layers

1. Guidelines reference implementation: 34 rows in server/src/domain/doe-rule-book.js (some are ceilings/explanations).
2. Deterministic legacy fallback calculation: server/src/domain/doe-calculator.js (2026-27-v1) recognizes stored DOE and detects mismatch.
3. Annual SQL policy engine: server/src/domain/doe-policy-engine.js with exact selectors, mappings, bounded formulas/tier/priority and source exception precedence.
4. Recorded Active policy: last documented Oct11 still Faculty Master List snapshot-based; verify live SQL before saying that a subsequent Draft was published.
5. Master/Guidelines 2026-27 candidate Draft: revision 2 recorded 58 rules / 56 course mappings / 25 subject groups / 25 allocation-specific exceptions, impact-preview 5282 entries with 0 deltas. **Draft evidence only**, not a live Active claim.

## Data and release certainty

2026-10-14 documented release: SQL036/037 AFC cancel and rowversion encoding, 803 active imported AFC, 0 manual and cancellation audits in post-release read, approved API/Hosting build ca465bf, live AFC create/cancel controls and grouped LAB visible. Actual UI create/cancel was not performed; earlier SWAP final apply and Developer support Undo were not live-mutated. Do not extrapolate these counts as immutable future truth.

Open Draft PRs #97–100 were **not** merged at the 2026-10-15 checkpoint. HEAD now contains the 038–043 source range covering the #98–#100 scope; PR #98's proposed destructive source migration still must not be assumed run against live SQL. Never silently adopt their schema/behavior as live.
