# Agent Update — Session SWAP release preparation

**Date:** 2026-10-09  
**Agent/model:** Codex  
**Repository:** Alex1122341/Teaching-assignment-azure  
**Task status:** PARTIAL — CI and deployment in progress

## Goal and breakpoint

Owner requested session SWAP using the reference index and Final Role Matrix, optional replacement consent, correct field/office routing and preferred name display with separate source-backed HR identity. Owner adopts recommended brainstorming choices and has authorized publication. Branch `feature/session-swap-20261009`; PR79: https://github.com/Alex1122341/Teaching-assignment-azure/pull/79. Runtime product/trust anchor `e45ef1463195f4e47f6492c956469e72df94abaf`.

## Work and evidence

Implemented SQL030 workflow,031 narrow procedure permissions,032 nullable HR columns with narrow read grants; API/routes/gates and frontend session dialog/inbox/pending badges. Central preferred formatter removes commas; HR matching uses exact Master explicit pairs, never fuzzy or reordered names. Inline review repaired field authority, original faculty routing across office revisions, stale/idempotent request handling, retained candidate selections, target consent, and non-overridable missing identity/date/time.

SQL030 compiled in a rolled-back transaction on ITAPPVETOPSDB01 / VetMed-Ops; SQLCMD exit0. All changed JS parsed. Static build65 files/API build65 runtime files; freeze protects65static and68API/build/repository paths. No new tests or local test suites. Existing CI initially exposed dependency fixtures/inventory expectations and an auth refresh coupling; repaired them. Latest product commit for SQL/fixture correction `81c1ad7` awaits existing automatic CI. Independent agents hit no-credit errors, and independent review was unavailable; root continued inline without claiming reviewer approval.

User explicitly authorized Chrome saved login; reference tab1379045172 on browser3 successfully signed in and its approval queue inspected. No request or decision was created at the synthetic reference. Existing Beta tabs1379045166/1379045175 and Faculty1379045201 remain user-owned.

## Live operations

Only read-only facts and rolled-back DDL compilation so far. Live API remains release `2b48f7d4131d562a9b3e3ac29e9d88ab4ebb737a`, anchor `902a6cc6a876e24badf12df1deb7853fc0cc2993`, PID31700 at127.0.0.1:18787, ingress https://radar-languages-shopper-corporate.trycloudflare.com. Hosting https://tester-teaching.web.app. SwapRequest and HrName columns still absent at latest read. No persistent migrations, HR import, merge or release yet.

## Source and recovery artifacts

Master SHA256 `a834d571a25942a1242c9ae3d4f56f975525dfa48658c76883a92dac6bb1d1b4`. Private source/crosswalk/import/recovery artifacts are outside Git: `C:/Users/xinyu/Documents/Codex/2026-08-31/outputs/session-swap-names-20261009-private`.97 exact operations,24 unresolved left blank. `import-hr-97.sql` guards source plan count, all121faculty snapshot count, exact97before-images/UpdatedAt and nullHR; updates onlyHrName/HrNameSource, with audit. `recover-hr-97.sql` guards exact imported values before restoring null, preserves audit.

Remote staging/evidence: `P:\PAWS\Runtime\Acceptance\SessionSwap-20261009`. Server C: has no space; useP: for staging/runtime/temp/logs. Existing credentials remainDPAPI atC:\PAWS\Runtime\Secrets; never output them. Prior launcher for recovery: `P:\PAWS\Runtime\Acceptance\DoeDraftHotfix-20261009\Start-DoeDraftHotfix-Live.ps1`.

## Next safe action / do not redo

Inspect latestPR79 CI and repair actual failures, then merge under existing authorization and require exact-main CI. Stage accepted runtime with canonical source attestation and dependencies junction; apply030/031/032 and guarded HR import once; bind existing reviewed runtime principal to3SWAProles. Guarded cutover preserves all existing gates and activatesSWAPrequest/decision/apply. Deploy Hostingonly. Read-only liveUI/API/SQL acceptance; no fabricated requests/consent.

Do not reimport DOE, fill missing targets, assign guessedADC/LAB/VISC users, alterpolicy activation or broaden Firestore access. Most sessions lack explicitVISC ownership and noADC/LABprofiles exist; missing routes must report None/unavailable. LABgroup/roster unsupported data is visibly disabled. Do not rerun the old private exact-replacement repair scripts. Do not commit privateoutputs. Maintain this breakpoint through compaction until published.
