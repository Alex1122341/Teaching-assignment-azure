# PAWS Beta Algorithms and Invariants — 2026-10-15

This is the **current Beta implementation guide** for reviewed main 0d4b4d9. Older BETA-R1 / Experimental-only algorithms remain in Git history and the dated agent updates; they are **not current operating restrictions**. Always inspect exact implementation code and verify mutable live state before an operation.

## 1. Identity and authorization

1. Browser authenticates through Firebase Authentication and obtains a Firebase ID token.
2. University API verifies token and project, then looks up paws.UserProfile using the verified exact FirebaseUid.
3. SQL UserProfile.BaseRole, Active, MustChangePassword and FacultyId determine business authority. A missing/inactive/blocked SQL identity fails closed.
4. Faculty/HICC/VISC are self-scoped to their exact canonical FacultyId; HICC/VISC workflow authority additionally requires current temporal responsibilities and group membership.
5. Developer, adfa_general and adfa_regular belong to API administrator groups, but only developer and adfa_general satisfy the stricter General role used for DOE policy Publish/Archive/global Recalculate. ADC/LAB are supported office roles for scoped contributions.
6. SQL stored procedure/SQL role, immutable audit and exact-true domain gate are additional requirements. Frontend visibility, Firestore users.role, client-supplied FacultyId and Firebase role claims are not SQL authorization.
7. Never create or correlate a Faculty identity by fuzzy matching, blank string, UI display name or email-only intuition; ambiguous authoritative source stays unresolved.

## 2. Session identity, assignment and timetable

- One canonical Session can have multiple Faculty SessionAssignments. SessionAssignment is the authoritative final Faculty allocation, including approved replacement and ADFAD finalization; no parallel FinalAssignment authority.
- Use canonical immutable IDs and source lineage for migration. Source row positions/content-derived keys may support deduplication, not mutable live identity.
- A Faculty-scoped timetable read uses SQL vCalendarSession joined to authorized SessionAssignment. No Firestore business fallback.
- Session edits/creates/batch and assignment replacement require supported admin role, the corresponding write gate, validated academic year/time/type and a narrow SQL command. Preserve original teacher roles and DOE data unless the accepted command explicitly updates them.
- Missing source time or group is **Needs Review**, not 00:00, a guessed schedule or a fabricated rotation. Scheduling conflicts and legitimate adjacency must be evaluated using actual intervals/assignments and the current authorization scope.
- Draft PR #98 (working Calendar activities) and #100 (SQL conflict Tasks) are not part of accepted main; inspect their own migration/branch contracts before attempting them.

## 3. Responsibilities, HICC/VISC review and Publish

- Person != Responsibility; Responsibility != display role; Subject != Session Topic.
- Stable TeachingResponsibility has exact Course/Subject scope, current assignee and dated windows. For responsibility authorization use half-open effective windows (activeDate inclusive, expirationDate exclusive); never authorize from historical role badge alone.
- TeachingAssignmentGroup is independent of legacy Firestore faculty_groups. Package key is AcademicYear + Group + stable HICC Responsibility, not the currently assigned person's UID.
- ADC/LAB/HICC can supply suggestions (not authoritative allocations). HICC saves/submits the working revision; VISC group leader approves or pushes back; HICC must final-submit the same approved revision; ADFAD chooses final assignments.
- Revision checks compare working/submitted/VISC-approved versions, and stale approvals cannot be reused after modification. SQL concurrency protection and transaction/audit remain mandatory.
- Finalization != Publish. Explicit immutable publication snapshots the accepted academic-year version and activates its published release; Faculty must not fall back to working packages when no release is active.

## 4. AFC and SWAP

- AFC records/requests/approvals/signed artifacts are separate aggregates. Other Faculty/availability queries receive Available/Unavailable only, never another person's AFC purpose or notes.
- Admin AFC single/batch creation is SQL-backed and independently gated. Admin Delete is **soft cancellation**: update Active=false only for exact active record, guard expected rowversion, preserve historical row, source and audit. Never hard-delete existing AFC from the admin UI.
- In the Oct14 release, API/SQL cancellation, stale retry, denied access and concurrent rollback acceptance passed; actual UI create/cancel was **not** run against live business records.
- SWAP stores session snapshot and revision; authorization/availability must be rechecked at decision/apply, not trusted from request time. Reject stale session, changed assignment or unavailable candidate. HICC/VISC TA review is **not** the SWAP approval workflow.
- Draft PR #99's ADFA DOE candidate comparison is not live and must not leak DOE or HR fields to ordinary Faculty.

## 5. DOE policy hierarchy

Three different authorities must never be conflated:

1. Guidelines/reference list: 34 code-level entries in server/src/domain/doe-rule-book.js (including ceilings and non-formula references).
2. Legacy deterministic 2026-27-v1 calculator: matches recorded Session/Role DOE and flags differences or missing quantities.
3. Versioned annual SQL Rule Book and its Active/Draft snapshots, course/subject mappings, explicit source exceptions, calculation records, policy audit and staged publication.

