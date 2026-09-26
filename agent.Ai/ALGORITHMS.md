# PAWS Algorithms and Invariants

This file records the important algorithms/decision rules agents must preserve. It is not executable code.

## 1. Faculty identity resolution

For migration/reconciliation, use deterministic evidence only.

Preferred sequence when applicable:

1. exact UCID
2. exact normalized email
3. exact preferred source name
4. unique exact HR/source name
5. explicitly approved alias

Rules:

- no fuzzy name matching;
- ambiguous match = unresolved;
- placeholder/pool identities are not silently converted into real Faculty;
- source lineage is preferred over display-name inference.

## 2. Canonical Faculty naming

Use Preferred Name when available.

Canonical display form:

`First, Last`

Do not overwrite canonical display identity from a weaker source merely because that source is newer.

## 3. Faculty enrichment Phase A

Locked narrow behavior from PR #5 planning:

- existing non-null SQL authoritative value wins;
- only SQL NULL is eligible for deterministic enrichment;
- blank/null/whitespace Firestore FTE evidence defaults to 1.0 under the approved rule;
- nonblank malformed values fail closed;
- explicit out-of-range values such as >1.0 are not silently normalized;
- no fuzzy Faculty matching;
- enrichment provenance is separate from the original Faculty import provenance.

## 4. Session import normalization

The foundation importer groups source teaching rows into canonical Session + SessionAssignment structures.

Important cautions:

- content-derived session keys are import/deduplication aids, not future runtime primary-key algorithms;
- mutable scheduling fields must not become the enduring identity of a live session;
- assignment IDs derived from source row positions are stable only for that reviewed import layout;
- former-Faculty exclusion can remove assignment rows without necessarily proving the Session itself should be deleted.

Accepted canonical load:

- source assignment rows previously reported: 4,974
- canonical SessionAssignment: 4,970
- four unresolved/former-Faculty assignment rows were held out

## 5. Firestore ↔ SQL session reconciliation

Do not infer “76 missing rows” from 1,861 vs 1,937.

Required classification:

- exact one-to-one matched
- SQL-only
- Firestore-only
- one-to-many
- many-to-one
- conflicting-content
- ambiguous

Use deterministic business/source identifiers where available.

If an exact ID is not shared, compare normalized business facts deliberately and record omitted discriminators (room/group/etc.). Never fuzzy merge sessions.

## 6. Beta account provisioning

Saved Firestore account snapshot: 7 active accounts.

Reviewed SQL target: 6 profiles.

Rules:

- HICC-1 → exact approved FacultyId
- HICC-2 → excluded; reason `HUMAN_CONFIRMED_DELETE_ACCOUNT`
- DVM viewer → non-Faculty, FacultyId NULL
- LAB viewer → non-Faculty, FacultyId NULL
- two ADFAD General + one administrator → FacultyId NULL
- no fuzzy matching
- do not silently auto-create a profile after Firebase login

## 7. BETA-R1 authorization algorithm

Candidate PR #6 flow:

1. browser authenticates with Firebase;
2. browser obtains Firebase ID token;
3. API verifies token server-side;
4. API reads exact `paws.UserProfile.FirebaseUid`;
5. profile must be active;
6. password-change gate must not be active under current BETA-R1 policy;
7. role must be supported;
8. Faculty-scoped roles (`faculty`, `hicc`, `visc`) require exact FacultyId;
9. server, not request JSON, determines actor/role/FacultyId;
10. authorized request may read SQL timetable.

No SQL profile = fail closed.

## 8. BETA-R1 session read algorithm

`GET /api/v1/sessions`:

- source = `paws.vCalendarSession`;
- date range is validated server-side;
- Faculty-scoped profiles use `paws.SessionAssignment` filtering;
- non-Faculty office/test profiles are not forced through Faculty matching;
- no Firestore session fallback;
- timetable writes disabled.

The frontend maps SQL view rows into the existing timetable UI shape without redesigning the UI.

