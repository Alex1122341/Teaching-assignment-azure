# Agent Update — office workspace released and live accepted

**Date:** 2026-10-24  
**Repository:** Alex1122341/Teaching-assignment-azure  
**Task status:** RELEASED / ACCEPTED FOR THE THREE CHANGED ROUTES

## Goal / source / authorization

Continued after the owner restored school RDC. Standing direct owner authorization “所有发布检测后没问题就直接上线” remains applicable; the later UI brief's explicit-authorization condition was satisfied by that existing instruction. Preserved the history of PR140 with a merge commit, not squash/rebase. Main is87a7f943f40bc5bf87b54b1b0059a2593ebc3b7d; reviewed HEADd0015d8, immutable product486ea03, separate governancebb424dd. Main and reviewed HEAD have identical treead6ab30949dd015a168140fc5e39a6853f23ef40.

## Fresh verification and artifact

- PR CI40113122650 and exact-main push CI40113620342 succeeded. Exact-main job120930262576: root1168total1116pass0fail52skip; server859/854/0/5; emulator1168/1149/0/19; supplemental62/62/0/0. Release/container build and all four freezes passed.
- Main artifact12567194271, azure-beta-87a7f943f40bc5bf87b54b1b0059a2593ebc3b7d. ZIP SHA2569b716c23eb2012cf242f47983aa53900cd8104208ea9c0e10f1e9cd1a181f061 verified locally and on school server. Downloaded static91/API115 freezes passed against product486. Package207files includes one generated API inventory; no new runtime dependency.
- Private server staging: P:\PAWS\Runtime\Staging\OfficeRelease-87a7f94-20261024. Candidate app91files each matched its approved raw hash; API source inventory, release/trust and27 gates, SQL/public TLS and unchanged prior Hosting version were checked before release.

## Actual release

Firebase CLI on school server published **Hosting only**, project/site tester-teaching, from the verified CI candidate/app directory. Deployment-only configuration preserves source headers/redirects; removes predeploy rebuild because the reviewed generated artifact is already complete; includes no Firestore/Functions deployment. CLI exit0 at17:03:12Z.

- Public URL: https://tester-teaching.web.app
- Hosting release1792861391972000; version2c7005ce99b6dbab; release17:03:11.972Z.
- Fresh public raw-byte comparison:91/91 match exact-main artifact on first attempt. Anonymous me401 with correct Hosting ACAO; SQL healthok; all27 gates unchanged.
- Backend remains main8bb40c6/trust58daab3 and its verified source files. No API source/version deployment, SQL DDL/DML/migration/reimport, gate, CORS, ACL or business-data change.

## Recovery / rollback

Original admin-owned log/PID evidence is preserved. Approved launcher differs only in output directory; primary recovery config first changed launcher path/hash/log directory with before/atomic backups, then PublishedOrigin only after the new source was actually served. Recovery CheckOnly17:06:38Z: RUNTIME_AND_ORIGIN_MATCH,siteReadytrue,apiReadytrue,frontendUpdateRequiredfalse, no process restart.

New active origin:gibson-strand-telecharger-governor.trycloudflare.com. Prior Hosting release1792790304159000/versioncb77cef4a37f9c72 and87raw files were saved/verified locally and on server. That rollback returns the previous UI and its already-dead origin/outage state; do not claim a functioning-login rollback. Any later repair must use a reviewed origin product. No fallback was needed.

## Actual-origin browser checks

Normal Faculty and administrator sign-in on tester-teaching.web.app both enter Calendar. Faculty own Dashboard loads and management-role controls are absent. Admin Dashboard119, Teaching Summary searchOlchowy→1 and Assignments queue1 load. New shell/navigation renders on the actual served source. Before publication, the same restored API additionally passed real own/actual-other403/admin403/work-queue403 checks through a private GET-only bridge; no API source or gates changed afterward. Do not mislabel that negative API test as direct production-page instrumentation. Both actual and local acceptance accounts were verified signed out; final production tab remains at the login gate. Private screenshot of the live Calendar is outside the repo, not committed.

## Precise remaining limits / follow-ups

- Existing User Management route is outside these three adapters and byte-identical to prior main. The SQL Faculty test identity still sees its limited legacy HICC group management through the Firestore account role. Its Owner administration was not exercised, no Save/provisioning/group write performed, and the entire route was **not denied**. Record this role-source inconsistency for a separate reviewed consolidation; do not silently alter identity or permissions.
- Existing optional Calendar Firestore enrichment logs “current faculty load: Missing or insufficient permissions”; authoritative SQL reads continue to work. Persistence deprecation warnings also remain. No permission was weakened to suppress them.
- Existing account-label/source-name inconsistency is not repaired by guessing identity. Structured Faculty labels use the shared formatter.
- Native200percent zoom, every populated lazy tab and unattended scheduled-task/reboot recovery remain unverified. Synthetic role/four-width/layout coverage is recorded in earlier receipts. Quick Tunnel can rotate at the next reboot; a fixed ingress is still unavailable.

## Current breakpoint / do not redo

Current product is live, not merely a candidate. Do not redeploy/migrate merely to refresh continuity; do not reset source/data, weaken rules, or merge the old136/139 freeze anchors separately. Preserve the existing managed worktree. Next design slice and any legacy role consolidation are separate work. This final local documentation refresh is intentionally held for the next cohesive documentation/feature PR rather than recursively triggering extra CI/publications for receipt-only commits. PR140 body, school-server receipts and ignored progress ledger contain the final durable execution evidence.
