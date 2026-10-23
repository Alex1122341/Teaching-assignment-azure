# PR125: independent School Testing API and database

Date: 2026-10-22 (America/Edmonton)

Status: **Design and implementation plan approved. Owner subsequently selected School P: API hosting and waived desktop installs/local tests. Implementation/deployment acceptance remains in progress.**

## Current approved placement amendment — 2026-10-22

Owner selected the concrete proposed School placement: ITAPPVETOPSDB01, independent loopback18788, independent HTTPS tunnel and VetMed-Ops-Testing. Runtime private root is exactly `P:\PAWS\Testing\Host`; administrative backups/evidence live in `P:\PAWS\Testing\Backups` and `Evidence`. Host secrets exclude the SQL service account; backup storage alone grants it the filesystem access needed for native backup. No desktop installation/local suite or LocalDB harness is to run. This replaces the earlier VET-C31293 placement and local acceptance requirement; physical SQL server/UUID, TLS, role/privacy, source/freeze and online acceptance remain.

## 1. Intent and latest Owner decisions

Complete existing PAWS Beta PR125 to verified release standards after Azure retirement. The Owner approved current computer `VET-C31293` as the temporary Testing host, then clarified that online Testing must use an **independent Testing database on `ITAPPVETOPSDB01`**. This supersedes the online LocalDB placement in the earlier written draft. LocalDB remains useful only for disposable acceptance.

Use the existing independent Firebase project `paws-testing-ucvm-20261022`. Preserve Production Firebase `tester-teaching`, University API and `ITAPPVETOPSDB01` / `VetMed-Ops`. Testing contains synthetic data only. No Production workbook/PDF/data backup, credentials or business records are copied to Testing.

The proposed new database name is **`VetMed-Ops-Testing`**. This is an explicit design choice, not a claim that the database already exists. Inventory/create it during authorized implementation; an unexpected existing database must not be overwritten.

Success means real authenticated Testing/UAT and exact-source evidence, followed by reviewed freeze promotion, exact-main verification, coherent University API/Firebase Production rollout and rollback readiness. A skipped Testing job does not satisfy release criteria.

## 2. Selected architecture and alternatives

```text
Production browser: tester-teaching.web.app
  → Production Firebase Auth → existing Production ingress
  → University Production API → ITAPPVETOPSDB01 / VetMed-Ops

Testing browser: paws-testing-ucvm-20261022.web.app
  → Testing Firebase Auth → independent Testing HTTPS tunnel
  → ITAPPVETOPSDB01 127.0.0.1:18788 (private P: Testing API)
  → approved private University SQL connection
  → ITAPPVETOPSDB01 / VetMed-Ops-Testing

Local automated SQL acceptance:
  → omitted by Owner instruction; use actual online acceptance instead
```

This selects the Owner's same-server/separate-database arrangement. It provides separate business schemas/data and separate API process/port, not separate machine or SQL engine failure domains. Do not claim physical isolation. Both the earlier all-local database and desktop API placements are superseded by the explicit School-host selection.

No new Azure resource, paid recurring service, public SQL listener, port forwarding, self-hosted GitHub runner or second frontend implementation is introduced. Keep active `swa-*` API dependencies and historical evidence. Retire Azure mutation paths from active deployment while preserving historical build/artifact names where useful for provenance.

## 3. Reuse and component interfaces

| Component | Responsibility | Existing code to extend |
| --- | --- | --- |
| Environment/target guard | Validate explicit Testing profile, parsed SQL server/database pair, connection identity and exact database marker before listening or changing data | `server/src/runtime/environment.js`, SQL connection builder |
| University Testing initializer/reset | Create only the approved new database, or reset the exact marked Testing database; apply guarded synthetic schema/fixtures and retain receipts | `tools/testing-db/reset-testing-db.js`, migration adapters, seed/workflow tooling |
| Testing account provisioning | Testing Firebase users linked only to Testing SQL profiles; existing persona rules | `provision-test-accounts.js`, shared SQL driver builder |
| Desktop stage/start/check/stop | Source/artifact verification, separate loopback process, private configuration, tunnel ownership/drift and restart without reset | University Node entrypoint and existing recovery patterns |
| Testing deploy/evidence | Verify staged exact-main API, publish downloaded Testing frontend, check served bytes and produce source-bound evidence | `paws-testing-deploy.yml`, Hosting-only config, environment/freeze/release tools |

