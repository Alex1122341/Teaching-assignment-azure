# Agent Update — Saturday runtime and ingress recovery

**Date:** 2026-10-24  
**Repository:** Alex1122341/Teaching-assignment-azure  
**Task status:** BACKEND RESTORED / FRONTEND RELEASE PREPARATION

## Goal and starting breakpoint

User restored school RDC and requested continuation of PR140 release acceptance. Starting HEAD884a523; preceding CI40109471683 passed with verified artifact12565898211. Main remains8bb40c6. Those receipts are historical after the new ingress change.

## Actual diagnosis and recovery

- Authoritative server ITAPPVETOPSDB01 is connected. Existing recovery CheckOnly verified source/launcher hashes and reported api_absent. Original normal recovery could not write its admin-owned recovery.jsonl; original launcher also targets an admin-owned PID file unavailable to the same approved non-elevated identity.
- Existing DPAPI credential is readable by the expected identity and belongs to tester-teaching; no credential content logged or saved. No account/ACL change.
- Preserve old evidence. Created owned `P:\PAWS\Runtime\Recovery\Restart-20261024-01`. Copied the verified launcher, changing exactly acceptanceRoot/PID-output directory; all environment/gate/API/SQL/CORS values unchanged. Candidate configuration changes only ApiLauncherPath, its SHA256 and LogDirectory. CheckOnly passes file validation; existing recovery starts API/tunnel successfully.
- After local/public runtime acceptance, atomically persisted those three operational path properties to the original recovery-config.json with before/atomic backups. PublishedOrigin remains the old served origin until frontend publication; CheckOnly truthfully reports FRONTEND_ORIGIN_UPDATE_REQUIRED. No invented siteReady result.
- API health: main8bb40c60370bcce3d0135efd4327d42fba657903, trust58daab3a2401af69c2298cc1f078d78aad069ea9; all27 gates match configuration. SQL health statusok/servicepaws-beta-sql-runtime. Public HTTPS runtime/gates match through gibson-strand-telecharger-governor.trycloudflare.com. Existing Hosting origin OPTIONS204 with exact ACAO; untrusted Origin403 with no ACAO.

## Code and governance

Product486ea030c5eaef4ddb7508a4d50799687487057f changes only paws-api-origin.js relative to884a523. Historical Oct23 tests now inspect their own immutable Git origins, retaining prior values. Current origin test RED before correction then58 origin/client/search/auth tests passed. Separate governancebb424ddf4202eb623f22b8619760c7177d9cf9a3 pins the product; five governance tests pass after an expected old-anchor failure. Priorfcc3623/8133ecd and older receipts preserved. Same91static/115API+3inputs; no enforcement exception. Independent supplemental repo review:0 actionable findings; it does not independently certify server operations.

## Browser acceptance

Normal existing Firebase Faculty/admin login against the generated new-origin candidate through the private GET-only acceptance bridge. Both enter Calendar. Faculty sees roster1/own detail, administrative roles403, actual other-faculty detail403 and work queue403. Admin reads roster119/roles198/queue1; Dashboard and Assignments load. Confidential values/identifiers/screenshots/credentials are not committed. This verifies the recovered API and candidate controllers, not a published Hosting release. Actual-origin smoke checks follow any authorized publication.

## Verification and live-operation boundaries

Focused58/58, governance5/5, combined build and all four source/artifact freezes pass. Generated static bundle91files2338311bytes. Fresh exact-head full CI/artifact is required after final documentation. No SQL DDL/DML/migration/reimport, API source/version change, gates, CORS, permission or ACL change. No merge/Hosting deployment yet. Native200percent zoom remains unverified; prior layout evidence remains separate.

## Current breakpoint / next actions

Finish exact-head CI/artifact, verify final normal Faculty Published view and sign out, capture authenticated current Hosting metadata and verified rollback. Record final execution evidence in PR140 and ignored progress ledger to avoid recursive documentation-only CI commits. Merge/publication must follow the latest UI authorization/release contract and preserve exact-main validation. Only then set recovery PublishedOrigin to the actually served approved origin and require CheckOnly siteReadytrue. Do not update a served artifact ad hoc.

Unattended startup/task installation is not certified. Quick Tunnel can rotate again after restart; a fixed domain/Named Tunnel is still unavailable. Do not claim full unattended website recovery from this manual process recovery.

## DO NOT REDO

Do not weaken ACLs or overwrite old admin evidence, repeat SQL058/data imports, rotate credentials, broaden CORS, restart the now healthy verified API, deploy an older884 artifact, or merge stale136/139 freezes separately. Preserve original and atomic recovery configuration backups.
