# Agent Update — PR73 controller limit and capability correction

**Date:** 2026-10-16  
**Agent/model:** Codex  
**Repository:** Alex1122341/Teaching-assignment-azure  
**Task status:** PARTIAL — corrected product accepted; final verification running

## Starting breakpoint and findings

The owner instructed continued acceptance and release. Previous candidate
`5c42fda47797a5735e88dc2aa7ab94505a0ad000` on
`fix/afc-doe-recovery-20261008` had independent product/governance approval.
Full local root and CI407 (run38925556453) then both reported 911 tests:
861 pass, 49 explicit skips, one failure. The existing controller limit was
exceeded: 60,938 canonical LF bytes versus a bound below 60,000. That candidate
was neither merged nor deployed. The failure was not a database issue.

## Corrective product

`d049fe0fb4fb51e9fcefab3a4151c2600d3cc074` moves the manual AFC form values,
Gregorian validation, confirmation and uncertainty state into the existing
`faculty-admin-afc-records.js` module. The controller now measures 58,397 LF
bytes. Shared single/batch busy coordination remains, and date normalization
is lazy so unrelated views do not eagerly require the batch helper.

Standards review found the final button update could overwrite a refreshed
closed capability. Added a public DOM-event regression: RED before the fix,
GREEN after. The final state preserves the server capability and uncertainty
lock without clearing the confirmed success message. Removed the orphaned
controller flag. Both corrective product reviewers returned Ready. Existing
public flow/controller-contract checks: 52/52 pass, zero skips.

## Separate governance and verification

Corrected anchor is the product commit above. The same 75 static paths remain;
the exact protected delta from released layout anchor `3cd51ca` is now three
files: controller, AFC records helper and AFC workflow. The 76 API runtime
files and all 79 protected API/build/package inputs remain byte-identical.
Historical CSS governance `4082c625` and DOE UI governance `7a903318` remain
pinned. Three-file promotion test was observed RED before advancing the anchor,
then GREEN (1/1, zero skips). Both separate corrected governance reviews returned Ready. Canonical build
and repository/static/API artifact freezes passed. Fresh full-root result
remains pending at this checkpoint.

## Current live state / next action

PR55 is merged as `d75d8eb`; candidate CI405 and exact-main CI406 passed.
No runtime delta or redundant release. Hosting remains accepted PR103/106
runtime `21c2db7`; all 75 public assets and actual Chrome were verified, and
the local Excel D03 result remains passed. Entire Task22 stays partial.

Finish corrected governance review and verification, push to the same PR73,
then require fresh candidate/main CI and artifact verification before the
authorized Hosting-only release. No SQL/data migration, API rollout, rules
publication, policy publication/recalculation, permissions or gates changed.
No live AFC write was performed. Preserve the user's untracked preview and
original browser tab. Do not rerun the accepted DOE release or source imports.