Keep business APIs, DOE calculations, privacy, stale-request checks and workflow semantics shared with Production. No special browser authority, arbitrary SQL execution endpoint or automatic fallback is added.

## 4. Server/database boundary

The current PR rejects every Testing connection to ITAPPVETOPSDB01 and the reset tool insists on database `VetMed-Ops`. Both must be deliberately revised and tested; configuration edits alone cannot make this design work safely.

Introduce an explicit `university-testing` deployment profile whose reviewed constants/config name only the canonical University server and `VetMed-Ops-Testing`. Parse exactly one server and one database, reject conflicting aliases/options, and compare the complete pair. Do not simply remove the Production-server denylist or allow arbitrary on-premises hosts. Approved FQDN/certificate names must come from actual existing University configuration; never guess a hostname or relax TLS for an alias.

Before the first business query, verify the actual database name, expected physical server identity and single exact UUID `paws_env.EnvironmentIdentity = ('testing', configured UUID)`. Repeat the target assertion on each newly created SQL connection and immediately before every administrative reset/migration batch. No request parameter or persona header can choose a database. Missing/multiple markers, wrong UUID, wrong server/database, or SQL being unavailable keeps Testing not-ready and blocks listening/changes.

The online Testing profile must refuse `VetMed-Ops`, `master`, `model`, `msdb`, `tempdb`, arbitrary database names, loopback aliases and LocalDB overrides. The dedicated LocalDB acceptance profile remains separate. Production still refuses a Testing-marked DB and gains an explicit expected Production database-name check so it cannot start against a newly empty Testing database.

Runtime SQL uses Windows integrated authentication and the existing msnodesqlv8/ODBC18 builder, encryption on and certificate validation on. No Testing self-signed exception is permitted for the University server. Do not change server authentication mode, global firewall, certificate policy, trust settings or Production login configuration to make connectivity work.

## 5. Identity, permissions and shared-server operations

Try the existing signed-in authorized Windows identity from VET-C31293 over the approved University/VPN network. Measure real strict-TLS SQL connectivity and its effective permissions before deployment. Reuse an existing suitable Windows principal; a new University Windows service account is not a default prerequisite, respecting the Owner's earlier waiver.

Initialization/reset is a separate administrator operation on the University server using existing authorized administration access. The desktop runtime never receives the administrator connection/profile. Grant only the accepted Testing database read/execute/write roles required by its explicit gate matrix. No new sysadmin/dbcreator/server-admin grant, Production user mapping, Production role modification or cross-database grant is included. Inspect actual direct/inherited/group/public permissions, ownership and server authority; do not label an already-broad identity least-privileged. If the current identity cannot satisfy connectivity/access requirements, report the exact required grant or operator step and continue independent work; do not borrow a Production password or switch silently to the Production API.

The Testing database has TRUSTWORTHY OFF and cross-database ownership chaining OFF; no guest access enabling cross-database reads, external access, Production synonyms/three-part references, or linked-server route. Validate effective cross-database denial when using the selected runtime identity. Existing inherited Production access is not silently removed; an unsuitable runtime identity is an explicit unresolved acceptance item rather than a fabricated isolation pass.

Record current server capacity/storage first. Use bounded Testing data/log file growth (initial limits1GiB data/512MiB log), bounded query/reset timeouts and a single serialized reset to limit shared-server impact. Backups/logs use a dedicated private Testing directory on approved existing storage. Do not alter server-wide resource settings, kill Production sessions, restart SQL Server or delete unknown files.

## 6. Schema initialization and synthetic reset

Do not restore or copy Production to create Testing. Initialize the new empty `VetMed-Ops-Testing` from existing committed migration and synthetic seed tools. If that name exists, read its identity/ownership metadata and refuse initialization unless it is the explicitly owned matching Testing database; never DROP/rename/take over an unknown database.

Many existing migration/seed guards compare `DB_NAME()` with `VetMed-Ops`. Leave authoritative Production migration files and their original guard behavior unchanged. Extend the existing **Testing-only in-memory adapter** to rewrite only enumerated, recognized database-name guard expressions for the exact approved Testing target. Match expected source forms/counts and record source/transformed hashes; an unknown context or migration change fails for review. Reject unexpected `USE`, cross-database DDL/references or executable unadapted Production target guards rather than broad string replacement. Assert actual target/marker before each batch, including the seed/readers/workflow phases.