The 2026-27 MASTER + Guidelines rationalized candidate last recorded as **Draft revision 2**: 58 rules, 56 course mappings, 25 VISC subject groups, 25 assignment-scoped source allocations. The 5282-source zero-delta Impact Preview is **candidate evidence** and not proof of publication or zero live Needs Review. A separate read-only SQL query is necessary to establish current Active.

Draft lifecycle: create/reuse -> save with expected revision -> validate selectors/inputs/parameter/priority/formula and checksum -> complete Impact Preview against current source fingerprint -> authorized Publish transaction -> separately authorized Recalculate. A new Draft does not automatically change recorded allocations or the Active policy. Multiple equally ranked matching rules/exceptions must error rather than silently choose one.

The formula evaluator accepts only whitelisted finite numeric expressions and functions min/max/round/floor/ceil/abs; do not execute arbitrary JavaScript or accept undeclared inputs. The engine checks selectors, priority, tiers and explicit exceptions. An approved source allocation exception overrides generic derivation only for its exact documented scope.

## 6. DOE calculation references

Percentage-point rates (not decimal fractions):
- Lecture and SRL: 0.30 per credited hour; Lab Primary: 0.21; Lab Secondary: 0.19.
- Quiz/Midterm and OSCE: noncredit in accepted calculator; unknown role, hour or eligibility stays Needs Review.
- Course coordinator tiers by units: <3 => 1.75; 3-5 => 3.5; 6-9 => 7; 10-14 => 10; 15+ => 15 per confirmed course.
- HICC new-curriculum eligible development: 2 per course unit only while applicable; finalized/ineligible development returns 0 for that development component. Course coordinator and HICC terms cannot be inferred from a legacy combined label.
- VISC annual reference: 2025-26 7.5; 2026-27 5; 2027-28 2.5 per confirmed subject; 2028+ maintenance 1.75 per confirmed maintenance assignment. Do not split a slash-separated Subject Group without exact master evidence.
- Rotation participant 2.5 per confirmed week; designated rotation coordinator +2 per unique rotation type; CCC 0.5 per shift, with any source half-day deduction applied exactly once.
- Trainees: undergraduate 1, fourth-year preceptor 0.75, graduate primary 3, graduate cosupervisor 2, postdoc 1.5 per counted trainee. Specialized VETM506/IM source rules are exact documented cases, not general defaults.
- Research, PPVM and Service/Admin are approved individual contract allocations. 10% new staff, 5% instructional development and teaching-focused 10% scholarly activity are ceilings, **not automatic individual defaults**.
- The academic teaching year is May (Spring) through the following April (Winter).

## 7. DOE reserve, Worksheet, manual adjustments and review

Let T be approved effective Teaching DOE Target, A recorded assigned teaching/role contribution excluding separately negotiated manual role adjustments before reserve, and S confirmed raw supervision. Reserve policy:
- teaching-focused stream: initial R = min(T, 7.5);
- non-teaching-focused T <= 35: R = T * 0.5 with flexible supervision ceiling T;
- non-teaching-focused T > 35: R = min(T, 15) with ceiling R;
- applied supervision = min(S, supervision ceiling, max(0, T-A));
- total applied DOE = recorded scheduled teaching + role DOE + eligible adjustments + applied supervision;
- remaining DOE = effective Target - total applied DOE. An over-target negative remainder is meaningful and not silently clamped to zero.

The actual Worksheet service applies signed negotiated manual values **once after the source supervision reserve**, and avoids making a negative manual reduction automatically increase supervision. Preserve the precise Worksheet service category treatment rather than double-counting a manual role row. The normal trainee history window is a three-year rolling average where supplied, else current-year evidence. Missing supervision, target or contract does not imply zero. Values stored with approved source provenance may override generic full-year references.

Role appointment periods and case-by-case proration are independent from DOE. Date ranges alone **do not** automatically prorate HICC/VISC/coordination credit. Negative manual DOE is accepted with a negotiated reason/Notes; missing override is NULL, not zero. Target overrides require approved reason, nonnegative target and audit.

Worksheet sections: Scheduled Teaching, Roles, raw/applied Supervision, signed Adjustments. Needs Review is authoritative for unresolved source, mapping, missing calculation inputs, mixed policy/version or unexplained stored-calculator differences; do not fabricate source evidence.

## 8. Release/migration algorithms

Every operational change requires scoped implementation and independent review, exact PR and main CI, protected source/asset freeze and artifact check, authorized merge, separate versioned University API/SQL gate action, Firebase Hosting-only publication and live authenticated acceptance. CI green != merged != deployed != accepted.

Initial SQL reset/empty load is completed historical setup. Never rerun it. Historical migrations 001–037 must not be repeated without checking exact applied state. The proposed #98 migration includes potentially destructive AFC source counterpart deletion and needs explicit review, private backup/recovery receipt, dedicated least-privilege runtime and separate data-operation approval. Developer Support Undo restores an unchanged captured afterimage atomically while preserving audits and refuses conflicts.
