# Write gates and Testing personas

Source of truth: `deploy/testing/write-gate-matrix.json` (checked against `server/src/data/write-gates.js` and the enforcing modules by `tests/testing-deployment-readiness.test.js`). Route summaries are a reading aid; the enforcing check is in the listed module.

## Write gates

Each gate opens only when its variable is exactly `true`. Production and Testing set gates independently on their own API host; **this PR does not change any Production gate.** Testing opens every gate (`deploy/testing/testing-api.env.template`), so ADFAD testers can use every implemented workflow. Authorization, business validation and audit are unchanged; a gate only decides whether the write path exists at all.

| Gate | Variable | Opens | Routes (summary) | Enforced in | Testing | Persona note |
|---|---|---|---|---|---|---|
| `sessionEdit` | `PAWS_SESSION_EDIT_WRITE_ENABLED` | Timetable: edit an existing session; replace session assignments | `PATCH /api/v1/sessions/{id}`; `PUT /api/v1/sessions/{id}/assignments` | `data/data-api.js`, `afc/afc-request-api.js` | open |  |
| `sessionCreate` | `PAWS_SESSION_CREATE_WRITE_ENABLED` | Timetable: create one session or a batch | `POST /api/v1/sessions`; `POST /api/v1/sessions/batch` | `data/data-api.js`, `afc/afc-request-api.js` | open |  |
| `facultyAdmin` | `PAWS_FACULTY_ADMIN_WRITE_ENABLED` | Faculty Dashboard: Faculty profile, roles and role periods; also required for manual DOE | `writes under /api/v1/dashboard/faculty/{id}…`; `writes under /api/v1/dashboard/roles/{id}…` | `data/dashboard-api.js`, `doe/doe-api.js` | open |  |
| `afcSingle` | `PAWS_AFC_SINGLE_WRITE_ENABLED` | AFC records: add one record (ADFAD) | `POST /api/v1/dashboard/afc-records` | `data/dashboard-api.js`, `afc/afc-request-api.js` | open |  |
| `afcBatch` | `PAWS_AFC_BATCH_WRITE_ENABLED` | AFC records: batch add | `POST /api/v1/dashboard/afc-records/batch` | `data/dashboard-api.js`, `afc/afc-request-api.js` | open |  |
| `afcCancel` | `PAWS_AFC_CANCEL_WRITE_ENABLED` | AFC records: cancel a record | `write under /api/v1/dashboard/afc-records/{id}…` | `data/dashboard-api.js` | open |  |
| `afcRequest` | `PAWS_AFC_REQUEST_WRITE_ENABLED` | AFC self-service requests: create, edit, submit, withdraw | `POST /api/v1/afc-requests`; `POST /api/v1/afc-requests/{id}/*` | `afc/afc-request-api.js` | open |  |
| `afcDecision` | `PAWS_AFC_DECISION_WRITE_ENABLED` | AFC approvals: approve, reject, return | `POST /api/v1/afc-requests/{id}/decision*` | `afc/afc-approval-api.js`, `afc/afc-request-api.js` | open |  |
| `afcArtifact` | `PAWS_AFC_ARTIFACT_WRITE_ENABLED` | AFC approved artifact (signed PDF) creation | `POST /api/v1/afc-requests/{id}/approved-artifact` | `afc/afc-approved-artifact-api.js`, `afc/afc-request-api.js` | open | Artifact routes are never available to personas; use your own account. |
| `afcFormUpload` | `PAWS_AFC_FORM_UPLOAD_ENABLED` | AFC original form PDF upload and record attachment | `POST /api/v1/afc-forms`; `POST /api/v1/dashboard/afc-records (documentId)` | `afc/afc-form-api.js`, `data/dashboard-api.js` | open |  |
| `swapRequest` | `PAWS_SWAP_REQUEST_WRITE_ENABLED` | Swaps: faculty self-replacement request | `POST /api/v1/swaps` | `swap/swap-api.js` | open |  |
| `swapDecision` | `PAWS_SWAP_DECISION_WRITE_ENABLED` | Swaps: candidate / ADFA decisions | `POST /api/v1/swaps/{id}/decision` | `swap/swap-api.js` | open |  |
| `swapApply` | `PAWS_SWAP_APPLY_WRITE_ENABLED` | Swaps: apply an approved swap to the timetable | `POST /api/v1/swaps/{id}/apply` | `swap/swap-api.js` | open |  |
| `taDraft` | `PAWS_TA_DRAFT_WRITE_ENABLED` | Teaching Assignments: HICC draft edits | `POST /api/v1/teaching-assignments/*/draft*` | `teaching-assignment/teaching-assignment-api.js` | open |  |
| `taReview` | `PAWS_TA_REVIEW_WRITE_ENABLED` | Teaching Assignments: submit and VISC review | `POST /api/v1/teaching-assignments/*/review*` | `teaching-assignment/teaching-assignment-api.js` | open |  |
| `taFinal` | `PAWS_TA_FINAL_WRITE_ENABLED` | Teaching Assignments: ADFAD final review | `POST /api/v1/teaching-assignments/*/final*` | `teaching-assignment/teaching-assignment-api.js` | open |  |
| `taPublish` | `PAWS_TA_PUBLISH_WRITE_ENABLED` | Teaching Assignments: publish to the timetable | `POST /api/v1/teaching-assignments/*/publish` | `teaching-assignment/teaching-assignment-api.js` | open |  |
| `doeAdmin` | `PAWS_DOE_ADMIN_WRITE_ENABLED` | DOE: Rule Book Draft edits, validation, Impact Preview, copy; DOE assignments and targets | `POST|PATCH /api/v1/doe/policies/*`; `POST /api/v1/doe/assignments*`; `POST /api/v1/doe/targets*` | `doe/doe-api.js` | open |  |
| `doeManualAssignment` | `PAWS_DOE_MANUAL_ASSIGNMENT_WRITE_ENABLED` | DOE: manual DOE assignments and overrides (also needs facultyAdmin) | `POST /api/v1/doe/manual-assignments*` | `doe/doe-api.js` | open |  |
| `doePolicyPublish` | `PAWS_DOE_POLICY_PUBLISH_ENABLED` | DOE: publish / retire a Rule Book policy | `POST /api/v1/doe/policies/{id}/publish`; `POST /api/v1/doe/policies/{id}/lifecycle` | `doe/doe-api.js` | open |  |
| `doeRecalculate` | `PAWS_DOE_RECALC_WRITE_ENABLED` | DOE: recalculation | `POST /api/v1/doe/recalculate*` | `doe/doe-api.js` | open |  |
| `calendarActivityStage` | `PAWS_CALENDAR_ACTIVITY_STAGE_ENABLED` | Calendar Activities: stage and preview an import | `POST /api/v1/calendar-activity-imports`; `POST /api/v1/calendar-activity-imports/{id}/preview` | `calendar/calendar-activity-api.js` | open | Import writes run on the separate import pool; run them as yourself. |
| `calendarActivityCommit` | `PAWS_CALENDAR_ACTIVITY_COMMIT_ENABLED` | Calendar Activities: commit a previewed import | `POST /api/v1/calendar-activity-imports/{id}/commit` | `calendar/calendar-activity-api.js` | open | Import writes run on the separate import pool; run them as yourself. |
| `calendarActivityTime` | `PAWS_CALENDAR_ACTIVITY_TIME_ENABLED` | Calendar Activities: resolve time evidence | `POST /api/v1/calendar-activities/{id}/time-evidence` | `calendar/calendar-activity-api.js` | open |  |
| `cccReplaceStage` | `PAWS_CCC_REPLACE_STAGE_ENABLED` | CCC replacement: stage and preview a whole-year source | `POST /api/v1/ccc-replacements`; `POST /api/v1/ccc-replacements/{id}/preview` | `calendar/ccc-replacement-api.js` | open | Import writes run on the separate import pool; run them as yourself. |
| `cccReplaceCommit` | `PAWS_CCC_REPLACE_COMMIT_ENABLED` | CCC replacement: commit the exact previewed source | `POST /api/v1/ccc-replacements/{id}/commit` | `calendar/ccc-replacement-api.js` | open | Import writes run on the separate import pool; run them as yourself. In Testing the synthetic data can be reset afterwards. |
| `schedulingTaskReview` | `PAWS_SCHEDULING_TASK_REVIEW_ENABLED` | Scheduling Tasks: review a task | `POST /api/v1/scheduling-tasks/{id}/review` | `scheduling/scheduling-task-api.js` | open |  |

