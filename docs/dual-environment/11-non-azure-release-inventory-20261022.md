# PR125 non-Azure release inventory — 2026-10-22

Status: **PARTIAL; NOT MERGED; NOT RELEASED**. This is fresh inventory, not deployment approval or a Testing acceptance receipt.

## Owner direction and scope

The owner states Azure is retired and asks that PR125 meet release standards without mechanically following the Azure infrastructure sections of the uploaded release directive. Do not provision ACA, ACR, Azure SQL or Entra deployment resources. Preserve Firebase Hosting/Auth, the University Production API, SQL authority, environment isolation, immutable freezes, real authenticated acceptance and rollback evidence. Historical Azure receipts remain historical; active Node modules named `swa-*` are still dependencies.

The owner has asked whether the current computer can host Testing. The local computer is technically suitable for a temporary synthetic environment; a topology change is proposed, not implemented.

## Source and CI provenance

- Repository: `Alex1122341/Teaching-assignment-azure`; PR125 remains open.
- Candidate HEAD: `099d6b809f9bf3618e77bb5f5a139043b28d10e4`.
- Main: `ad605dbb9ab92457df972703c723e2b991fa284c`.
- PR merge ref: `e28e7a688efbf58da6455474cc131abf6761204d`; its tree is identical to candidate HEAD (empty `git diff --name-only HEAD origin/pr125-merge`).
- Reviewed frozen product: `424242603af2d6ff313d6db3520e6d04ad5f9024`; separate governance: `5abbb2ce3247c00f98f97212de35fa897bf62bb1`.
- Build run `39826706983`: success. Root: 1093 total / 1041 pass / 0 fail / 52 skip. Server: 860 total / 855 pass / 0 fail / 5 skip. Emulator root invocation: 1093 total / 1074 pass / 0 fail / 19 skip. Additional baseline/deployment tests: 61 pass / 0 fail.
- Calendar Activity SQL Acceptance run `39826706895`: success. This does not replace the updated two-instance local reader acceptance or browser UAT.
- Testing artifact creation explicitly reported `TESTING_NOT_PROVISIONED`; verification/upload were skipped. A green build is not a Testing deployment.
- Official artifact ID: `12445599759`; name: `azure-beta-e28e7a688efbf58da6455474cc131abf6761204d`.
- Downloaded ZIP SHA-256: `dbb920ede30b77f59e98b0c16787bb9ee3cdc503eda69007853b6b764fae33d1`, identical to GitHub artifact digest.
- Extracted artifact: 198 files. Static artifact freeze passes (86 protected files); API artifact freeze passes (111 runtime files, build definition and two repository package inputs). Legacy artifact/workflow names do not imply active Azure hosting.
- Evidence/downloads are under ignored `.superpowers/sdd/pr125-release-20261022/`; do not commit archives, signed download URLs, credentials or installed dependencies.

## Live Production reads

Fresh server and public probes:

- Firebase Hosting returns HTTP200.
- University runtime and SQL health return HTTP200.
- Runtime release: `924cc6761a3b2dfba4f19c2df912436cbd965b43`; old runtime does not report environment identity yet.
- Anonymous `/api/v1/me` returns HTTP401.
- All 27 reported write gates were captured, with no changes made. Do not infer that another gate may be opened.
- Recovery configuration: `P:\PAWS\Runtime\Recovery\recovery-config.json`.
- Its launcher: `P:\PAWS\Runtime\Acceptance\CccSchedule-20261022\Start-Ccc-Live.ps1`.
- Launcher SHA-256 and pinned value both equal `6799B9D1D7DB833A3CCFC7FE3E1FE600CD2DE515EC23D24DA6C89EE379A0801C`; explicit `PAWS_ENVIRONMENT=production`, no Testing variables.
- Recovery `-CheckOnly` returns `RUNTIME_AND_ORIGIN_MATCH`, `siteReady:true`, and reports no process started.
- Existing version directories provide rollback candidates; directory presence alone does not attest their bytes or startup behavior. Retain the currently accepted 924cc67 folder/launcher/config before any cutover.

### Startup issue to resolve before release

`PAWSApi-Temporary-SA` still points at `C:\PAWS\Runtime\Start-PAWSApi-Temporary.ps1`, not the pinned Recovery launcher. The old script has no explicit environment declaration. Task logon type is Interactive and its only trigger is Logon; last result is `3221225786`. This is **not verified unattended reboot recovery**. Do not silently register a new task, request credentials in chat, or claim Saturday recovery works. Reconcile the task with the accepted launcher during the reviewed rollout and verify its identity and restart behavior.

## Firebase Testing

Verified through the signed-in Chrome Firebase console:

- Project: `paws-testing-ucvm-20261022`, display name `PAWS Testing - Synthetic Only`.
- Web app: `PAWS Testing Browser`, app ID `1:165982140501:web:9f6aab4069c83544f57cdc`.
- Spark no-cost plan displayed.
- Authentication shows **Get started**: not initialized, no provider acceptance claimed.
- Hosting shows **Get started**; intended public URL returns HTTP404.
- No Firebase settings, IAM grants, keys, users or Hosting releases were changed in this audit.

## Current computer feasibility

Read-only inventory of `VET-C31293`: Windows10 Enterprise x64, 15.5GiB RAM, 16.7GiB free on C, Node22 available, native `msnodesqlv8` dependency installed. No detected SQL service, no `SqlLocalDB.exe` on PATH, only the legacy SQL Server ODBC driver, and no listeners on 18787/18788/18794 at inspection.

Suitable for temporary synthetic Testing after official LocalDB/current ODBC installation and actual driver/SQL acceptance. Keep adequate free space and bound logs/artifact retention. The computer must remain awake and online; it is not an always-on test service. No software was installed.

## Changes required before release

1. Approve a non-Azure Testing topology and implementation plan. Preferred temporary option: current computer, isolated LocalDB, loopback-only API and a separate HTTPS tunnel; real Testing Firebase tokens.
2. Adapt the Azure-only deploy/reset/preflight/evidence tools to that topology with tests. Do not set dummy Azure variables, report a skipped deploy as success, or weaken SQL host/marker checks.
3. Complete Testing Auth/Hosting, scoped authentication credentials, exact-origin CORS and real operator/persona provisioning without leaking secrets.
4. Run fresh two-instance synthetic acceptance, real authenticated Testing browser UAT, reset-preserves-Production proof and source/artifact attestation.
5. Review any protected changes and perform an explicit separate freeze promotion; then exact candidate checks, merge, exact-main checks and coordinated University API followed by Firebase Hosting-only publication.
6. Verify Production environment identity, unchanged gate fingerprint, faculty scope, API/Hosting coherence and rollback. No Production migrations, data resets/imports or DOE publication/recalculation are included.

This inventory supersedes only current-state infrastructure assumptions in earlier Azure setup documents. It does not rewrite historical evidence or declare a replacement workflow already implemented.
