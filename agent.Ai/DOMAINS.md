# PAWS Domain Map

This file describes the important PAWS domains, their ownership and their current Beta relevance.

## Identity / UserProfile

Purpose:

- bind Firebase-authenticated accounts to PAWS access policy;
- hold base role, active status and optional Faculty link.

Beta SQL:

- `paws.UserProfile` exists structurally;
- live row count was 0 at the last accepted checkpoint;
- BETA-R1 reads by exact `FirebaseUid`.

BETA-R1 rules:

- active profile required;
- supported role required;
- Faculty-scoped role requires exact FacultyId;
- no fuzzy identity matching;
- DVM/LAB Beta viewers remain non-Faculty.

## Faculty

Canonical SQL identity:

- `paws.Faculty` 120
- 116 source Faculty Master business rows plus canonical pool/vacancy placeholders

Related:

- `FacultyProfessionalProfile`
- `FacultyAlias`
- `JointAppointment`
- Draft PR #5 `FacultyDirectoryProfile`

Display-name rule:

- use preferred name;
- unified display form: `First, Last`.

Faculty identity must never be resolved by fuzzy matching during migration.

## Course

Canonical SQL domain.

Used for:

- timetable identity/context;
- HICC scope in future P3.1;
- DOE mapping in Experimental;
- LAB grouping.

Course != Subject.

## Subject

Experimental/P3.1 first-class canonical catalog.

Subject != Topic.

Future HICC authorization uses exact Course + Subject.

Not a blocker for the first Azure Beta SQL timetable read.

## Working Session

Canonical scheduling activity.

SQL:

- `paws.Session` 1,937

Session is one activity regardless of how many Faculty teach it.

BETA-R1 reads a sanitized SQL projection through `paws.vCalendarSession`.

The Firestore vs SQL session counts are not directly interchangeable and require deterministic reconciliation before any session migration/update.

## SessionAssignment

Canonical per-session Faculty allocation.

SQL:

- `paws.SessionAssignment` 4,970

One Session may have multiple assignments.

This remains the authoritative final Faculty assignment result. Do not create a competing FinalAssignment authority.

## Teaching Responsibility

Experimental/P3.1 future domain.

A durable HICC/VISC operational position, not a person.

HICC responsibility carries exact Course/Subject scope.

VISC responsibility gets review authority from Teaching Assignment Group leadership.

Not yet a Beta-R1 requirement.

## Temporal Responsibility Assignee

Experimental/P3.1 future domain.

Maps an account/person to a stable responsibility for effective half-open windows:

`activeDate <= time < expirationDate`.

Same person may leave and later return.

No automatic DOE proration is implied by duty dates.

## Teaching Assignment Group

Experimental/P3.1 future domain.

Concept:

- leader VISC responsibility
- explicit HICC responsibility members
- active status

**Not the same as `faculty_groups`.**

Firestore `faculty_groups` is the legacy HICC swap/member model and belongs with Change Request/SWAP semantics.

## Teaching Assignment Package / Submission

Experimental/P3.1 future aggregate.

Identity:

`AcademicYear + TeachingAssignmentGroup + StableHiccResponsibility`

Never current assignee UID.

Carries review state and revision/fingerprint evidence.

## Session Assignment Contribution

Experimental/P3.1 future domain.

Actor-scoped suggestion from:

- ADC/DVM
- LAB
- HICC

Suggestion is not final assignment.

VISC review is not a contribution.

## HICC/VISC Review

Experimental/P3.1 future workflow.

Asymmetric chain:

HICC submit → VISC approve/push back → HICC Final Submit → ADFAD.

Review freshness uses package generations; future SQL writes also need normal resource concurrency/CAS.

## ADFAD Finalization

ADFAD chooses authoritative final Faculty assignments.

Result lives in SessionAssignment.

Missing future concerns are decision provenance, package linkage/finalization evidence and audit—not a second assignment table.

ADFAD finalization != timetable Publish.

## LAB Group

Future Beta port; no live Beta rows in the saved inventory.

Group metadata is distinct from roster membership.

Missing referenced group fails closed.

Roster completeness does not block HICC/VISC review or ADFAD readiness.

## LAB Roster

Future Beta port; no live Beta rows in saved inventory.

Contains student/member PII.

Keep separate from group metadata and never publish roster/student identifiers in the Faculty timetable.

## AFC

Two concerns:

1. historical imported AFC → `paws.AfcRecord`;
2. live AFC workflow → currently Firestore in deployed Beta.

Saved Beta snapshot had two live requests and one approved document represented by PDF chunks.

Longer-term SQL direction:

- keep historical and live workflow distinct;
- other teaching workflows generally see only Available/Unavailable;
- approved final document immutable;
- SQL binary storage is preferred for the approved artifact when that work is undertaken.

Not part of BETA-R1 timetable read.

## Explicit Change Request / SWAP

Separate from HICC/VISC review.

Current Beta Firestore had three requests in the saved snapshot.

Legacy `faculty_groups` semantics belong here, not in TeachingAssignmentGroup.

Future SQL apply must revalidate the target/current state at apply time.

## Published Timetable

Future domain.

Working != Published.

Conceptual versioned release:

- release header
- immutable session snapshots
- one active release pointer per Academic Year
- build → validate → seal → activate

BETA-R1 intentionally does not implement it.

## DOE

**Current owner scope:** DOE algorithm/engine remains in the Experimental/Firebase demo repository for now.

Do not redesign or migrate DOE as part of the current Beta database-connection work.

Important invariants to preserve for later:

- independent domain;
- server-side calculation;
- no automatic date proration;
- manual override may be positive, zero or negative;
- Teaching DOE and role DOE are separate evidence lines;
- HICC/VISC review and Publish do not themselves calculate DOE.

## Audit / My Changes

Audit is append-only history, not a second source of current state.

“My Changes” means changes affecting a person, not only changes authored by that person.

Future SQL design should preserve structured domain state and use audit for transitions/history.

## Notifications

Notification is downstream delivery/read state, not workflow truth.

Work queues should derive from domain state.

## Derived caches / operational state

Firestore settings/indexes are derived and rebuildable.

Migration/write-lock behavior is operational state and must be replaced deliberately when the corresponding Azure write path is introduced.
