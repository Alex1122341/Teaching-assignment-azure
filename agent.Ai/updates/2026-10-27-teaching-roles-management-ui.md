# Scoped teaching roles — management UI checkpoint

Continue PR148 / `feat/effective-access-20261026` in Teaching-assignment-azure / Beta / University SQL. The owner authorizes a suitable existing Faculty account to be provisioned if truly needed; none was created here, and Tim's existing normal sign-in remains the preferred live acceptance identity.

## Implemented

- Mount Owner-only leadership catalog, preview, commit and academic-year history under the existing bounded, authenticated, no-store access HTTP boundary. Reuse the account-access write gate and existing persisted operation retry policy.
- Catalog input may bind its exact authority epoch in the preview. Public catalog omits recovery signatures, source contacts and DOE. Grants and base-role editing remain separate operations.
- Own summary displays current-year dated HICC / Course Coordinator and VISC course/area descriptors while preserving Faculty. The guard now invalidates on scope fingerprint or current-year change.
- Effective HICC can manage only their existing UID-owned collaboration groups. VISC alone, membership, malformed scope or an expired grant gives no group authority. Tim's existing lack of group ownership is valid; no ownership transfer was made.
- Teaching Assignments queue navigation uses trusted own roles; detail actions use server package capabilities, including separate submit/review/final-submit flags. No own-submission VISC review is invented. Default academic year follows the current Calgary May–April year.
- Owner management includes selected-year catalog, explicit source/scope/dates/default provenance, reason, grant/revoke preview, readback and same-operation retry after an unknown outcome. Changing year clears old catalogs/history and rejects late old-year history.
- Dense keyword-searchable history is bounded to50 operations per page and the selected person/year. Original granted scopes are hydrated from immutable operation receipts, never today's mutable definitions; source/recovery signatures are stripped. SQL062 adds an Owner-checked read procedure and guarded rollback removes it only in the unused reverse sequence.

## Verification and limits

Historical exact327b4aabdd5aac94b2f8564d1d13accc02854ff7 Account SQL run40610807118 /job122561576272 passes34 markers. Receipt: private `firebase-preflight-20261027/sql061-063-hardened-327b4aa-receipt.json`. New SQL062 catalog/history bytes are later and require a fresh35-marker isolated run, including `HISTORY_YEAR_OWNER_BOUNDARY`.

Current local full server:1011 total /1004pass /0fail /7skip, `multiple-roles-server-task4-final.log`. A prior full run exposed the missing history procedure in the runtime permission inventory; fixed explicitly, targeted29 checks green and fresh full server green. Frontend focused34/34, `task4-frontend-final.log`; source/build syntax and diff checks pass. Immutable freezes were not promoted; current full-root freeze failures remain release gates, not accepted drift exceptions.

Browser: actual generated96-asset application with private synthetic API/Auth adapters, no school data. At1280×900 and390×844, long names and two responsibilities render; grant/default dates/preview/confirm/readback, keyword history/empty result and keyboard Tab focus verified; changing year hides old form. Long select/date overflow reproduced then fixed; final narrow DOM bounds show no overflowing controls. Console errors/warnings:0. Before/after desktop and after-narrow screenshots are private in `firebase-preflight-20261027/multiple-roles-*.png`. This is not normal Firebase/SQL role acceptance. The preview is loopback19065; its service may need restarting after a turn ends. Graphify is separately generated at19067 and the mandatory lookup rule is now in AGENTS.md.

## Next

Latest acceptance after this checkpoint: SQL062 now returns explicit empty arrays for empty catalogs/history. Actual failing isolated tests exposed the omission; a bounded read-only constants query on school master reproduced SQL JSON behavior without any business-table access or mutation. Test capture keeps the standalone procedure's outer-transaction guard and uses compatible sqlcmd large-JSON options. At8547479171514203093def8b87428063fdfdea22, all six isolated SQL workflows pass; Account40628160864/job122617982193 has35 markers. Receipt: private `sql060-063-exact-8547479-receipt.json`. A new deferred-response test reproduced stale own-scope replacement after identity change;8547479 checks generation before assigning the scope and passes76 related tests. Older auth mocks and the explicit client method inventory were updated without weakening their assertions. Full root1371total/1270pass/46fail/55skip now has only unpromoted runtime-governance failures; Build40628160924 consequently skips emulator and official artifact. No green release/artifact claim.

1. Product and exact8547479 isolated SQL35 proof are pushed/collected. Preserve them as historical receipts after later edits; no need to rerun the same unchanged boundary repeatedly.
2. Finish normal Tim scoped configuration preview/recovery tooling and actual-role acceptance under the approved505/Bovine dates. Do not repurpose historical P2 packages or infer ownership from topic/area text.
3. Independent complete-branch product review and separate reviewed immutable freeze promotion; fresh exact-head/main full/emulator/all-SQL/official artifact before coordinated API, Hosting and separate restrictive-rules release.
4. Update the original progress workbook on material final acceptance/release, preserving existing human signoffs. Do not redo the previous workbook write as bookkeeping.

No school SQL061–063, Tim grant, new Auth account, actual collaboration write, production restart, new gate enablement, rules release, merge or deployment occurred here.