Explicit reset requires authenticated listed operator, target server/database/UUID confirmation and `RESET-TESTING`. Stop or drain only the verified Testing API, take a private pre-reset backup of the exact marked Testing DB, then use existing guarded reset/migrations/seed/fixtures and verify the marker, counts and workflow coverage before restarting. The reset identity/receipt lives outside the DB being reset. Reset does not automatically rotate named operator passwords.

On partial failure remain not-ready, retain backups/receipts and restore only that matching Testing DB if required. No operation may select `VetMed-Ops` as a fallback. Test and prove the reset rejects wrong targets **before destructive SQL**, not just after a failed connection. There is no HTTP reset or administrator shell endpoint.

## 7. Desktop runtime, tunnel and Firebase

Private runtime root: `P:\PAWS\Testing\Host`, outside Git/OneDrive/Hosting, with versioned API folders, configuration, secrets, bounded logs and sanitized evidence. Reject unsafe/reparse-point targets, broad private ACLs and unknown listeners. Reuse installed Node22/ODBC18, locked dependencies, exact configured Windows identity, loopback `127.0.0.1:18788`, explicit Testing Firebase project/gates and exact CORS origin. Recheck port ownership/version rather than terminating a foreign process.

Stage the exact verified API artifact, pin its manifest/launcher hash, and start the real shipped entrypoint without synthetic token verification or SQL adapters. Optional current-user logon startup may use that same supervisor; no new service identity or password-in-script. Start/retry never resets SQL. Verify marker, permissions, SQL health and expected environment before readiness. Temporary network loss is a not-ready failure, not fallback behavior.

Use a separate Cloudflare process with loopback ingress. Discover its actual HTTPS hostname from output and commit the approved Testing origin/rendering. A changed quick-tunnel hostname invalidates readiness and requires a reviewed configuration/artifact update; never silently repoint the browser. The desktop must stay awake and online. No promise of always-on availability or fixed tunnel hostname is made, and no global power-setting change is included.

Complete Auth Email/Password, authorized domains and Hosting for the existing Testing Firebase project/WebApp. Public WebApp configuration may be committed; runtime/deployment/provisioning secrets are private and Testing-scoped. Prefer existing authenticated tooling and minimum necessary rights; do not unnecessarily create long-lived keys. Actual credential entry/rotation and security-sensitive UI grants follow the required human handoff/confirmation. Missing human steps remain explicit pending items.

Keep privileged synthetic personas switch-only without shared-password login; provision lower-role synthetic sign-ins and the named operator separately in Testing. Account provisioning must use the same guarded University Testing SQL profile, replacing the current hardcoded tedious connection. Production tokens fail against Testing and Testing tokens fail against Production; CORS is an additional boundary, not authentication.

## 8. Acceptance without touching real Production data

