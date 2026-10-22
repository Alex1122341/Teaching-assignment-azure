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

## Task4 account tooling checkpoint

Account provisioning now uses the shared guarded Windows connector for the University profile. It verifies target/UUID and the complete reserved synthetic profile set before initializing Auth. Privileged synthetic personas remain disabled/switch-only; named operators must have distinct emails and UIDs. Existing named operator passwords are not changed. Normalize roles with the existing shared policy; do not infer or create a real operator from an incidental spreadsheet email.

Explicit service-account JSON must identify the Testing project. Malformed JSON, SDK and SQL failures receive fixed public error text; raw passwords, private keys, paths and SDK errors are never echoed. Synthetic test output excludes emails and passwords. The original first two CLI arguments remain compatible; an optional third dependency object supports unit tests only.

Task4 code regressions pass, but no real Auth account or provider setting was changed. The independent Testing SQL database, authorized Testing credential/operator input and real token/disabled-user verification remain pending. Do not stage the old099 API artifact or call these unit tests real deployed UAT. Ordinary SQL reset does not call Auth provisioning or rotate named operator passwords.

## Task5 desktop supervisor preparation

The `tools/testing-host/Invoke-PawsTestingHost.ps1` wrapper accepts Stage/Start/Check/Stop, verifies a signed/hash-pinned Node22 binary, and delegates to the private host policy. Copy `testing-host.template.json` into the private root and fill verified values; the public template contains no credential body. A draft profile has been prepared locally with all27 gates false and an allocated, **not SQL-verified** UUID. No secret file was created. The Windows profile root is `%LOCALAPPDATA%/PAWS/Testing`, outside Git/OneDrive/Hosting.

Stage reads private `candidate-input.json` containing the exact repository, commitSha, sourceRun number, artifact id/archivePath/apiPath and clean checkout. It fetches current GitHub metadata, compares PR/main/merge trees, raw ZIP SHA256 and immutable API freeze, rejects linked/unsafe/extra files, installs the frozen server lock graph with a clean OS-only environment and pins supervisor/API/dependency bytes. No Firebase credential is passed to dependency installation. Stage fails while current source is unpromoted or fresh official artifact metadata/configuration is missing; an old099 artifact is insufficient.

Private `secrets/credentials.json` accepts only `{ "firebaseServiceAccount": <actual Testing-scoped service-account object> }`; never add arbitrary environment overrides. Credentials are read only for the real API process, whose environment is constructed explicitly with Windows SQL, strict TLS, exact Testing Firebase, loopback/port/CORS and the complete27-gate map. Named account/credential entry is a human prerequisite; do not copy Production keys or invent values.

Start rejects reset locks, unknown listeners, wrong Node/identity/target, drifted files and insufficient capacity. It spawns the real `university-api.js` hidden and records exact PID/start time/binary/entrypoint. Stop rechecks those fields immediately before terminating only that owned process, including a verified API still waiting for SQL. Check reads files/processes/health only and writes no receipt or configuration. Tunnel PID/binary/start time and latest bounded origin log must match the independent loopback ingress; drift is NOT_READY and never edits source.

Retention checks require8GiB free and refuse additional staging above2GiB; no unknown file or active/rollback/evidence directory is automatically removed. Raw API stdout/stderr is deliberately discarded to prevent unbounded/confidential output; bounded sanitized action receipts and health checks provide diagnostics. This is a temporary user-session host, not an unattended service or Saturday-reboot guarantee. Concurrent start is serialized locally; concrete reset coordination is still part of pending Task3 transport.

Preparation evidence: host-core11/11, combined related48/48, PowerShell parser0 errors. Native draft Check returned NOT_READY/ARTIFACT_NOT_VERIFIED; profile unchanged and no last-action receipt created. No API process/tunnel was started and no candidate was staged. Actual Stage/Start/Stop/SQL/Auth/restart checks require the reviewed Task7 artifact and Task3/4 prerequisites; keep Task5 acceptance pending.

## Task6 manual Testing Hosting publication

Azure mutation workflows are retired tombstones: ACR publish, ACA deploy and cloud SQL reset cannot execute their previous operations. Keep their history, the existing Build workflow path/artifact names, the historical Dockerfile freeze input and Release Approval interfaces. Active Testing deploy is a main-defined manual Hosting-only operation; no desktop/SQL credential, remote shell or automatic publish is added to Actions.

After real local API staging/Start/Check returns READY, Check emits a compact `operator-runtime-attestation` plus its canonical SHA256 (sorted JSON object keys, UTF8). It omits user identity, private paths, secrets and full dependency inventory. It binds main source/run/artifact digest, private staged-manifest digest, trust anchor, exact target/UUID, Node22/Windows strict TLS, Firebase/origins and all27 gate values/fingerprint. This is an operator attestation cross-checked with live HTTP/SQL/CORS probes and GitHub workflows, **not cryptographic proof of a remote process**. Do not relabel candidate-only staging as main evidence.

Dispatch PAWS Testing Deploy from main with current main SHA, its successful push Build run, the sanitized attestation JSON and canonical digest. Only a listed `PAWS_RELEASE_APPROVERS` operator may dispatch an accepted run. The workflow downloads exact Testing/static and API artifacts, verifies freezes/configuration and probes the already staged API before Hosting authentication. The Hosting credential must belong only to the committed Testing Firebase project; no Production credential is used.

`publish-testing-hosting.js` rechecks API source/anchor/gates, SQL200, anonymous401 and exact own/foreign CORS behavior before any Hosting call. It publishes the accepted `.azure-testing/app` through `.firebase-production/app`, verifies every served text/binary asset byte and rechecks API/config. It writes evidence only on success; skipped/failed jobs do not qualify. Release checking binds that file to the official main Build artifact digest and exact Testing workflow run. A later UAT approval cannot substitute a different Testing run. Old Azure-only evidence lacks these fields and must not qualify for the University profile.

No real dispatch, account credential, tunnel, native Stage/Start or publication has occurred. Tasks3/4/5 live prerequisites and Task7 product/governance/CI remain pending. Use the precise cloud CI handoff at Task7 if Actions quota remains unavailable; do not reuse old099 or a PR124 waiver.
