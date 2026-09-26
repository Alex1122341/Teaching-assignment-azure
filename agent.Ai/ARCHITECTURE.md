# PAWS Architecture

## 1. Big picture

PAWS is the UCVM Teaching Assignment / Scheduling / Faculty Workload / AFC / workflow system.

The project deliberately has two tracks.

```text
                    PAWS
                     │
        ┌────────────┴────────────┐
        │                         │
Experimental / Demo          Azure Beta
Teaching-assignment          Teaching-assignment-azure
        │                         │
Firebase/Firestore            Azure-hosted Beta frontend
Feature-forward               stability-sensitive
DOE engine/algorithm          Azure SQL migration/runtime
P3.1 experiments              deliberate feature ports
```

There is no automatic repository parity.

## 2. Current Beta connection target

Immediate target:

```text
Browser
  │
  │ Firebase Authentication / ID token
  ▼
PAWS Beta API
  │
  ▼
Azure SQL
teaching-assignment-lab
```

The browser never receives SQL credentials and never connects directly to SQL.

For BETA-R1 the API is a thin read-only bridge, not a redesign of the product.

## 3. Current vs target state

### Current deployed Beta

At the last verified deployed-state checkpoint:

```text
Azure Static Web App
      │
      ├─ Firebase Authentication
      └─ Firestore tester-teaching business data
```

### BETA-R1 candidate, not yet deployed

```text
Azure Static Web App
      │
      ├─ Firebase Authentication
      │       │
      │       └─ Firebase ID token
      │
      └─ same-origin managed API
               │
               ├─ /api/v1/me
               └─ /api/v1/sessions
                       │
                       ▼
                Azure SQL
```

Session writes are disabled/fail-closed in BETA-R1.

## 4. Long-term direction, without making it the current task

The broader target remains:

- Firebase Authentication may remain.
- Azure SQL becomes the Beta business persistence layer as domains are deliberately ported.
- Firestore remains the Experimental/Demo implementation.
- Do not force all future P3.1/DOE work into the first Beta connection milestone.
- No direct browser SQL.
- No silent Firestore fallback for a domain once that domain is activated on the Azure SQL path.

## 5. Application shape

Preferred shape is a modular monolith, not microservices.

Logical modules:

- Identity / account access
- Faculty / directory
- Course / Subject catalogs
- Working timetable
- Session assignments
- Teaching responsibility / group / review (future Beta port)
- LAB (future Beta port)
- AFC
- Change Request / SWAP
- DOE (Experimental for now)
- Published timetable (future Beta port)
- Audit / delivery

Each module owns its business invariants even if deployed in one application.

## 6. Data layers

### Azure SQL foundation already loaded

Canonical base data:

- Faculty
- Course
- Session
- SessionAssignment
- RoleDefinition / RoleAssignment
- historical AFC
- raw/typed staging evidence
- Calendar SQL view

### Firestore current Beta runtime

Until BETA-R1 is activated, current deployed Beta still uses Firestore for its existing runtime.

### Experimental-only/future structures

P3.1 entities such as TeachingResponsibility, TeachingAssignmentGroup, TeachingAssignmentSubmission and SessionAssignmentContribution are future feature architecture and are not a prerequisite for the first SQL-backed Beta timetable read.

## 7. Authority boundaries

Core principles retained across tracks:

- Person != Responsibility.
- Responsibility != role label.
- UI capability != backend authorization.
- Working timetable != Published timetable.
- Contribution suggestion != final Faculty assignment.
- HICC/VISC review != Change Request.
- Topic != Subject.
- ADFAD finalization != Publish.
- SessionAssignment is the authoritative final assignment result.
- DOE is an independent domain.

## 8. Read/write ownership

### BETA-R1

Reads:

- profile → `paws.UserProfile`
- timetable → `paws.vCalendarSession`
- Faculty-scoped timetable filtering → `paws.SessionAssignment`

Writes:

- timetable writes disabled
- no Firestore fallback
- no DOE changes
- no live provisioning inside the implementation PR

### Future write enablement

When writes are added, they must be domain commands, not generic CRUD, with:

- server-owned actor
- authorization
- expected/current version checks
- transactional domain update
- audit
- no alternate privileged writer bypassing the same invariants

## 9. Repository/release architecture

Azure Beta is intentionally stability-sensitive.

- no feature work directly on `main`;
- feature branch/worktree + PR;
- exact-SHA build/release controls;
- no automatic Experimental → Beta merge;
- no deployment merely because a PR is green;
- live apply/deploy is a separate owner-authorized operation.

## 10. Documentation/evidence layers

Always distinguish:

- live Azure SQL state;
- Draft SQL design/PR state;
- current deployed Firestore runtime;
- future Experimental/P3.1 target.

The word “implemented” alone is not sufficient to describe live state.
