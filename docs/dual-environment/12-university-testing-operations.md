# University Testing operations — implementation in progress

## Approved topology

Temporary API: VET-C31293, 127.0.0.1:18788. Online SQL: ITAPPVETOPSDB01 / VetMed-Ops-Testing. Separate Firebase project: paws-testing-ucvm-20261022. LocalDB is disposable acceptance infrastructure only. Production remains VetMed-Ops; no Production migration/reset/grant or gate change accompanies this work.

## Tool boundaries

`connection-profile.js` accepts only the resolved University Testing Windows profile with strict TLS. Ordinary query/batch entrypoints recheck the physical server, database and UUID. Bootstrap exposes only fixed metadata inspection and transactional empty initialization. `reset-testing-db.js` verifies the entire reviewed 61-input manifest before connecting and preserves source/transformed/effective canonical UTF8/LF hashes. Original Production migrations stay unchanged.

`university-admin.js` currently implements orchestration and permission-audit policy with injected, trusted administrative capabilities. It is **not yet a runnable live provisioning command**: its SQL transport, owned backup/restore implementation and real same-instance/two-instance acceptance remain pending. A synthetic callback returning success is not evidence of a real backup, lock, SQL mutation or permission audit. Do not attach arbitrary callbacks or expose these capabilities through an HTTP endpoint.

Reset confirmation binds RESET-TESTING, physical server, exact database and UUID. A listed operator, serialized lock, positively verified stopped Testing API, matching marker and private verified backup are prerequisites. Backup or confirmation failure makes zero destructive calls. Recheck marker after backup and after reset; retain failure receipt/backup and remain not-ready on any partial failure. Never automatically rotate an operator password or restart a failed target as ready.

Runtime suitability requires effective permissions plus direct/group/public/class0 grants, login/user tokens, database/schema/object ownership and cross-database access checks. A broad existing account is unsuitable; do not remove its Production permissions or label it least-privileged. Metadata-only HAS_DBACCESS verifies access without reading Production rows. TRUSTWORTHY, DB_CHAINING and guest CONNECT must remain off. Native SQL must verify these queries before they can support a release claim.

## Local prerequisite checkpoint — 2026-10-22

VET-C31293 currently has no SqlLocalDB executable and only the legacy SQL Server ODBC driver. The active Windows session is not elevated. Microsoft-signed installers were downloaded to the user's private paws-dev-tools cache:

| File | SHA256 | Signature |
| --- | --- | --- |
| msodbcsql18-x64.msi | 21EF69E4B942F18ACED55FA7C3A8D7263004E113A96690BAC7509645E1B1A310 | Microsoft Corporation, Valid |
| SQL2025-SSEI-Expr.exe | FA7E1FABC9A2E9C9CDAB0D1512BCB30D2949133147DB057AC530F510E5270680 | Microsoft Corporation, Valid |

Sources: [ODBC download](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server), [SQL2025 Express download](https://www.microsoft.com/en-us/download/details.aspx?id=108836), [LocalDB installation](https://learn.microsoft.com/en-us/sql/database-engine/configure-windows/sql-server-express-localdb).

Download-only bootstrap launch requested elevation; Windows returned “operation was canceled by the user.” No LocalDB media/install succeeded and no ODBC install was attempted. Do not retry elevation or bypass device policy. Installation/license/device approval is pending human action. No disposable SQL instance/database or University Testing database has been created by this implementation.

## Remaining Task3 acceptance

Finish concrete administrative SQL/backup transport and shared-instance harness; install approved LocalDB/ODBC prerequisites; run both fresh disposable harnesses; preserve fingerprints and target/driver/engine receipts. Only after all synthetic SQL checks pass may the bounded live inventory/provisioning step run. Verify real strict TLS, actual runtime identity and effective cross-database denial from VET-C31293. An earlier launcher-parsing failure or this desktop's short-name DNS lookup is not evidence that the University database is absent or that its server-side operator lacks access.

Independent account-provisioning/host/workflow code may proceed while these human prerequisites remain pending. Task3 is not complete, and no merge/deployment readiness follows from its unit tests.
