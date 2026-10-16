# Task03 selected schedule export — acceptance record

## Scope and authority

Owner approved the bounded design and TDD seams after the six-part repository review in selected-schedule-export-review-20261015.md. Later owner authorized acceptance then release, confirmed the dedicated University runtime account remains unavailable, and directed independent acceptance first. Frontend server migration is deferred; current Firebase frontend acceptance/publication is allowed. This record is candidate evidence, not live acceptance or publication.

Reuse the existing CSV modal, pure selection module, authenticated University session client/API/repository and download helper. Teaching sessions only; no private directory enrichment or new role/gate/source. VISC stays Not provided because the authoritative DTO does not provide it. Course selection covers all matching authorized dates, with individual choices, count, preview and CSV. Selection is distinct from the hidden editing workflow and its200-row limit.

## Implementation and safety

Read-only report snapshots scalar public fields, excludes CCC ranges and private metadata, rejects ambiguous duplicate IDs and atomically enforces a5,000-record selection bound. Course checkboxes reflect partial selection. Checklist initially renders100 rows and expands100 at a time; preview includes every selected record. Date/start/course/ID ordering is deterministic. IDs never enter public preview/CSV. Text is HTML-escaped; quoted UTF8 CSV neutralizes leading spreadsheet formula characters. Missing ordinary CSV fields remain empty; displayed preview labels missing values, and VISC has an explicit Not provided field.

Fresh authorized reads occur on open and before download; complete selected field snapshots must match. Data removal/change, authorization/read failure, account/role/faculty scope changes, closed/replaced modal and selection changes during pending reads refuse stale export. Subscriber cleanup follows modal lifetime. No database writes or policy/DOE calculations.

## Independent product review

Reviewer /root/review_task03_export reviewed the uncommitted product against base6ab3a5258898111cb1b8a0efb1450530cc601f7a / HEAD fcb2bda. One Important finding: parallel LABs with equal course/date/time were ordered by selection insertion in preview but source order in fresh comparison, causing false schedule-change refusal after reselecting a row. Public regression first failed with Station B/A instead of A/B. Fix adds the session ID tie-breaker and derives preview from the same ordered item list. No IDs leak. Model/existing tests14/14 and actual Chrome same-slot reselection/reversed-source download passed. Independent fix-pass review returned Ready for product acceptance with no outstanding Critical/Important/Minor findings.

Reviewer explicitly declined live SQL/auth availability, candidate CI/artifact/governance/release, maximum-size mobile performance, complete shared-loader races and unchanged legacy CSV/editing behavior. Root supplements the helper/auth seam below; no production-performance claim is made.

## Local acceptance

- Actual installed Chrome uses shipped CSS/core/selection and extracted actual modal functions with synthetic authenticated-data boundary. Nine scenarios: exact multi-course/subset download; account scope clearing/cleanup; changed-source refusal; safe failure/close-during-load; desktop/mobile/keyboard/clear; same-slot reorder download;103-row page-wide selection;5,001-row overflow preserving a valid earlier selection; changed selection/logout during download revalidation.
- Actual client → data API authorization → SQL session repository query construction → actual fetchAzureSessions/azureSessionRow/ensureAllSessions → report model is exercised with only Auth/profile/DB transport boundaries synthetic. Nine supported role/alias profiles, five denied profile states and subsequent revocation are checked. Reads reach the API/repository again for refresh; self scope binds server FacultyId, offices/admin retain existing scope. This is not a live SQL execution claim.
- Existing server runtime/repository/P1 permission regression plus new integration:25/25 passed,0skips/failures on bundled Node22. New report tests cover public projection, chronology, literal CSV/formula escaping, atomic overflow/unknown timing, duplicate identity rejection and deterministic same-slot order.
- Combined command `node --test tests/selected-schedule-export-ui.test.js tests/selected-schedule-export.test.js tests/selected-schedule-export-integration.test.js tests/timetable-selection.test.js tests/timetable-views-export.test.js`, with bundled Playwright explicitly enabled, passed29/29,0skips/0failures (nine actual Chrome scenarios). Full candidate root/server/emulator/build/freeze/CI/artifact remains a separate stage until recorded below.

## Release boundary

No schema/API/runtime-role changes are introduced by Task03. Candidate inherits Calendar/ADFA/Scheduling dependencies from accepted but unmerged PR98/99/100. Do not release the new static frontend against an incompatible old API, or treat these dependencies as deployed. Dedicated least-privilege University account remains unavailable; owner requested independent acceptance first. Separate actual runtime/source-operation preconditions still apply. Do not merge DOE UI PR103 into this feature; PR101/102 are documentation-only Task22 references.