**How it is verified.** Before a Testing revision is activated, `tools/verify-testing-api-env.js` requires every gate to be set explicitly to `true` or `false`, rejects unknown `PAWS_*` names (typos), and prints the gate map. After activation, the deploy compares that map with `writeGates` reported by `/api/health/runtime`. Unit tests cover enabled and disabled gates (`server/test/*-api.test.js`, `tests/testing-deployment-readiness.test.js`).

## Persona route access

Identity switching reuses Developer Support (`server/src/support/support-service.js`). The real operator is verified from their own Firebase token and SQL profile on every request. The persona is never above the operator's rank, and both are recorded on `paws.SupportOperation` and `paws.AuditEvent`.

| Route family | Production (Developer Support) | Testing persona | Undo |
|---|---|---|---|
| `/me`, `/sessions`, `/dashboard`, `/swaps`, `/teaching-assignments`, `/doe`, `/afc-requests` | read + write | read + write | yes (captured tables, migrations 033–035) |
| `/afc-requests/*/approved-artifact` | denied | denied | — |
| `/calendar-activities` (list, capabilities), `…/{id}/time-evidence` | denied | read; time evidence write | no (reset restores) |
| `/calendar-activity-imports` | denied | view an import; **stage/preview/commit refused** | — |
| `/afc-forms` (list, capabilities, document; upload) | denied | read; upload | no (reset restores) |
| `/ccc-replacements` | denied | view capabilities/template/staged source; **stage/preview/commit refused** | — |
| `/change-history` (query, page, export) | denied | read | — |
| `/faculty/{id}/availability` (SQL056) | denied | exact GET only; real API/SQL own-faculty restrictions remain | — |
| `/ccc-schedule` (SQL057) | denied | exact GET only; public schedule fields, academic year required | — |
| `/scheduling-tasks` (list; `…/{id}/review`) | denied | read; review | no (reset restores) |
| anything else | denied | denied | — |

Import writes are refused because they run on the separate import SQL pool (90-second timeout), outside the audited support transaction, so the real operator could not be bound to the change atomically. Testers run imports as themselves. Non-undoable operations show **Reset to restore** in the identity dialog, and the server refuses to undo them (`SUPPORT_UNDO_UNSUPPORTED`).

Pre-existing gap, not changed here: a Developer Support swap apply also writes `paws.SwapCalendarActivitySnapshot` (migration 039), which has no capture trigger.
