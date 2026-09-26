# PAWS Current Project State

**Last verified:** 2026-09-26  
**Repository:** `Alex1122341/Teaching-assignment-azure`

This file is intentionally concise. Detailed history belongs in `updates/`.

## 1. Immediate owner priority

**P0: enable and verify the approved ADFA General test account against the CURRENT deployed Azure Beta using Firebase Authentication + Firestore `tester-teaching`.**

The immediate objective is not Azure SQL cutover.

Current Beta access verification should prove, without changing live data:

- the approved Firebase Authentication account exists;
- the matching `users/{uid}` profile exists;
- role is `adfa_general`;
- `active == true`;
- the existing `mustChangePassword` gate behaves as designed;
- the Azure beta host is an authorized Firebase Authentication domain;
- ADFA General loads the existing Faculty Dashboard, timetable, User Management/admin surfaces and Firestore-backed data without permission-denied startup failures.

If any live Firebase mutation is required, stop and obtain explicit owner approval for that exact change.

## 2. Current deployed Beta architecture

For BETA-A1, treat the deployed Beta as:

```text
Azure Static Web App
    -> Firebase Authentication
    -> Firestore project tester-teaching
```

The protected runtime on current `main` remains byte-compatible with the pre-SQL frozen Firebase/Firestore runtime for the existing protected application files.

Do not require the undeployed BETA-R1 API path for BETA-A1.

## 3. Strategic HOLD / deferred work

Deferred until the owner explicitly resumes SQL cutover:

- Azure SQL runtime cutover;
- PR #6 merge;
- Commit B / frozen-baseline promotion work;
- Entra service-principal creation;
- SQL runtime principal activation;
- SQL `paws.UserProfile` activation/provisioning;
- SWA SQL runtime settings;
- BETA-R1 live deployment;
- DOE migration/redesign;
- Published Timetable / P3.1 expansion.

Preserve all completed SQL-cutover work for later. Do not undo it.

## 4. Repository state

### Current main

`ea80eecc9fa2ac2b693c23979bad5c5809a26863`

PR #3 — Azure SQL migration foundation:

- merged to `main`;
- foundation remains preserved;
- do not rerun reset or the initial empty-database loader.

### PR #6 — BETA-R1 Azure SQL timetable read

- still open / Draft;
- base: `main`;
- current PR head at last verification: `c53cddb535947362b13e9cb3858e43b31330c923`;
- **HOLD / DO NOT MERGE for BETA-A1**;
- SQL-backed runtime remains undeployed.

Runtime Commit A is locked/preserved as:

`6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26`

Do not modify or replace Runtime Commit A during BETA-A1.

Commit B / baseline-promotion work is HOLD.

## 5. Current Firebase/Firestore Beta facts

Project:

`tester-teaching`

Current runtime code treats `adfa_general` as a global administrative role:

- admin access is enabled;
- Faculty identity linking is skipped for admin/global accounts;
- `FacultyId` is not required;
- ADFA General is not a Faculty-scoped identity.

Current password gate behavior:

- inactive profile -> access fails closed;
- `mustChangePassword == true` -> redirect to `password.html`;
- successful password-change workflow sets `mustChangePassword=false` and signs the user out to re-authenticate;
- `mustChangePassword == false` -> normal administrative landing continues.

The actual live approved account/profile/domain state must be verified from Firebase/browser evidence. Do not infer it from source code alone.

## 6. Azure SQL checkpoint — preserved, not current activation target

The accepted Azure SQL load remains preserved. Reset/load already completed.

Do not:

- reset SQL;
- rerun initial loader;
- create a runtime SQL principal;
- create an Entra service principal;
- insert SQL UserProfiles;
- deploy PR #6.

## 7. Current breakpoint

**BETA-A1 — controlled ADFA General access verification.**

Read-only next checks:

1. verify the approved Authentication account exists;
2. verify matching `users/{uid}`;
3. inspect role, active and `mustChangePassword`;
4. verify Firebase Authorized Domains includes `red-cliff-04871ca0f.5.azurestaticapps.net`;
5. perform normal approved-account browser login if credentials are already available through the operator flow;
6. verify Faculty Dashboard, timetable, User Management/admin navigation and Firestore-backed data;
7. if a mutation is required, stop and report the single smallest required correction.

No SQL, Azure, Firebase configuration/data mutation, deployment, merge or DOE work belongs in BETA-A1.
