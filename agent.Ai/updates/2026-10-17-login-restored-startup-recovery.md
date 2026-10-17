# Agent Update — login restored and startup recovery preparation

**Date:** 2026-10-17
**Repository:** Alex1122341/Teaching-assignment-azure
**Task status:** PARTIAL — login released; startup scripts prepared, installation deferred

## Goal and breakpoint

Recover Beta login after Saturday server reboot and prepare automatic process recovery. Base/main `6b5e744530308c2153d89ddd488731a9f4708c30`; branch `feat/startup-recovery-20261017`. Prior update: `2026-10-17-login-outage-recovery.md`.

## Login release completed

- Root cause: old Quick Tunnel hostname returned NXDOMAIN; API/tunnel were absent after server boot at 02:07:25. Firebase Hosting/Auth remained available. SQL health passed after restoring the accepted API; no evidence of database corruption.
- PR113 merged as `6b5e744530308c2153d89ddd488731a9f4708c30`, shared accepted runtime anchor `331a636544e7232dbe98f67edbdf1cfbfa0e535d`. Candidate CI39041242482 and exact-main CI39041652862 passed. Main root938/886pass/52skip; server654/650pass/4skip; emulator938/919pass/19skip; final deployment65/65; zero failures.
- Candidate/main downloaded artifacts:160 raw files identical (78 app/82 API). Freeze77 static /84 protected API inputs passed. Main zip SHA256 `4fe25f35dd2e27defea398c212d6ae972172f591591e0064077b970a566c7c1e`.
- Applied reviewed SQL047 (canonical hash `83E4B2C0916CA1B0CA425083F5F82B986F4B781589D03E0472C80CABEDF6CB46`);28 protected table fingerprints and business/audit counts unchanged. Context empty, no historical backfill.
- Coordinated API6b5e744/331a636 cutover with all accepted write gates unchanged, then exact-main Hosting-only release.77/77 public protected static files matched raw bytes.
- Chrome707482489 retained Firebase session and loaded authorized ADFA Owner timetable with11 work ranges. Screenshot in local acceptance folder. SQL health200; anonymous /api/v1/me401; Firebase-origin CORS204.
- New live Quick Tunnel: `https://charge-concerning-hypothesis-represents.trycloudflare.com`. This is temporary and may change after restart.

## Recovery implementation and review

`tools/recovery/` contains PS5.1 module, runner, export-first installer and operating instructions. Fixed config pins launcher, source manifest, complete source/package/lock inventory, cloudflared, release, anchor and exact write gates. Runtime must bind loopback18787. Only absent accepted processes start; unknown occupied listeners fail closed. Mutex and Task Scheduler IgnoreNew prevent overlap. No business-data operations or Hosting changes.

Task triggers: boot+2min, configured account logon, daily repetition every2min; least privilege, bounded execution, three failure retries. Existing approved `UC\sa-xinyu.zhu1` identity exception preserved. Credentials are entered only locally if human selects `-Install`.

Independent review initially required source attestation; test-first correction added manifest/inventory/LF hashes before startup. Corrective review Ready, independent actual PowerShell regression1/1 passed. PS parse checks passed. Full root npm test completed:939 total,887 passed,52 environment skips,0 failures (275663ms). Static77/API84 freeze checks passed without changing the anchor.

## Live preparation / evidence

- Scripts and explicit nonsecret config copied to `P:\PAWS\Runtime\Recovery` on ITAPPVETOPSDB01; P: confirmed fixed local disk, not user drive mapping.
- Real Windows PowerShell5 CheckOnly: exit0, RUNTIME_AND_ORIGIN_MATCH, siteReady=true, startedApi=false, startedTunnel=false.
- Export-only installer: installed=false. Task Scheduler COM accepted XML:3 triggers, Password logon type1, least-privilege runLevel0. No registration. Live API PID12328 unchanged.
- Server launcher hash `3DA6B4F3EA2EB3F0888981C7FF1CF95E732E8382C48F7E5B5D6D453C528E76C0`; source-manifest raw hash `4D7BFF6DEC5036CE5F71DEA182F4A05F05D5A831593A7CB849289DB3724A6263`; cloudflared2026.10.1 signed binary hash `4d2490e74082c5d48dbfedaf92576fa5bd1702379ab88eb7faa0cfbe8dc891b6`.
- Original progress Excel updated19 targeted cells:09–11 now live/pending manual acceptance; login restored and recovery prepared stated.9pass/8open/1N/A. Manual fields, formulas, styles, tables, validations and dimensions preserved and checked.12–14 factual states retained.

## Remaining / next safe action

Finish full-root tests, open reviewed ops-only PR and validate CI. No frontend/API runtime bytes changed by recovery PR, so no freeze promotion or redundant Hosting release. Human must register the exported task with existing account credential on the server and validate domain batch-logon eligibility/reboot. User has no fixed hostname: Quick Tunnel recovery may require manual frontend-origin PR/release, explicitly exit3 FRONTEND_ORIGIN_UPDATE_REQUIRED. Do not describe export as installed recovery.

## DO NOT REDO

Do not replay the540 migration or export private recovery contents. Do not use obsolete C:\PAWS\Runtime\Start-PAWSApi-Temporary.ps1. Do not alter gates/accounts/roles/TLS or deploy Firestore. Do not stop healthy live processes for a reboot simulation. Preserve original owner preview and history-worktree continuity changes.
