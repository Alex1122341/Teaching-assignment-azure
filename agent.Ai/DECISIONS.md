# PAWS Locked Decisions

Only change this file when the owner/architect explicitly changes a decision.

## Repository roles

**LOCKED**

- `Teaching-assignment` = Experimental / feature-forward / Firebase demo track.
- `Teaching-assignment-azure` = controlled/stability-sensitive Azure Beta track.
- no automatic repository synchronization.
- mature behavior is deliberately ported.

## Immediate Beta priority

**LOCKED 2026-09-26 — STRATEGY CHANGE**

Current P0 is **ADFA General access to the existing Firebase/Firestore-backed Azure Beta**.

For the current task, the deployed architecture is:

```text
Azure Static Web App
  -> Firebase Authentication
  -> Firestore tester-teaching
```

Azure SQL cutover is deferred.

This supersedes the earlier immediate-priority decision that SQL activation must happen before ordinary Beta access verification.

## ADFA General access

**LOCKED FOR BETA-A1**

- use the already-approved ADFA General Beta account;
- do not create a new account unless separate evidence later proves the approved account genuinely does not exist and the owner separately authorizes creation;
- expected application role is `adfa_general`;
- expected account is active;
- ADFA General is a global/office administrative identity, not Faculty-scoped;
- FacultyId is not required;
- do not enable Developer-only or Owner-only controls merely to increase apparent privilege;
- use existing Beta role/capability behavior.

Password gate:

- `mustChangePassword=true` means the existing application intentionally redirects to the password-change page;
- successful password change sets the flag false and requires sign-in again;
- do not flip the flag merely to bypass the designed workflow;
- if the flag itself is incorrect for the approved operator flow, stop and request approval before changing it.

## Firebase mutation boundary

**LOCKED FOR BETA-A1**

Default is read-only.

Do not, without separate owner approval:

- create/delete Authentication accounts;
- change passwords;
- change role;
- change `active`;
- change `mustChangePassword`;
- change Firebase Authorized Domains;
- change Firestore rules;
- write application data;
- deploy.

If a live defect requires one of these actions, report the smallest exact mutation and stop.

## SQL cutover

**DEFERRED / HOLD 2026-09-26**

Preserve the completed SQL-cutover work but do not activate it during BETA-A1.

Deferred:

- PR #6 merge;
- Commit B / baseline promotion;
- Entra service principal;
- runtime SQL principal/grants;
- SQL `paws.UserProfile` activation;
- SQL runtime settings;
- BETA-R1 deployment.

Runtime Commit A remains:

`6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26`

Do not modify it during BETA-A1.

## Azure SQL baseline

**LOCKED / PRESERVE**

- reset/load already completed;
- do not rerun reset;
- do not rerun the initial empty-database loader;
- do not modify SQL for BETA-A1.

## DOE

**LOCKED**

- DOE algorithm and engine remain outside the current Beta access task;
- do not migrate DOE to Azure now;
- do not redesign DOE now;
- do not create a new DOE engine;
- DOE must not block BETA-A1.

## Authentication

- Firebase Authentication remains the login mechanism for the existing Beta.
- Firestore `users/{uid}` remains the current deployed profile/role gate for BETA-A1.
- Azure SQL/Entra identity work is not required for BETA-A1 success.

## Beta deployment

- CI success != deployment.
- no deployment or merge without explicit owner authorization.
- BETA-A1 does not require deployment.
- a 404 on undeployed BETA-R1 `/api/v1/*` routes is irrelevant to BETA-A1.

## Existing architecture decisions preserved for later

- no fuzzy identity matching;
- Person != Responsibility;
- Responsibility != role label;
- Working != Published;
- Contribution != final assignment;
- HICC/VISC review != Change Request/SWAP;
- Topic != Subject;
- ADFAD finalization != Publish;
- `SessionAssignment` remains the authoritative final assignment result for the SQL architecture;
- Published Timetable and P3.1 future-domain work remain separate.

## Superseded assumptions

Do not reuse these without re-verification:

- “Azure-hosted means Azure SQL-backed” — false.
- “SQL cutover is the current P0” — superseded by BETA-A1 access verification.
- “PR #6 must deploy before ADFA General can test the current Beta” — false.
- “ADFA General requires a SQL UserProfile for the current Beta” — false.
- “FacultyId is required for ADFA General” — false.
