# PR125: temporary Testing on VET-C31293

Date: 2026-10-22 (America/Edmonton)

Status: **SUPERSEDED for online Testing database placement.** The Owner subsequently selected an independent Testing database on ITAPPVETOPSDB01. Review `2026-10-22-pr125-university-testing-design.md` instead. The LocalDB topology below is a retained historical draft, not implementation authorization.

## 1. Intent and approved direction

Complete the existing PAWS Beta PR125 to verified release standards after Azure retirement. The Owner explicitly approved using the current computer `VET-C31293` for an isolated LocalDB, loopback-only Node API, independent HTTPS tunnel and the existing separate Firebase Testing project. This approval settles the host/direction; this document defines the implementation boundaries for review.

Production remains Firebase `tester-teaching` → its existing Cloudflare ingress → University API on `ITAPPVETOPSDB01` → University SQL `VetMed-Ops`. Testing uses synthetic data only. Real PAWS records, PDFs, passwords, tokens, SQL identities and business-data backups are never copied to Testing.

Success means functioning, independently authenticated Testing with real SQL/browser acceptance; exact-source evidence; reviewed immutable freeze promotion for protected changes; then an accepted exact-main University API and Firebase Hosting release. A green build with Testing skipped is insufficient.

## 2. Selected approach and alternatives

| Approach | Assessment |
| --- | --- |
| Current computer, private LocalDB, existing Node runtime, separate tunnel and Firebase project | **Selected by Owner.** No new recurring cloud resource; reuses current Windows SQL/runtime and synthetic tools. Available while this computer is awake and online. |
| Separate always-on University test machine | Future option when a machine is available. More operational continuity, but no such machine has been supplied. |
| Additional instance on the Production University host | Not selected. Avoids placing disposable reset tooling and test lifecycle on that server. |

No Azure resource provisioning or self-hosted GitHub runner is required. Existing artifact/workflow names containing Azure may remain for provenance compatibility; active Azure mutation paths are retired during implementation. Historical receipts and active `swa-*` Node modules remain intact.

## 3. Topology and components

```text
Browser
  ├─ Production: tester-teaching.web.app
  │    → Production Firebase Auth → existing Production HTTPS ingress
  │    → University Node API → ITAPPVETOPSDB01 / VetMed-Ops
  └─ Testing: paws-testing-ucvm-20261022.web.app
       → Testing Firebase Auth → separate Testing HTTPS ingress
       → VET-C31293 127.0.0.1:18788 → private LocalDB / VetMed-Ops
```

| Component | Responsibility / interface | Existing implementation to reuse |
| --- | --- | --- |
| Local host profile | Declares expected machine, Windows user, exact LocalDB instance, environment UUID, Firebase project, port, CORS origin and complete gate map; validates before any action | `environment.js`, Windows connection builder, `verify-testing-api-env.js` |
| Local stage/start supervisor | Verifies source and artifact, stages a versioned API folder, pins launcher/hash, starts only a verified Testing listener; supports check/start/stop without reset | University API entrypoint and existing recovery patterns |
| Reset/account administration | Explicitly initialize a new empty DB or reset the exact marked Testing DB; provision distinct Testing users | `reset-testing-db.js`, synthetic seed/workflows, `provision-test-accounts.js` |
| Testing frontend deployment | Verifies the already-staged API, publishes exact Testing static artifact, checks served bytes and writes source-bound evidence | `paws-testing-deploy.yml`, Firebase Hosting-only config, environment/freeze tools |
| Release verification | Combines CI provenance, local staging attestation, public probes and actual UAT; refuses missing/stale/failed evidence | `verify-release-evidence.js`, release approval workflow |

No second frontend implementation or API business implementation is introduced. Changes are limited to provider-specific tooling, connection/provisioning integration, operational safety and the required environment configuration.

## 4. Local prerequisites, paths and resources

Read-only inventory: Windows10 Enterprise x64, 15.5GiB RAM, 16.7GiB free disk, Node22 present, native `msnodesqlv8` dependency present, no detected SQL service or LocalDB CLI, only the legacy SQL ODBC driver. Port18788 was free at inventory; validate again at start.

Install official Microsoft SQL Server2025 Express LocalDB and Microsoft ODBC Driver18 x64, subject to supported OS/build, native-driver loading, signature and installer checks. Preserve installer version/hash/result in private evidence. If elevation, license acceptance or a managed-device policy requires human action, stop that install step and continue independent code/tests; do not bypass the prompt or policy.

