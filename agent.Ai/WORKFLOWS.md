# PAWS Workflow Maps

## 1. BETA-R1 login/read flow

```text
Browser
  ↓ Firebase login
Firebase Authentication
  ↓ ID token
PAWS API
  ↓ verify token
paws.UserProfile exact UID lookup
  ↓ account/role/faculty-link checks
paws.vCalendarSession
  ↓ optional SessionAssignment filter
Existing timetable UI
```

Failure rules:

- no token → unauthenticated;
- no SQL profile → deny;
- inactive profile → deny;
- unsupported role → deny;
- Faculty/HICC/VISC without FacultyId → deny;
- SQL unavailable → service unavailable;
- no Firestore session fallback.

## 2. BETA-R1 mutation flow

Current candidate intentionally has no SQL timetable mutation command.

Legacy edit entry point:

```text
UI write action
   ↓
sessionWritesEnabled()
   ↓ false
fail closed
```

Do not “temporarily” re-enable Firestore writes behind SQL reads without owner approval.

## 3. UserProfile provisioning flow

```text
Reviewed private account evidence
        ↓
exact deterministic manifest
        ↓
preview_beta_userprofile_bootstrap.js
        ↓
validate six intended profiles
        ↓
generate deterministic SQL apply plan
        ↓
STOP
        ↓ owner approval
separate live apply
```

Expected outcome:

- six profiles;
- zero unresolved;
- HICC-2 exclusion;
- no fuzzy identity.

## 4. Azure runtime activation flow

Planned sequence after preview and explicit authorization:

1. provision approved UserProfiles;
2. provision/verify runtime SQL principal;
3. apply narrow BETA-R1 read permissions;
4. configure server-side runtime settings;
5. deploy exact candidate artifact;
6. authenticate as approved Beta account;
7. prove timetable data comes from Azure SQL;
8. prove no browser SQL secret;
9. prove session writes fail closed;
10. record update in `agent.Ai/updates/`.

## 5. Initial Azure SQL import flow

Historical completed flow:

```text
source workbooks
  ↓
hash/parse/validate
  ↓
raw + typed staging
  ↓
deterministic normalization
  ↓
canonical paws tables
  ↓
count/constraint/identity checks
  ↓
commit
```

This was an empty-database foundation operation.

It is complete and should not be used as routine incremental migration tooling.

## 6. Faculty enrichment Phase A

```text
SQL canonical Faculty
      +
Firestore enrichment evidence
      ↓
exact identity reconciliation
      ↓
NULL-only candidate preview
      ↓
review
      ↓
separate live apply (not yet completed at last checkpoint)
```

Existing non-null SQL fields are not casually overwritten.

## 7. Experimental HICC/VISC workflow

Future port/reference only.

```text
Working preparation
   ├─ ADC/DVM contribution
   ├─ LAB contribution
   └─ HICC contribution
           ↓
HICC Submit
           ↓
VISC Review
   ├─ Push Back → changes_requested → revise/resubmit
   └─ Approve → visc_approved
           ↓
HICC Final Submit
           ↓
submitted_to_adfad
           ↓
ADFAD final assignment
```

VISC does not become a contribution author.

ADFAD assignment result belongs in SessionAssignment.

## 8. Experimental Published Timetable flow

Future port/reference only.

```text
eligible Working state
      ↓
build complete Academic-Year release
      ↓
validate
      ↓
seal immutable snapshots
      ↓
atomic activeReleaseId switch
      ↓
Faculty reads active release
```

No Working fallback for Faculty.

Publish != ADFAD finalization.

## 9. Change Request / SWAP

Separate from HICC/VISC review.

Conceptual:

```text
request
  ↓
route/approve/push-back/reject/withdraw
  ↓
all required approvals
  ↓
revalidate current Working/base evidence
  ↓
apply once
  ↓
audit
```

Stale base or availability/conflict change must fail closed.

## 10. AFC live workflow

Current deployed Beta uses Firestore.

Conceptual workflow:

```text
Faculty request
  ↓
coverage/teaching context
  ↓
applicant attestation/signature
  ↓
optional Reports To
  ↓
admin decision
  ↓
approved / rejected / withdrawn
```

Approved artifact should become immutable when ported.

Other teaching workflows consume minimized availability, not AFC reason.

## 11. DOE workflow

DOE engine/algorithm remains Experimental/Demo for now.

Do not add DOE to the immediate Beta activation chain.

Future rule:

- timetable/domain changes produce typed facts;
- DOE engine calculates independently;
- review/Publish do not themselves calculate DOE;
- authorized fact changes may request recalculation.

## 12. Agent handoff workflow

```text
agent starts
  ↓
has reliable recent context?
  ├─ yes → verify task-specific mutable refs
  └─ no  → read agent.Ai continuity docs
  ↓
perform scoped work
  ↓
update current state/task/decision docs as needed
  ↓
write new agent.Ai/updates/* handoff
  ↓
finish
```
