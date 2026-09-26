# PAWS Task Chain

**Last updated:** 2026-09-26

## P0 — CURRENT: BETA-A1 ADFA General access

Goal:

**Allow and verify the approved ADFA General test account on the existing Firebase/Firestore-backed Azure Beta.**

Architecture under test:

```text
Azure Static Web App
  -> Firebase Authentication
  -> Firestore tester-teaching
```

### BETA-A1 — controlled access verification

Status: **CURRENT / READ-ONLY**

Verify:

1. Beta site reachability;
2. approved Firebase Authentication account exists;
3. matching `users/{uid}` profile exists;
4. role is `adfa_general`;
5. `active == true`;
6. current `mustChangePassword` state and expected redirect behavior;
7. Azure beta hostname is in Firebase Authorized Domains;
8. normal browser sign-in succeeds without redirect loop;
9. account is not treated as Faculty;
10. Faculty Dashboard / timetable / User Management or other existing ADFA General admin surfaces load;
11. existing Firestore-backed data loads without startup permission-denied errors.

Mutation policy:

- default read-only;
- do not change account, password, role, active, `mustChangePassword`, authorized domains, Firestore rules or application data;
- if one correction is required, stop and request approval for that exact mutation.

### BETA-A2 — minimal approved access correction, only if needed

Status: **NOT AUTHORIZED**

Exists only if BETA-A1 identifies one specific blocking configuration/profile defect and the owner separately approves the exact fix.

Do not bundle unrelated changes.

## SQL cutover track — DEFERRED / HOLD

### BETA-R0 — SQL foundation/import

Status: **COMPLETE / PRESERVED**

- PR #3 is merged.
- SQL reset/load already completed.
- do not rerun reset or initial loader.

### BETA-R1 — Azure SQL timetable runtime

Status: **IMPLEMENTED / PRESERVED / NOT DEPLOYED**

- PR #6 remains Draft and must not be merged for BETA-A1.
- Runtime Commit A: `6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26`.
- preserve Firebase Auth -> managed API -> Azure SQL implementation for later.
- no Firestore session fallback in that candidate.
- session writes remain disabled in that candidate.

### Commit B / frozen-baseline promotion

Status: **HOLD**

Do not advance, replace or merge baseline-promotion work while BETA-A1 is the P0.

### SQL / Entra activation

Status: **HOLD**

Deferred:

- Entra service principal;
- SQL runtime principal/grants;
- `paws.UserProfile` activation;
- SQL runtime application settings;
- BETA-R1 deployment and SQL E2E smoke.

## DOE

Status for this Beta priority: **HOLD / OUT OF SCOPE**

Do not migrate, redesign, deploy or use DOE work to block BETA-A1.

## Later work

Only after the owner changes priority:

- resume SQL cutover and Commit B;
- SQL UserProfile/runtime activation;
- live SQL-backed Beta deployment;
- session reconciliation/write APIs;
- P3.1 future domains;
- Published Timetable;
- DOE SQL port;
- complete Firestore retirement.