LocalDB is disposable acceptance infrastructure only. Official SQL2025 LocalDB/ODBC18 installation on VET-C31293 may require an operator/elevation step; continue other work if that step is blocked. Microsoft references: [LocalDB ownership/installation](https://learn.microsoft.com/en-us/sql/database-engine/configure-windows/sql-server-express-localdb), [SQL2025 Windows prerequisites](https://learn.microsoft.com/en-us/sql/sql-server/install/hardware-and-software-requirements-for-installing-sql-server-2025).

Run the existing fresh two-instance harness plus a new **same-instance/two-database** synthetic acceptance scenario representing the selected server layout. Both must refuse any pre-existing unknown database. Verify wrong database/marker/alias/principal, seed/migration adaptation, reset/rollback, current Availability/CCC readers, persona expiry/scope, persisted workflows and unchanged synthetic Production stand-in fingerprints. Do not weaken the real server allowlist to inject a test host; tests use explicitly injected test dependencies/private harness configuration.

Then test the actual deployed University Testing database, real Windows/ODBC connection and real Firebase tokens. Perform browser A–H/P flows: administrator edits/persistence/imports, Faculty own/cross-faculty privacy, HICC/VISC/ADC/LAB scope, test identity/end/expiry, search/read/export, stale changes and reset. No incidental real-person email/notification or Production write is an acceptance action. Only bounded authorized read-only Production health/gate/schema/business fingerprints establish that real Production stayed unchanged; synthetic stand-in results are labeled separately.

Run full Node22 root/server suites, Firestore/Auth emulator tests, SQL acceptance, config/isolation tests, repository/static/API artifact freezes and restart/rollback checks. Explain each skip/timeout and reproduce targeted failures; no missing test is reported as passed. Desktop recovery checks and a real unattended University reboot are distinct evidence.

## 9. Deployment provenance and bootstrap

**Before merge:** trusted local tooling may stage a successful exact-candidate PR artifact after proving repository/PR HEAD/run/artifact digest/source tree identity. A PR synthetic merge SHA is explicitly distinguished from HEAD. Perform actual candidate Testing UAT and record local receipts as `candidate-only`; these cannot satisfy main-based release evidence.

**After merge:** obtain the successful exact-main push build, one Production artifact and one Testing rendering from the same source. The local operator stages the exact-main API from the verified artifact and records source run/artifact digest, commit/freeze anchor, protected-file manifest digest, host profile, target identity, UTC time and actual checks. This is a trusted operator attestation, not a signature generated by GitHub or proof derived only from a self-declared health SHA.

Adapt `PAWS Testing Deploy` to main-only manual dispatch **after API staging**. Preserve the `deploy_testing` evidence interface. It verifies successful main-build provenance, exact SHA/trust anchor/environment, gate fingerprint, SQL health, anonymous401 and own/foreign-origin CORS, then publishes only the downloaded Testing Hosting artifact and checks served static/config hashes. It does not run remote shell commands or install a runner on the desktop/SQL server. Missing/stopped/wrong API yields failure, not a skipped-success receipt.

Combine successful main-defined workflow evidence, local runtime attestation, guarded SQL/reset receipts and actual browser UAT; re-run critical flows on exact-main. Preserve existing owner-listed release approval verification. Retire active Azure login/ACR/ACA and Azure SQL firewall/reset mutations; the reset becomes an explicit authorized server-admin operation. Do not use dummy Azure variables or forge a green workflow to satisfy old validation. Preserve historical workflow/artifact naming and frozen container build input unless a separately reviewed removal is necessary.

## 10. Production release and rollback

Preserve accepted product/governance review and perform a separate reviewed freeze promotion for new protected bytes. Exact-main checks and real Testing acceptance precede Production release. Stage the exact-main University API in a new folder, verify bytes/config/strict SQL TLS and all27existing gates, capture current accepted release/launcher/Hosting rollback identity and bounded data/schema fingerprints, and check the new API on a controlled loopback port before cutover.

Reconcile the old Interactive/Logon scheduled task with the accepted pinned Production launcher. Verify actual identity, trigger, entrypoint and Recovery CheckOnly. Do not claim unattended Saturday recovery before login is verified; any required human credential/reboot step is explicit. No SQL Server restart or new dedicated University Windows account is a default release action.

Cut over the verified University API, require `environment:production`, expected DB, SQL health, anonymous401, unchanged gates and real Faculty scope, then publish exact-main Firebase Hosting **only** to `tester-teaching`. Verify served hashes/API coherence. Roll back matched attested API/static versions if acceptance fails; retained directory names alone are not rollback proof.

No Production schema migration, source import, reset, DOE publication/recalculation, gate opening, role change, cross-database grant or Firestore rules/business-data deployment is included. Testing database creation/migrations affect only the separately approved Testing database.

## 11. Review and next stage

Direction settled: temporary API on VET-C31293, online independent Testing DB on ITAPPVETOPSDB01, separate Firebase identity, synthetic data. Proposed database name: VetMed-Ops-Testing. Concrete online connection/permission/capacity checks remain measured implementation prerequisites; an unsuccessful metadata probe is not evidence of database absence or access denial.

Self-review completed: target-pair parsing/markers, per-connection/admin-batch checks, same-instance isolation, immutable Production migrations versus bounded Testing adapters, runtime/admin identity separation, local versus live acceptance, candidate/main bootstrap, unsigned receipt limits, tunnel drift and rollback boundaries. The earlier online-LocalDB spec is explicitly superseded.

Owner approved this written design and requested the concrete implementation plan. The plan is `../plans/2026-10-22-pr125-university-testing-implementation.md`; review it before installing/provisioning or implementing profile/workflow changes, retaining sequential execution and final independent review. Nothing here reports a database created, software installed, Testing live, PR merged or Production released.
