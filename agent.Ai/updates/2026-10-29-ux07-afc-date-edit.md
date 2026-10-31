# Agent Update — UX-07 AFC date edit (office direct, faculty re-approval)

**Date:** 2026-10-29  
**Agent/model:** Claude Opus 5.5 (with Sakib)  
**Repository:** Alex1122341/Teaching-assignment-azure  
**Task status:** COMPLETE (PR open; SQL migration 064 not applied)

## 1. Goal

Alex's added worklist item: faculty sometimes change their AFC days. The ADFA office or the faculty member can change them; a faculty change triggers another approval. Rules agreed with Alex on 2026-10-29:
1. Faculty edit of an approved AFC: old dates stay in effect until the new dates are approved.
2. Pending requests cannot be edited: withdraw and submit again.
3. ADFA office edits apply immediately and show in Change History.
4. No new/extra PDF; SQL history records "from old dates to new dates".

## 2. Starting breakpoint

- base: `fix/ux01-afc-withdraw-wording` (UX-01 product `7dca82e` + governance `04dff83`, not yet merged)
- working branch: `feat/ux07-afc-edit`
- product SHA: `3425cbab798f0dc18291ac5ba31265270ee2fbce`

## 3. Work performed

- SQL `064_afc_date_edit.sql`: `paws_api.UpdateAfcDates` (office: manual/import records and approved requests, rowversion check, retry-safe by RequestId, blocked while a faculty change is pending), `paws_api.SubmitAfcDateChange` (requester's approved request only; calls the normal `SubmitAfcRequest`, links `ReplacesAfcRequestId`, one open change per request), `ApproveAfcRequest` supersede branch (old request -> `superseded`, `SupersededByAfcRequestId`), `AfcRequest.AfcVersion` rowversion, `superseded` status, history allowlist (`afc_dates_changed`, `afc_date_change_requested`), role `paws_runtime_afc_edit_write`, column read grant. Acceptance (rollback-only) and rollback scripts.
- API: gate `PAWS_AFC_EDIT_WRITE_ENABLED` (`afcEdit`); `POST /api/v1/dashboard/afc-records/{id}/dates` (office); `POST /api/v1/afc-requests/{id}/date-change` (faculty, full signed form, also needs `afcRequest`); `POST /api/v1/afc-requests/{id}/dates` (office). Capabilities `afcEdit` / `dateChange`.
- UI: AFC Records "Edit dates" inline editor; AFC requests "Change dates" (faculty, prefilled form, new approval), "Edit dates" (office), withdraw hint on pending, "Replaced by new dates" status, pending-change notes.
- Separate governance commit promotes the freeze (5 static, 8 API files).
- No live reads/writes, no migration applied, no deployment.

## 4. Files / components changed

See the product commit; migrations 064 (+ acceptance, rollback); tests `server/test/ux07-afc-date-edit.test.js`, `tests/ux07-afc-date-edit-ui.test.js`, updated gate/capability/permission fixtures.

## 5. Architecture / invariants affected

New write role and gate (fail closed). History events additive. `afc_record_cancelled` and existing procedures unchanged except the additive supersede branch in `ApproveAfcRequest`. The approved PDF of an office-edited request keeps the originally approved dates (Alex: no new PDF). A superseded request's PDF is no longer downloadable; the replacing request has its own normal approved PDF.

## 6. Data / algorithm changes

Office request edits recompute WorkDays with the server `workDays()` policy.

## 7. Tests / CI evidence

Root: only the pre-existing PowerShell test fails. Server: only the 5 pre-existing Docker/PowerShell tests fail. The SQL itself was not executed (no SQL Server here); run `064_afc_date_edit_acceptance.sql` on staging.

## 8. Live operations

None.

## 9. Current state after task

PR open, stacked on UX-01. Merge UX-01 first (merge commit, not squash: governance tests reference the UX-01 SHAs).

## 10. Blockers / unresolved questions

Release order: apply 064 -> run acceptance -> add runtime identity to `paws_runtime_afc_edit_write` -> deploy API -> enable `PAWS_AFC_EDIT_WRITE_ENABLED`. `listRequests` selects the new columns, so the API must not be deployed before 064.

## 11. Exact current breakpoint

`feat/ux07-afc-edit` = product `3425cba` + governance commit.

## 12. Next safe action

Review; apply 064 on staging and run acceptance.

## 13. DO NOT REDO

Do not edit pending requests in place; do not regenerate PDFs on office edits.

## 14. Suggested next-agent prompt

After UX-01/UX-07 merge and 064 acceptance, continue with UX-02 (AFC PDF access).