## 9. Teaching responsibility authority (Experimental/P3.1)

HICC authority requires all relevant pieces:

- stable HICC responsibility;
- current temporal assignee;
- exact Course/Subject scope;
- explicit group membership;
- trusted session/package ownership;
- correct package context.

VISC authority requires:

- stable VISC responsibility;
- current temporal assignee;
- leadership of the relevant Teaching Assignment Group.

Role label alone is never enough.

## 10. Temporal assignee windows

Conceptual rule:

`activeDate <= now < expirationDate`

Windows are half-open.

Requirements:

- expiration after active date;
- no conflicting overlap for exclusive duty;
- same person may leave and later return;
- use trusted server time for authorization decisions.

## 11. Teaching Assignment package identity

Deterministic concept:

`AcademicYear + Group + StableHiccResponsibility`

Never person UID.

This preserves package/history identity when the human assignee changes.

## 12. Review lifecycle and stale-review protection

Conceptual lifecycle:

```text
draft
 → visc_review
 → visc_approved
 → submitted_to_adfad
 → adfad_finalized

visc_review
 → changes_requested
 → revise/resubmit
```

Generation fields:

- `workingRevision`
- `submittedWorkingRevision`
- `viscApprovedWorkingRevision`

Rules:

- submit pins current Working generation;
- VISC approval requires submitted generation still current;
- HICC Final Submit requires current = submitted = approved generation;
- review-relevant Working edit advances generation and invalidates prior approval;
- fingerprint is supporting evidence, not the sole authorization boundary.

Future SQL implementation additionally needs normal per-resource CAS/versioning to prevent editor lost updates.

## 13. Contribution algorithm

Contribution key concept:

Session + source role + actor.

Allowed sources:

- ADC/DVM
- LAB
- HICC

Each actor owns only their own suggestion payload.

VISC review is separate.

ADFAD performs the authoritative final assignment.

## 14. Published release algorithm (future)

Conceptual:

1. build a complete candidate release for one Academic Year;
2. validate completeness/privacy/source consistency;
3. seal immutable snapshots;
4. atomically compare expected current pointer and activate new release;
5. on failure keep prior active release unchanged.

Working edits never mutate sealed releases.

Restore normally creates a new forward release from previous sealed evidence.

No release means Faculty sees “not yet published”; never silently fall back to Working.

## 15. Change Request / SWAP stale protection

A request must retain base evidence.

At apply time:

- re-read current Working state;
- recheck approvals still correspond to the current scope/signature;
- recheck incoming Faculty availability/conflicts;
- fail closed if stale;
- apply once;
- audit the transition.

Approval != Publish.

## 16. AFC privacy/integrity

Privacy:

- other teaching workflows receive binary availability where possible;
- reason/details remain restricted.

Approved document target:

- exact approved bytes;
- hash + byte length + metadata bound to approval;
- immutable original;
- later correction/cancellation represented as a new authorized event, not mutation of the sealed original.

## 17. DOE scope guard

Current Beta task rule:

**Do not touch the DOE engine or algorithm.**

DOE work remains in Experimental/Demo until owner changes scope.

Future invariants:

- no automatic prorate from role dates;
- manual override supports positive/zero/negative;
- NULL means no override;
- rule engine is independent from timetable workflow;
- Publish and HICC/VISC review do not themselves calculate DOE.

## 18. Beta release/freeze algorithm

Beta release discipline:

- build exact candidate SHA;
- verify frozen/protected runtime assets;
- use successful exact-SHA Beta build evidence;
- deploy only through explicit manual release authorization;
- normal push does not release Beta;
- never infer deployment from CI success.

## 19. Migration safety

Initial reset/load is complete.

Future migrations must be additive/recoverable.

Do not reuse the empty-database loader as a normal migration mechanism.

Before a live apply:

- preview;
- verify preconditions;
- capture exact source/target state;
- use deterministic identity;
- stop on ambiguity;
- record provenance;
- validate postconditions;
- never silently fall back to a different data source.
