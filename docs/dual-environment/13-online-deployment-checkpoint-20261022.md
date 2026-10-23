# PR125 online deployment checkpoint — 2026-10-22

## Latest Owner direction

Do not install anything on VET-C31293 and do not run local tests. Continue deployment preparation and online acceptance. This supersedes the plan's LocalDB installation and disposable local SQL acceptance prerequisite; those checks are omitted, not passed. Historical test receipts still apply only to their recorded source. No SQL-target, TLS, privacy, immutable-freeze or source-provenance check is waived by this direction.

The approved API host was VET-C31293. Moving its independent API to the School server is proposed because the desktop lacks ODBC18 while the server already has it. Owner selection is pending. No host allowlist, private root, API process or tunnel has been changed to assume that selection.

## Current remote observations

Read through Desktop Commander on ITAPPVETOPSDB01, using the existing authorized Windows session. These are metadata/health observations, not evidence of an installed Testing release.

| Item | Observation |
| --- | --- |
| Node | v22.23.2, executable signature Valid |
| SQL driver | ODBC Driver 18 and 17 installed |
| SQL service | MSSQLSERVER running |
| API listeners | Production 127.0.0.1:18787; 18788 not listening |
| Storage | C: 3.14GiB; P: 116.51GiB; S: 59.76GiB; L: 49.76GiB |
| Strict TLS | Full endpoint ITAPPVETOPSDB01.uc.ucalgary.ca:1433 succeeds; short hostname fails certificate name validation |
| Physical SQL server | ITAPPVETOPSDB01 |
| Testing database | VetMed-Ops-Testing absent under a login with VIEW ANY DATABASE |
| Existing operator | UC\sa-xinyu.zhu1; not sysadmin |
| Server permission inventory | CONNECT SQL, VIEW ANY DATABASE only |
| Explicit creation checks | CREATE ANY DATABASE=0, ALTER ANY DATABASE=0, CREATE DATABASE in master=0 |
| SQL default storage | S:\MSSQLSERVER\Data\ and L:\MSSQLSERVER\Logs\ |
| Production runtime health | 200, release924cc6761a3b2dfba4f19c2df912436cbd965b43 |
| Production SQL health | 200 |
| Anonymous /api/v1/me | 401 |
| Production gate map | 27 entries read; no mutation |

Use the full endpoint for the new Testing connection with Encrypt=true and TrustServerCertificate=false. No certificate override or public listener is required. The existing operator also has Production access; this observation must not be described as a least-privilege runtime acceptance. A new dedicated School service account is not a prerequisite under Owner's standing development instruction, but the existing identity's actual authority must remain visible in the release review.

## Concrete DBA handoff

`deploy/testing/Request-UniversityTestingDatabase.sql` is a prepared, **unexecuted and unaccepted** administrator script. The current session cannot execute its database-creation step. It deliberately has an invalid UUID placeholder, so execution without the private reviewed UUID fails before DDL.

An authorized SQL administrator must review it on the exact School instance. It creates only a previously absent VetMed-Ops-Testing, caps data/log files at1024/512MiB, disables TRUSTWORTHY/DB_CHAINING and guest CONNECT, creates the Testing UUID marker and maps the existing development operator as database-local setup administrator. It grants no server-wide permission and changes no Production database. This setup mapping does not qualify the account as an accepted API runtime identity.

The script refuses existing databases or existing generated file paths. It does not seed real or synthetic business data, reset anything, start an API, or publish Hosting. Any failure after CREATE DATABASE leaves a partial target for explicit review; rerunning cannot adopt or overwrite it. Preserve its success receipt and private UUID before subsequent guarded synthetic migrations. The native admin transport can inspect an existing marked target; its create-only initializer must not be used to adopt this separately created database.

## Code preparation and validation limits

The Task3 native transport now covers fixed-master authorization, exact-target metadata, session locks, same-session reset refusal, owned-empty initialization, private checksummed backup verification, immutable external receipts, and explicit backup-bound restore without terminating foreign sessions. Direct University reset requires the stopped-host/backup orchestrator. Private administrative storage rejects Git ancestors, links and broad ACLs at its root and Backups/Evidence directories.

Before the latest no-local-testing instruction, the focused Task3 group passed58/58. That result predates the server-permission SQL syntax correction and expanded directory checks made in this checkpoint. A regression assertion was added but not run. The corrected server permission syntax was confirmed by actual read-only master metadata: HAS_PERMS_BY_NAME(NULL,NULL,...) returns1/0, while NULL,'SERVER',... returnsNULL. These observations do not validate backup/reset/restore or the unexecuted DBA script.

Firebase's existing authenticated CLI successfully read the Testing Web SDK configuration for paws-testing-ucvm-20261022 and app1:165982140501:web:9f6aab4069c83544f57cdc. This does not prove Auth is enabled, accounts exist, a server credential is configured, or Hosting is deployed. The active Testing config remains incomplete; do not invent a tunnel origin to complete it.

## Release state and next steps

1. Obtain the pending API-host selection; amend the host policy and operational specification if the School server is selected. Use the existing P: volume, independent18788/Testing tunnel and private release paths; preserve the Production process.
2. Have a School SQL administrator execute the reviewed Testing-only initialization with the private UUID. Do not request a password or promote the current account to a server role.
3. Continue guarded synthetic migrations, Testing Firebase/provider/accounts, independent API/tunnel deployment and real authenticated online acceptance. Failures remain visible; no omitted local check is relabeled a pass.
4. Complete independent product review and separate immutable governance promotion, then request source-specific cloud verification as directed by Owner. Official Actions metadata/artifacts must not be invented if quota prevents them.
5. Merge/release only the resulting accepted source and update the progress workbook after actual publication.

At this checkpoint: no local installation/testing after Owner's instruction; no SQL DDL/data/grant, Auth mutation, API restart, new tunnel, Hosting release, merge or freeze promotion. Production remains at its existing release.
