# Scheduling Tasks candidate release preparation

Status: implementation and synthetic acceptance in progress. This document is not deployment authorization or completed acceptance evidence.

Scope: Teaching-assignment-azure / Beta, draft PR100 stacked on PR99/98. Review Task02 against b53c23e1621c6a98c2d9b4c62198fdefdebeaf0f. The owner approved design and native sequential implementation with final independent review; only ADFA can mark reviewed/reopen. No live operation has occurred for Task02.

## SQL and runtime preparation

Migration043 follows042 and all Calendar prerequisites. It adds SchedulingVersion rowversion to Session and SessionAssignment, typed derived findings, scoped list/review routines, review metadata and one narrow review execute role. Existing AFC/Calendar versions are reused through explicit binary(8) hex conversion. Existing business values and source provenance are retained.

Column additions require schema locks and database capacity/time assessment before live application. Inspect existing versions, object ownership and permissions; an unexpected rowversion or conflicting object is a stop condition. Rehearse against the disposable baseline and capture object/row counts and recovery evidence. Do not modify source data or remove prior versions to make the migration apply.

`paws_runtime_read` receives execute on ListSchedulingTasks. `paws_scheduling_task_review` receives execute only on ReviewSchedulingTask. Migration grants no account membership. Direct source/review-table writes are not required. Runtime gate `PAWS_SCHEDULING_TASK_REVIEW_ENABLED` defaults off; read availability is independent of review activation.

The dedicated University service account remains unprepared. The existing db_owner identity is not proof of least privilege and is not an approved exception. Prepare and validate the narrow runtime principal before live activation under the approved release requirements.

## Candidate evidence to collect

- Exact product commit, independent product review and resolved findings.
- Actual SQL detection, quality, AFC/privacy, Calendar, filter/paging, review, permissions and observed two-connection race markers.
- Guarded populated/bound rollback refusal and empty-state rollback success.
- Root/server tests and appropriate existing emulator regressions with exact counts/skips.
- Synthetic desktop/mobile/keyboard Tasks acceptance and existing SWAP navigation.
- Separately reviewed immutable freeze promotion, actual protected file counts, exact-head CI artifact/digest and repository/artifact checks.

These are acceptance requirements, not claims that they have all passed.

## Rollback and retained history

Runtime rollback first disables the review gate and restores the previously accepted coordinated API/static artifact. Existing review/audit records and source versions remain preserved. The prior runtime uses explicit source columns, but compatibility still requires rehearsal.

The destructive schema rollback file is only for a verified empty, unbound candidate: it must refuse when review metadata, scheduling-review audit history or review-role memberships exist. Never delete review/audit data or detach a real runtime account merely to force this rollback. Populated deployments require a separately reviewed forward repair or retention-aware migration.

## Integration boundary

Account for PR98 and PR99 and their unfinished live prerequisites before integration. A feature push produces a candidate only. Merge needs directed authorization and reviewed checks; Hosting/API/SQL release needs exact-main CI and coordinated approved operations. Hosting remains `--only hosting` with the accepted generated artifact. Do not publish raw source, tests, workbook, recovery files or credentials.
