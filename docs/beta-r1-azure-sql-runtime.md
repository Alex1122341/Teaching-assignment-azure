# PAWS Azure Beta-R1 runtime candidate

Beta-R1 is a read-only timetable data-source substitution. It does not migrate DOE, Published Timetable, P3.1 domains, or workflow writes.

## Runtime path

```text
Beta browser
  -> Firebase Authentication
  -> Firebase ID token in Authorization: Bearer
  -> same-origin Azure Static Web Apps managed API
  -> paws.UserProfile authorization
  -> paws.vCalendarSession (+ SessionAssignment only for Faculty-scoped roles)
  -> existing timetable UI
```

The browser never receives an Azure SQL connection string or SQL credential. There is no generic SQL/query endpoint and no Firestore fallback for the timetable session read path.

## Endpoints

- `GET /api/v1/me` — verified Firebase token plus exact `paws.UserProfile.FirebaseUid` lookup.
- `GET /api/v1/sessions` — full canonical calendar view for approved non-Faculty Beta/global accounts; optional `start` and `end` query parameters are an inclusive/exclusive bounded range.
- Faculty-scoped roles are exactly `faculty`, `hicc`, and `visc`; they require an exact SQL `FacultyId` and are filtered through `paws.SessionAssignment`.
- Current legacy `viewer` Beta accounts remain non-Faculty. This preserves the reviewed DVM/LAB account decision and deliberately rejects fuzzy identity matching.

## Required server settings at deployment time

The managed API expects:

- `PAWS_SQL_CONNECTION_STRING` — server-side only.
- `FIREBASE_PROJECT_ID=tester-teaching`.
- `FIREBASE_SERVICE_ACCOUNT_JSON` only when the chosen Firebase Admin runtime credential strategy requires it; never ship it to the browser.

The SQL login/user used by `PAWS_SQL_CONNECTION_STRING` must be the dedicated `paws_swa_beta` principal reviewed by `database/azure-sql/004_swa_beta_permissions.sql`. That script grants only the read columns/objects required by Beta-R1 and denies `paws` writes and all `staging` access. Applying or creating that principal is a separate operator action and is not performed by this branch.

## UserProfile bootstrap gate

The live `paws.UserProfile` table is currently empty. Beta-R1 therefore cannot authorize a real browser session until the reviewed test accounts are provisioned.

`tools/preview_beta_userprofile_bootstrap.js` is intentionally offline: it validates a private exact-account manifest and can generate a private SQL apply file, but it has no database transport and performs no live write.

The approved shape is six SQL profiles plus one explicit exclusion:

- 1 HICC-1 row: `baseRole=hicc`, exact reviewed SQL `FacultyId` GUID required.
- 2 non-Faculty viewer rows: DVM and LAB, `FacultyId=NULL`.
- 3 global/admin rows: 2 `adfa_general`, 1 `administrator`, `FacultyId=NULL`.
- HICC-2: excluded with `HUMAN_CONFIRMED_DELETE_ACCOUNT`; no SQL profile.

Because the exact private Firebase UIDs/emails and HICC-1 GUID are not committed to the repository, the apply artifact must be generated from the previously reviewed private reconciliation evidence. Do not infer or fuzzy-match any identity.

## Safety boundary

This branch contains no database execution step for UserProfile provisioning, does not deploy, and leaves all Azure SQL session mutation paths disabled. Existing legacy Firestore session mutation code is retained only to avoid a product rewrite, but every timetable mutation entrypoint fails closed while `sessionWritesEnabled() === false`.
