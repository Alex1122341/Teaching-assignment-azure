# Faculty Availability coordination

## Existing functionality

The Faculty Dashboard already contains Availability and serves the single-faculty Agenda through `GET /api/v1/faculty/:facultyId/availability` and `paws_api.ListFacultyAvailability`. The SQL projection includes teaching assignments, committed Calendar Activity, AFC, pending requests and role windows. Migration 068 excludes Available Special Leave from the blocking AFC projection. The new tab uses the same scope and source rules. Legacy callers retain their route, date modes, filters, DTO and SQL procedure.

| Source | Included in coordination | Coverage and limits |
| --- | --- | --- |
| Teaching | `vCalendarSession` joined to the selected Faculty's `SessionAssignment` | Duplicate assignments for the same Faculty and session collapse. Undated sessions make that person's coverage incomplete. The schema provides one session date, so a reversed same-day clock is unknown. |
| CCC, Rotation and other work | Committed `CalendarActivity` rows with `CalendarActivityDayTime` | Each dated activity uses its own verified time per day. A missing day remains unknown. Display defaults on Calendar do not become time evidence. Unassigned slots have no Faculty to check. |
| AFC and approved leave | Active `vAfcRecordUnified` plus approved requests absent from that view | Unavailable leave blocks the day. Available Special Leave follows 068 and is excluded from the blocking projection. Withdrawn records and inactive source rows are excluded. |
| Pending AFC | The two pending `AfcRequest` states | Tentative for the recorded date range. Rejected and withdrawn requests are excluded. |
| Roles and appointments | Imported and authoritative responsibility windows | Dated appointments display as Ongoing Responsibility. They do not consume time in the search. Malformed or undated role windows remain a coverage warning and prevent certifying unverified time for that Faculty. |

## Implementation

The existing tab owns the Faculty selection, date modes and daily Calgary hours. Summary, Timeline and Agenda use one result. Summary reports the most restrictive evidenced status in the window and allows users to expand records. Conflicts, unknown statuses and no-conflict results can be filtered separately. Timeline expands dates in a day matrix and places timed records at their actual position inside the window. Agenda filters and groups the loaded data and pages 40 records at a time.

Find Common Time uses a bounded day or range. The required people and the minimum attendance must be clear for the entire returned interval. The same group is counted throughout the interval. The result shows the longest interval for that group at an eligible start, sorted by attendance, date and time. Repeated windows contained in an earlier window for the same group are omitted. Daily hours are Calgary wall time. Ambiguous and skipped times around a Calgary clock change are treated as unknown. Start-time steps are measured from the chosen daily start.

## API and SQL

Bulk endpoints live under `/api/v1/faculty/availability/`.

| Endpoint | Method | Result |
| --- | --- | --- |
| `roster` | GET | Permitted IDs, canonical names and active state |
| `query` | POST | Date and daily time selection, summary, coverage, and first event page |
| `page` | GET | Next 800 events from the same result |
| `common-time` | POST | Ranked common intervals from the query result |
| `common-time/details` | GET | Per-Faculty status and relevant scheduling evidence for an interval |
| `export` | GET | CSV or Excel for every Faculty in the filtered Summary |

Migration 072 installs `paws_api.ListFacultyAvailabilityBulk`. It collects sources for the selected Faculty in one database call using set operations, then returns a bounded projection. The original procedure remains intact. The grant is EXECUTE to the existing runtime read role. The migration makes no business data writes or persistent tables. The API keeps a short-lived result in memory so pagination and exports use the exact result that was queried. Each subsequent request verifies the account and selection again, including at the end of export generation. CSV/Excel reuse the report exporter and its formula escaping. Exports omit Faculty IDs and protected AFC details.

## Permissions and limits

- The same ADFA/Developer base roles may read several permitted Faculty and choose whether to include inactive records. Faculty, HICC and VISC are scoped to their own linked Faculty. ADC and LAB access stays excluded.
- Teaching topic, course and authenticated scheduling evidence are kept within that scope. AFC reasons, medical information, original private notes, DOE, UCID and contact details do not leave the projection.
- Bounded calendar comparisons cover up to 31 inclusive days. Open-ended queries preserve the existing ongoing/upcoming behavior for Summary and Agenda. Use a bounded query for Timeline and common time.
- Each query supports up to 500 Faculty, 15,000 records and a bounded result size. The API returns a partial state or asks the user to narrow the scope when it cannot return complete results. Partial pages cannot certify no conflicts or generate a complete export.
- Snapshots expire after 10 minutes and may be evicted sooner by a new query for the same account, use by several concurrent accounts or an API restart. A new query reads SQL again. Other calendar systems are outside PAWS coverage.
- Common time shows up to 200 ranked matches. The count includes other qualifying windows. General roster and date selection does not apply an activity-type filter to conflict detection. The activity-type filter applies to Agenda.

## Test and rollout

- Unit and lifecycle suites cover cutoffs and adjacency, cross-day intervals, Calgary clock changes, source uncertainty, authorization, duplicate records, date validation, partial pages, view reuse, export and identity changes.
- Faculty Availability SQL Acceptance loads a labeled disposable SQL instance, checks legacy route parity and the available/unavailable/partial-time source rules, then measures 150 Faculty over 31 days. The log reports SQL-read samples, application query and page timings, and common-time timings. Treat those as measurements of the synthetic fixture.
- The immutable release candidate must pass the Beta build and SQL Acceptance against the same reviewed head. Browser acceptance should exercise the same synthetic data on desktop and mobile, with keyboard interaction and both themes.
- After Owner authorization, verify the migration prerequisites and existing read role, apply only 072 and record the installed definition and EXECUTE grant. Run exact-main CI and deploy the matching University API and Hosting artifacts under the normal release procedure. Check authorized ADFA and Faculty reads and scope denial in the live browser.
- For rollback, restore the previous Hosting and University API releases first. Then an authorized operator can run `rollback_072_faculty_availability_bulk_read.sql` with the installed definition hash. It will refuse unexpected definitions or grants. The rollback drops the new procedure and preserves the legacy endpoint and business data.
