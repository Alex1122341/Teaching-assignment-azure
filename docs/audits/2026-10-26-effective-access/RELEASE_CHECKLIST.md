# SEC-01 coordinated release checklist

Status: prepared, not executed. PR148 stays Draft until prerequisites and actual role acceptance pass. Do not infer publication from an immutable freeze promotion, candidate ZIP or green CI.

## Credential prerequisite

The2026-10-26 school-server probe returned `ADC_UNAVAILABLE`. The current temporary launcher removes `FIREBASE_SERVICE_ACCOUNT_JSON`; no ADC path/default credential was found. An authorized operator must configure an approved Google service identity for the API process, for project `tester-teaching`, with only the Firestore/Auth permissions required by the existing verifier and reviewed collaboration adapters. The credential stays in protected server storage; no key, token or JSON belongs in chat, Git, Hosting, public health output or the progress workbook. Do not reuse Firebase CLI refresh tokens.

The existing verifier supports `FIREBASE_SERVICE_ACCOUNT_JSON` containing JSON, or the Firebase Admin SDK's configured application-default credential. An ADC file path is not JSON and must not be passed as `FIREBASE_SERVICE_ACCOUNT_JSON`. Prepare a candidate launcher/config with the approved mechanism; preserve the old launcher and its effective27-gate configuration. Do not restart the live API merely to test credential presence. First repeat the private bounded credential/read probe; print readiness/error code only, never document contents or credentials. Then prove the actual named `paws-beta-sql` application can use the adapters. A successful token retrieval alone is insufficient.

This prerequisite is unrelated to the waived dedicated Windows SQL service-account requirement. No new Windows account is requested by this checklist. If the credential cannot be prepared, keep the current runtime, frontend, rules and gates unchanged.

## Candidate acceptance

1. Verify exact PR HEAD, latest main ancestry, independent product findings/fixes and separately reviewed governance. All final required root/server/emulator/SQL checks must pass. Validate official ZIP metadata and digest; verify static/API artifact freezes. A local candidate is never an official CI artifact or a deployment.
2. Retain current API source/config, Hosting release identity, exact Firestore rules source/release identity, previous27 gate values, current recovery configuration and tested recovery artifacts. Recheck live runtime/SQL/CORS and public assets because main can advance independently. Do not replay old data migrations/imports.
3. Before applying060, inspect exact database/schema/principal collisions and grant inventory read-only. SQL060 refuses any existing feature principal; do not drop/reuse one to bypass the guard. Run only the approved migration, not the disposable fixture or acceptance script, on production. No real account role/active/faculty changes are part of acceptance.
4. Stage the exact API artifact with accountAccess/collaboration disabled. Confirm prior gate values and API identity. Bind only the accepted runtime principal to the newly created feature role as a separately recorded deployment grant. Do not use broad db_owner as proof of the new narrow grant. Enable only the reviewed domains when acceptance is ready.
5. Validate existing real Owner, Administrator, HICC, Faculty, protected Developer and unavailable-profile cases through normal authentication without test role changes. Owner catalog/list/history and preview may be read; do not commit a real grant or create/edit a real group/announcement to manufacture evidence. HICC gets own groups and sanitized choices, no other faculty contacts or course/DOE grants. Administrator retains existing business access but cannot edit grants. Faculty sees own summary; direct privileged endpoints fail. SQL-isolated tests supply destructive/ABA/concurrency/audit evidence.
6. Verify replacement Information Center/group reads on the actual candidate, plus Calendar/Dashboard/Assignments/Availability and password recovery. Publish generated Hosting assets and separately deploy the reviewed restrictive rules only in a coordinated window after replacements pass. Hosting uses `--only hosting`; it must not implicitly deploy rules/indexes/Functions. Do not leave restrictive rules active with the old browser adapters.
7. Confirm public hashes against the exact official artifact, API/rules identity, normal logins and direct denies, prior gates, error/retry paths and recovery CheckOnly. Record honest scope and remaining human business signoff in the original workbook.

## Recovery

- Before any account operation, stop/disable new writes and restore the saved API/config/Hosting/rules together if candidate acceptance fails. Preserve every pre-existing audit/business record.
- Empty060 rollback must first pass its guards. Never force an empty rollback after an operation or role binding exists. Used rollback disables the feature while retaining operation/audit/schema history; do not delete evidence to satisfy rollback prerequisites.
- Ambiguous account commits use the same operation UUID and persisted receipt readback; never submit a new operation or report “unchanged” solely because the response was lost.
- Reverify source identities, API/SQL/CORS, public assets and gate values after recovery. An old successful recovery receipt is historical, not a new reboot test.
