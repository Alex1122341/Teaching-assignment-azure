# Agent Update — restart scripts merged; local installation remains

Date:2026-10-17
Repository:Alex1122341/Teaching-assignment-azure
Status:preparation complete; human installation/reboot acceptance pending

PR114 merged as `3632b89775bb571672a101a67089bacc3e17881a`, source head `fdefaf9c1f223c7f98bb1175b61b0f5d429e82bc`. Candidate CI39043245636 and exact-main CI39043651675 succeeded. Both runs:root939/887pass/52skip; server654/650pass/4skip; emulator939/920pass/19skip; final deployment65/65; zero failures. Independent corrective review Ready; actual module test1/1 and real Windows Server CheckOnly/Task Scheduler XML acceptance passed. No task registration, reboot or live process restart during script acceptance.

Merged artifact zip SHA256 `3337f2e0b9801e50ca140a191920293a591d214cdc706e41c628f8db154ca7fc`; candidate zip `ec494745c7026ef0b39fc63df72fc564a034f7af53b9a0e850e7218cd6ce44eb`. Existing static77/API84 freeze retained. Ops scripts are outside the shipped runtime allowlists. Live API/Hosting still identify accepted login release `6b5e744530308c2153d89ddd488731a9f4708c30`, anchor `331a636544e7232dbe98f67edbdf1cfbfa0e535d`; no redundant app release required for these ops/docs/test changes.

Server scripts/config/XML: `P:\PAWS\Runtime\Recovery`. Three uploaded script hashes equal reviewed local files. Existing API PID12328 preserved; SQL healthok. P: is local fixed disk. Installer defaults to export-only. Human must invoke Install-PawsRecoveryTask.ps1 with -Install locally and enter existing approved UC\sa-xinyu.zhu1 credentials in Windows prompt, then verify batch-logon policy and reboot behavior. Do not request password through chat. User has no fixed Cloudflare hostname: Quick Tunnel may change after reboot; exit3 explicitly requests reviewed frontend-origin update, no automatic Hosting mutation. No claim of complete unattended website recovery.

User deliverables: `C:\Users\xinyu.zhu1\Desktop\PAWS进度管理\服务器自动恢复\20261017` (scripts, nonsecret explicit config, Chinese operating instructions, public acceptance receipt, login screenshot). Original progress workbook updated19 cells preserving manual/native package features:09–11 live/pending human acceptance;9pass/8open/1N/A;12–14 factual statuses preserved. No global-memory changes.

Next: human task installation/Named Tunnel/reboot acceptance and actual multi-account history UI acceptance. Continue other authorized tasks independently if human steps unavailable. Do not replay540 migration, restore private recovery, change gates, require dedicated new account, deploy Firestore or stop healthy API/tunnel. Prior login coordinated release is complete, not pending. See previous detailed update `2026-10-17-login-restored-startup-recovery.md`.

This post-merge checkpoint is intentionally a local continuity update; do not create another release just to publish documentation.
