# Agent Update — Calendar default and existing service access

**Date:**2026-10-27

**Repository:**Alex1122341/Teaching-assignment-azure
**Task status:**PARTIAL / acceptance and coordinated publication pending

## Goal and starting breakpoint

Continue PR148 `feat/effective-access-20261026` from6318aa7; owner retains current Firebase Hosting/Auth and legacy collaboration storage until future University hosting. Include Calendar teaching-only defaults in this PR. Do not switch to the Desktop Pages repository or migrate data. Latest main42622acf remains integrated; remote main reverified unchanged.

## Work performed

Product commits6ea5a64, a94c3c andcb4298c implement Calendar-only defaultGroups teaching; initial/Reset/user transitions hide work, explicit Select all/Restore all and exclusive Year Rotation remain available. Independent product review found Rotation Year/reset incompatibility; reproduced and fixed. Shared picker custom discovery remains backward-compatible.38 focused tests pass, no failures/skips; same-data1280x720 synthetic actual-component before/after screenshots and interactions checked. Full real-role/native-zoom acceptance remains pending.

Separate independent governance review found no issues: immutable anchorcb4298c,96 static hashes verified from Git blobs, exactly calendar-activities.js/timetable.js changed versus179fa70,127 API plus3inputs unchanged, all comparisons/unions/historical c17f351 receipts preserved. Full historical governance traversal is still running at this checkpoint; no final-head CI/artifact claim yet. Historical6318aa7 all7 CI successes/artifact remain valid only for those previous bytes.

## Corrected diagnosis and live operation

The actual launcher passes its existing DPAPI credential to the child API before clearing parent environment memory. The previous ADC-only conclusion was incorrect. Existing verifier principal authenticates, but initially received PERMISSION_DENIED for Firestore. User logged into the project Owner console and explicitly approved the five-permission custom role plus default-database-only condition at action time. Created pawsSqlCollaboration, bound only to existing paws-beta-firebase-verifier with `resource.name == "projects/tester-teaching/databases/(default)"`. Existing Auth roles/other principals preserved; no new identity/key, delete or IAM/database-administration permission added. See2026-10-27-service-access.md.

The same-identity school-server read-only probe now passes faculty_groups, public_info/information_center and account_audit reads under named apppaws-beta-sql. Group/audit records exist; announcement document absent (normal empty state to verify). No document contents, keys or tokens printed. No SQL/business-data writes, gate change, API restart, merge or Hosting/rules deployment.

## Current breakpoint and next safe action

Collect final local governance tests; commit separately reviewed freeze and finishing documentation, push, verify fresh exact-head CI/build/official artifact. Retain existing credential; do not ask IT to create another one. Proceed through RELEASE_CHECKLIST.md: fresh source/runtime/gates/rules/recovery inventory, approved SQL060 preflight/staging, actual read-only role/adapter acceptance, then accepted merge/exact-main official artifact and coordinated API/Hosting/separate rules cutover. Do not deploy restrictive rules before replacement reads pass. Never change real roles/groups/announcements as fixtures. Keep original ledger human signoffs unsigned and update it with current facts after acceptance.

Do not repeat prior imports/migrations, old broad product reviews or old releases; no CLI refresh-token reuse, no plaintext credential file, no Codex memory edit. Prior missing-credential statements are historical and superseded by this correction.
