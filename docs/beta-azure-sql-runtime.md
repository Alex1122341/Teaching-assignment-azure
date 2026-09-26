# Beta Azure SQL session-read runtime

This release candidate changes only timetable session reads. Firebase Authentication remains the identity provider. The same-origin Managed Functions API verifies the Firebase ID token, requires an active matching `paws.UserProfile`, and then reads canonical SQL session data. Missing profiles, inactive profiles, unsupported roles, and faculty-shaped profiles without `FacultyId` return controlled denials. No profile is created automatically.

## Runtime permission contract

The preferred contained database principal is `paws_swa_beta`. The reviewed permission script grants `CONNECT` and `SELECT` on exactly these objects:

- five columns of `paws.UserProfile` (`FirebaseUid`, `DisplayName`, `BaseRole`, `FacultyId`, and `Active`), for authorization and the health probe;
- `paws.vCalendarSession`, for canonical calendar rows;
- two columns of `paws.SessionAssignment` (`SessionId` and `FacultyId`), to restrict faculty, HICC, and VISC reads to the linked `FacultyId`.

The runtime does not query `paws.Faculty` directly. `UserProfile INSERT is not granted`; live profile bootstrap is a separate reviewed operator action. The script rejects database ownership, explicit database-role membership, an `EXTERNAL_GROUP` principal, any direct permission outside the reviewed contract, and grants to the implicit `public` role that could broaden access to `paws` or `staging`. Schema-level `INSERT`, `UPDATE`, `DELETE`, and `EXECUTE` are denied on `paws`; all data access and execution are denied on `staging`.

`database/azure-sql/004_swa_beta_permissions.sql` deliberately refuses to create the principal. Creation and execution require separate authorization and are outside this phase. The operator must provision a dedicated user identity and confirm it is not a member of permission-bearing Microsoft Entra groups; SQL database catalogs cannot prove token group membership for an external user.

## Preview and settings

`tools/preview_beta_sql_runtime.ps1` prints the target, intended principal, permission list, required setting names, and Firebase project consistency. It accepts no credential or private bootstrap value and performs no network request or write. `-Apply` is deliberately rejected.

The setting names are `PAWS_SQL_CONNECTION_STRING`, `FIREBASE_PROJECT_ID`, and `FIREBASE_SERVICE_ACCOUNT_JSON`. Their values belong only in the Azure Static Web App configuration. They must never enter Git, logs, the frontend, or the release artifact.

## Freeze and activation gates

The current candidate intentionally changes protected frontend runtime files. `tools/beta-freeze.js` and the frozen baseline commit remain unchanged. Candidate CI verifies a narrow drift allowlist; strict main and deployment gates continue to compare against the frozen baseline. A later, explicitly approved promotion must review the candidate commit and move the baseline before deployment can succeed.

No principal creation, permission application, UserProfile bootstrap, SWA setting change, deployment, merge, or baseline promotion is part of this branch.

## PR #3 reconciliation item

The previously reported PR #3 OAuth helper defect was rechecked at the stacked base `c423929`. `tools/azure_sql_migration/sql_access.ps1` uses the correct `urn:ietf:params:oauth:grant-type:device_code` value and is verified as corrected. This runtime branch does not modify the helper; no PR #3 reconciliation change remains necessary for that spelling.
