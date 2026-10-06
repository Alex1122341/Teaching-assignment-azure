# PAWS University API — future service identity and cutover runbook

**Status:** preparation only; no service, SQL principal, permission, Firebase, or host configuration changed by W1E.
**Target:** `ITAPPVETOPSDB01`; database `VetMed-Ops`.

## Required identity decision

Ask University IT to confirm/provision an organization-managed gMSA for the API service, if available and supported by the host/domain. Prefer this passwordless Windows-integrated model. Confirm service-logon eligibility, SQL SPN/Kerberos behavior for the FQDN TCP connection, and any Firebase Admin network dependency. Do not assume availability. If gMSA is not viable, evaluate the existing `NT SERVICE\PAWSApi` virtual service account on this same host and prove it can authenticate to the SQL listener before considering the IT-managed dedicated domain-account fallback. Do not use a personal SA/DBA identity as the application identity.

## Configuration contract

Before provisioning or changing a service, capture the reviewed release SHA and artifact hash, then install into a versioned, immutable directory such as `C:\PAWS\Runtime\Versions\<verified-release>`. Configure the `PAWSApi` service to run the approved Node executable with entry point `src/runtime/university-api.js`, that directory as its working directory, and loopback binding only. Require automatic startup, bounded restart-on-failure recovery, a documented reset interval, structured sanitized logs with rotation, and least-privilege ACLs for the selected service identity and administrators. No interactive session, developer checkout, secret-bearing command line, plaintext credential file, or bearer-token logging.

Provide nonsecret environment settings through approved machine/service configuration. Current source can use Firebase Admin default credentials or `FIREBASE_SERVICE_ACCOUNT_JSON`; select an IT/security-approved managed or federated credential method before activation, and never commit its value. Keep SQL TLS encryption and certificate validation enabled. Keep `PAWS_AFC_SINGLE_WRITE_ENABLED`, `PAWS_AFC_BATCH_WRITE_ENABLED`, and `PAWS_SESSION_EDIT_WRITE_ENABLED` false during identity cutover.

## Ordered cutover evidence

1. University IT provisions or confirms the nonpersonal identity and returns the supported service-logon and SQL-authentication model; DBA separately reviews the local-only SQL artifact.
2. In a controlled change, install the immutable release and configure service identity, working directory, environment, ACLs, recovery, logging, and health monitoring. Keep all write gates disabled.
3. Map the dedicated identity to the database using only the separately reviewed least-privilege read role. Do not grant `db_owner`, `CONTROL DATABASE`, `sysadmin`, broad schema control, broad DML, or schema-wide `EXECUTE`.
4. Verify the running process owner, service state, release SHA/hash, host/port, working directory, and Windows-integrated authentication without displaying secrets.
5. Under the actual runtime identity, verify `SUSER_SNAME()`, database user, role membership, explicit grants, and `fn_my_permissions`; prove no broad authority. Capture authenticated read-only `/api/v1/me`, timetable, and dashboard smoke tests using an approved test account.
6. Prove service restart/recovery and rollback using the previous immutable release and its separately documented identity/SQL mapping. Do not use production business writes as smoke tests.
7. Only after read acceptance and a separately approved future write activation plan may W1C gates or domain write grants be considered. W1E provides no activation approval.
8. Once cutover and rollback are proven, remove only the application runtime's dependence on the personal SA under a separately approved DBA change. Preserve the owner's legitimate DBA access; do not lock out administrative access.

## Rollback boundary

If service startup, authentication, health, or read checks fail, stop the new service, restore the recorded prior release/configuration through the change owner, and re-verify the previous read-only behavior. Remove a newly mapped application principal/role membership only through a reviewed, reversible DBA rollback. Never remove the owner's DBA login or alter the three default-off gates as an emergency shortcut.

## Current pre-cutover blockers

- The live API was a loopback Node process launched interactively under a personal SA identity, not the disabled `PAWSApi` placeholder service.
- The matched SQL identity has `db_owner`; it is unsafe for write activation and violates least privilege.
- The process's exact source commit and working directory were not attested because the server source directory is not a Git worktree.
- University IT must confirm the supported nonpersonal service identity and Firebase Admin credential model. The organization's account inventory was not inspected, so W1E does not assert that a gMSA or other account is absent.
- `database/azure-sql/017_w1e_runtime_least_privilege.sql` is a local-only proposal and has not been executed or SQL-Server-parsed.