Use a single private root under `%LOCALAPPDATA%\PAWS\Testing`, with `versions`, `config`, `secrets`, `logs`, `evidence` and `data`. It is outside Git, Hosting staging and OneDrive; reject reparse-point/unsafe targets. Restrict private files to the current authorized user and required OS administrators. Use a new named instance `PAWSTesting20261022`; refuse to take over an existing instance/database without validating its explicit ownership record and marker. The first initialization creates a fresh `VetMed-Ops`; no DROP of an unknown database.

Preflight requires at least8GiB free space before setup/reset and records actual post-setup use. Bound rotating logs to100MiB total and acceptance scratch/artifact retention to2GiB; never delete unknown directories to meet the threshold. Retain the active and previous attested releases and reset receipts; report rather than automatically purge necessary evidence. Do not change system-wide power settings. Clearly report that Testing is offline when the computer sleeps, restarts or disconnects.

Microsoft references: [LocalDB installation and ownership](https://learn.microsoft.com/en-us/sql/database-engine/configure-windows/sql-server-express-localdb), [SQL Server2025 Windows requirements](https://learn.microsoft.com/en-us/sql/sql-server/install/hardware-and-software-requirements-for-installing-sql-server-2025). These document platform feasibility; actual installed engine/ODBC/runtime acceptance is still required.

## 5. SQL and environment isolation

- Reuse the existing `testing` environment and exact UUID marker `paws_env.EnvironmentIdentity`. Testing refuses Production SQL hosts, aliases/IPs, Production Firebase, missing/ambiguous hosts, missing/mismatched markers and conflicting configuration. Production still refuses a Testing-marked database.
- Active local profile requires the configured host `(localdb)`, exact named instance, DB name `VetMed-Ops`, Windows integrated authentication and `msnodesqlv8`. Do not broaden the runtime host allowlist to arbitrary on-premises servers. The local wrapper additionally binds operations to the approved computer/user/instance; credentials for University SQL are not loaded.
- Use the actual shipped connection builder and ODBC18 for deployed Testing. The private two-instance harness may retain its explicit local adapter, but it is not proof that the deployed connection works. Run both.
- Keep encryption enabled. If LocalDB needs the existing self-signed test option, permit it only in an explicit Testing/LocalDB profile, record the exception, and reject it for Production, remote hosts and managed-identity configurations. Never globally disable certificate validation or alter the University TLS configuration.
- Select the current user-owned LocalDB identity for this temporary environment. Record that the local owner can administer this synthetic instance; do not claim runtime least privilege. The existing Owner waiver of a new University service account is unchanged.
- Every Testing write gate is explicitly true/false according to the existing reviewed matrix. No implicit gate defaults, unknown variables or automatic Production gate changes.
- No listener on `0.0.0.0`, no SQL TCP exposure, no inbound RDP/SMB/firewall opening. Only the authenticated HTTP API is reachable through the separate tunnel.

## 6. Firebase identity and confidential files

Use only project `paws-testing-ucvm-20261022` and its existing WebApp. Enable Email/Password and default Hosting, verify authorized Testing domains and exact-origin CORS, then commit the public WebApp config and actual Testing API origin through reviewed source configuration. Production trusts only its existing project. CORS alone is not authorization: replaying a Production token against Testing and the reverse must fail server-side.

Separate Hosting deploy credentials, runtime Auth verification and account-provisioning authority where practical. Use existing authenticated tooling; create only required Testing-scoped permissions if credentials are missing. Private keys/passwords never appear in Git, process arguments, public evidence, Hosting artifacts or chat. Do not create long-lived keys unnecessarily. Credential entry/rotation and security-sensitive UI grants follow required human handoff/confirmation at the actual step; record those steps as pending when blocked.

Keep privileged synthetic developer/owner/admin personas switch-only, without a shared-password sign-in. Provision lower-role synthetic accounts and an explicitly named operator in the Testing project, preserving existing persona/scope rules. Account tooling must use the same guarded local SQL connection as reset/runtime rather than its current hardcoded tedious path. No role grants in Production and no use of a real Faculty password in Testing.

## 7. Startup, tunnel and failure behavior

Stage each release into its own directory from the verified API artifact. Pin the protected runtime/package manifest and launcher hash. Require the correct Windows user, machine, LocalDB marker, explicit gates and Firebase project before starting the API. Record PID, executable path, configured port and attested version. If a listener already occupies the port, verify ownership/version before treating it as healthy; never terminate an unknown listener.

Initially reuse the accepted temporary Cloudflare model with a separate process and log for Testing. The HTTPS origin is discovered from actual tunnel output, never guessed. It becomes part of committed Testing configuration and the rendered artifact. A changed quick-tunnel hostname invalidates readiness: report configuration drift, then perform a reviewed configuration/artifact update. Do not silently change browser endpoints, fall back to Production, or claim a fixed hostname was provided. A future named tunnel is outside this milestone.

Default operation is an explicit start/check/stop under the signed-in user. An optional current-user logon task may start the same verified supervisor; it is not an unattended service and no password is collected for it. Startup/retry never resets SQL. Bound retries and verify SQL/environment before listening. On wake/reconnect, check API health, marker, tunnel origin and served config. On shutdown stop only recorded/verified owned processes; preserve data and evidence.

Production recovery is separate. Before Production release reconcile the existing stale Interactive/Logon task with the accepted pinned University launcher. Confirm task identity/trigger/actual entrypoint and recovery CheckOnly. Do not represent a logon task as recovery before login; unattended boot/credential entry requiring a human remains an explicit outstanding operational step rather than a fabricated pass.

## 8. Reset and restoration

An explicit local admin command replaces the Azure SQL firewall/reset workflow for this profile. It checks the local Windows identity and authenticated named reset operator against `PAWS_TESTING_RESET_OPERATORS`, checks machine/instance/DB/UUID, requires `RESET-TESTING`, and uses the existing marker/empty-database guard. No unauthenticated HTTP reset endpoint or publicly reachable administrator shell is introduced.

Stop the verified Testing API before reset, preserve a private pre-reset SQL backup of the marked synthetic DB and an external receipt, run the existing migrations/seed/fixtures, verify counts and fixture coverage, then restart/recheck the same environment. On failure remain not-ready and preserve diagnostics; restore only the matching marked backup to the same Testing instance. Never choose a University connection as a fallback. Reset does not rotate existing named operator credentials; initial persona setup/credential changes are explicit operations. Reset itself is recorded outside the database it resets.

Fresh two-instance acceptance uses two additional unused LocalDB instance names, separate from persistent Testing. Its “Production” database contains synthetic stand-in data, never University data. This harness must refuse all pre-existing databases; cleanup is limited to its ownership manifest. A before/after fingerprint proves the stand-in is unchanged by Testing actions/reset. Authorized bounded read-only Production health/gate/fingerprint checks additionally establish that live Production was unchanged; the stand-in result alone is never labeled live-Production proof.

## 9. CI, deployment evidence and bootstrap

### Candidate before merge

Run full exact-candidate CI, repository/artifact freezes and SQL/emulator checks. A trusted local staging command may consume the PR artifact only after proving repository, current PR HEAD, run conclusion, artifact digest and exact artifact/source tree relationship. Explicitly distinguish PR merge-ref SHA from HEAD; no unverified relabeling or rebuilding an API artifact from unrelated source. Produce a private local staging receipt and perform real candidate Testing UAT. Mark these receipts `candidate-only`; they do not qualify as main-based release evidence.

### Main after merge

1. Recheck main and successful push-build provenance. Build one Production artifact and one Testing rendering from the same commit/allowlist. Validate both and download exact artifacts with digest checks.
2. An authorized local command stages/starts the exact-main API on VET-C31293 and produces an attestation bound to source run/artifact digest, SHA, freeze anchor, protected-file manifest digest, host profile, UTC time and local health/gate checks. Private paths/credentials and account emails are excluded from public evidence. This receipt is an operator attestation, not a cryptographic proof supplied by GitHub.
3. Adapt `PAWS Testing Deploy` to a manual main-only run after local API staging. Keep its `deploy_testing` evidence interface. It verifies the exact successful main build, API environment/SHA/trust anchor, explicit gate fingerprint, SQL health, anonymous401 and allowed/foreign CORS. It publishes only the downloaded Testing Hosting artifact and verifies served config/static hashes. It does not remotely install or execute arbitrary commands on the desktop.
4. Combine that successful main-defined workflow artifact with the local staging attestation and actual browser UAT. Public health metadata alone does not attest runtime bytes or prove UAT. Missing, failed, skipped, stale, mismatched or branch-authored release evidence blocks publication. Do not set dummy Azure variables to satisfy old validators.
5. Repeat critical authenticated flows after exact-main staging; record passed UAT through the existing owner-listed release approval mechanism. Preserve the existing source-bound approval checks rather than introduce another review service.

The active Testing deploy no longer calls Azure login/ACR/ACA. The active reset is a guarded local operator operation, not an Azure-hosted workflow pretending to reach LocalDB. Retire Azure mutation workflows from the active path; preserve the existing build workflow path/artifact names and protected container build input as historical compatibility unless a separate reviewed removal is necessary. A stopped/offline host yields a concrete failure; it is never a successful deployment or automatic source rollback.

## 10. Required acceptance

| Layer | Required evidence |
| --- | --- |
| Unit/integration | Full root and server suites on Node22; explain actual skips/timeouts, targeted regression first for changed behavior |
| Security/emulator | Existing Firestore/Auth suites, token project mismatch, no business-data fallback, role/persona/header abuse and revocation |
| Real SQL | Fresh two-instance acceptance including current Availability/CCC readers, writes, persona scope/expiry, reset fixtures, stand-in fingerprints and performance smoke |
| Deployed local connection | Real shipped msnodesqlv8/ODBC18 configuration, exact instance/marker/user, actual Firebase token validation, blocked wrong targets |
| Browser A–H/P | Real Testing login, banner/navigation, admin workflows, Faculty own/cross-faculty scope, HICC/VISC/ADC/LAB, persisted changes, stale-request handling, identity switching/end/expiry, reset and usable reader/search/export flows |
| Operations | Source/artifact attestation, restart without reset, unknown-listener refusal, tunnel-origin drift detection, rollback and exact-main reacceptance |
| Production release | Exact-main CI, accepted Testing/UAT, separate product/governance review, staged University API then Hosting-only release, same27gate fingerprint, preserved business/schema state, real Faculty scope and verified rollback |

Use synthetic files for imports/PDF tests and preserve privacy in screenshots. No notification/email is sent as an incidental test. A pending human credential, genuine reboot or permission step is listed explicitly; it is not a pass. Testing code readiness, Testing live readiness and Production readiness are distinct states.

## 11. Production rollout and rollback

After acceptance, stage exact-main University API into a new release folder; verify manifest, existing Production Auth/SQL configuration, pinned launcher, all27gates and health on a controlled loopback port. Capture current process/release/origin/static version, protected-file hashes and bounded data/schema fingerprints. Do not overwrite the running folder.

Perform the existing controlled API cutover, verify `environment:production`, anonymous401, SQL health and real authorized Faculty scope, then publish only Hosting to `tester-teaching` using the accepted exact-main artifact. Require convergence of served hashes and API version/gates; stop and roll back coherent API/static versions if acceptance fails. No Production migration, source import, reset, DOE publish/recalculation, gate opening or Firestore business/rules deployment is included.

Retain the previously accepted University launcher/release/config and Hosting rollback identity with local attestation, not merely directory names. Restore matched components under existing authorization and recheck health/scope/gates. Do not restore a Testing backup to Production or remove an environment marker to force startup.

## 12. Review checklist and next stage

- Direction approved: current computer, synthetic LocalDB, separate API/tunnel/Firebase.
- Written design: awaiting Owner review.
- Spec self-review completed: checked component interfaces, pre-merge/main bootstrap, actual ODBC versus test-only adapters, reset/credential separation, unsigned operator-attestation limits, interrupted-start behavior, tunnel drift, rollback ownership and explicit human steps. Installed-driver compatibility remains a measured implementation prerequisite.
- Explicit limitations: desktop availability, quick-tunnel hostname changes, current-user LocalDB administration, pending real installation/auth/UAT and unattended Production restart acceptance.
- Existing reviewed freeze anchors and historical receipts are preserved; any new protected bytes require a separately reviewed promotion.
- After written-design approval: invoke writing-plans, create a concrete sequential implementation plan and request plan/execution-method confirmation before installing software or implementing provider changes.
- Nothing in this design reports the system installed, Testing live, PR merged or Production released.
