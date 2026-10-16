# PAWS Beta Workflows — current 2026-10-15

Source state: Beta main 0d4b4d9, documented deployed API/Hosting ca465bf (Oct14). Historical BETA-R1 workflows are not the current runtime.

## 1. Authenticate and authorize a business read/write

~~~text
Firebase Hosting browser
  -> Firebase Authentication login / ID token
  -> HTTPS to temporary Cloudflare ingress
  -> University Node API validates token and Firebase project
  -> SELECT paws.UserProfile by verified FirebaseUid
  -> check Active / MustChangePassword / supported BaseRole / linked FacultyId
  -> resolve server-side role + Faculty/Responsibility scope
  -> check domain permission, precise SQL role and exact-true write gate
  -> scoped SQL view or transactional paws_api stored procedure
  -> data/result/audit returned to browser
~~~

No token or invalid token: 401; unauthorized account/scope: 403; unavailable SQL: fail closed/503; disabled write gate: WRITE_DISABLED. No Firestore business fallback. Browser input, custom claims and UI hide do not authorize SQL.

## 2. Timetable and SessionAssignment

- Authorized users read approved scoped SQL Session and calendar projections. Administrators may edit/create/batch sessions and replace assignment sets only with the corresponding exact-true gate and SQL procedure authorization.
- A Session is a single scheduled activity; SessionAssignment contains one row per Faculty allocation. Time and DOE credit require independent source facts.
- Guard revisions, assignment uniqueness, academic year, date/time, ownership and audit. Keep source uncertainty visibly Needs Review; do not invent a start/end time or group.
- Faculty self scope is an exact SQL FacultyId association. The timetable is not a permission bypass to other Faculty confidential profile data.

## 3. HICC / VISC / ADFAD Teaching Assignment

~~~text
ADC / LAB / HICC scoped contribution suggestions
  -> HICC working package Draft (stable HICC responsibility and group)
  -> HICC Submit pins current working revision
  -> VISC group-lead Review
       -> Push Back: changes_requested -> HICC revise/resubmit
       -> Approve: visc_approved revision
  -> HICC Final Submit (only current approved revision)
  -> ADFAD final Faculty allocation (SessionAssignment authority)
  -> Separate authorized Publish of immutable academic-year release
  -> Faculty reads active published release only
~~~

Revision checks prevent stale approval/replay. Stable responsibility is not person, role label, Session Topic or Firestore faculty_groups. Publishing is not a side effect of final assignment and is independently gated.

## 4. AFC

~~~text
Faculty/HICC/VISC own AFC request + attestation/signature
  -> optional configured Reports To / approval review
  -> authorized approve/reject/withdraw
  -> immutable approved artifact
  -> availability projection (Available/Unavailable for other faculty)
~~~

Administrator may create one/batch manual AFC records and cancel one exact active record. Oct14 release enabled AFC cancellation with a version token and audit; cancellation sets Active=false and retains source/history, **never hard deletes**. SQL036/037 and rollback acceptance were completed. Live UI confirmed controls only (no real create/cancel). Reviewer mapping must be genuinely configured; don't invent reviewers or make approval status claims from UI alone.

## 5. Session SWAP / change requests

~~~text
Authorized current session and candidate discovery
  -> choose replacement or time/topic/room change
  -> capture source snapshot + revision + available candidates
  -> submit/revise/withdraw
  -> required office review; approve / reject / push back
  -> revalidate source, time, current assignments, availability and approval
  -> apply once via SQL procedure + audit
  -> optionally request DOE recalculation from the independent DOE domain
~~~

Released Oct09; browsing the form/inbox was accepted, **real live final approval/application not demonstrated**. Candidate authority and approval routes must not be guessed where actual ADC/LAB/VISC reviewer accounts are missing. Draft #99 adds administrative DOE + availability preview; not in main or live.

## 6. DOE lifecycle and Worksheet

~~~text
Authoritative source facts / Master + Guidelines
  -> create or reuse Draft annual Rule Book
  -> Save Draft with expected revision and source provenance
  -> Validate rules, selectors, mappings, exceptions and policy checksum
  -> full, consistent Impact Preview with source fingerprint and zero unresolved projections
  -> General/Developer authorization + policyPublish gate
  -> Explicit atomic Publish into annual Active policy
  -> separate, gated global Recalculate only when authorized
  -> versioned DoeCalculationRecord + Faculty Worksheet with source labels
~~~

- Last documented 2026-27 candidate is Draft revision2 (58 rules, 56 course mappings, 25 subject groups, 25 exceptions). Its 5282-record zero-delta preview is **not** proof of actual Active policy publication.
- Worksheet separates Scheduled Teaching, Roles, raw/applied Supervision, manual Adjustments; Target is approved contract or explicit override; remaining = target - total applied. Missing source produces Needs Review.
- Approved signed manual DOE values, including negative negotiated reductions, enter once after reserve; role effective dates never imply daily/monthly automatic proration.
- DOE formulas and percentages are in agent.Ai/ALGORITHMS.md; source code remains authoritative.

## 7. Role appointment dates

Up to 12 inclusive, nonoverlapping appointment periods per role; null end means open-ended. Current-as-of Active/Inactive display is not the Faculty account Active flag and is not DOE proration. Save has expected rowversion and SQL audit, controlled by administrator facultyAdmin gate.

## 8. LAB grouping, tasks, developer support

- LAB detail groups already-authorized LAB/SRL sessions by real course/date/year and displays unsegmented source time and instructor rows. Missing group rotation/roster remains unavailable.
- Tasks published Oct09: scoped across all weeks, highlight unpositioned/quality schedule sessions and SWAP requests. Full collision detection is unmerged Draft #100.
- Developer Support: actual developer identity -> 30-minute scoped target session, immutable capture/audit -> Undo only when unchanged afterimage matches. No credentials/account-management or PDF artifact actions; live write/Undo still untested.

## 9. Data migrations and releases

Source workbook -> hash/validate/source lineage -> bounded stage/preview -> exact identity reconciliation -> reviewed SQL transaction -> recovery receipt -> separately authorized activation. The original empty-DB import was completed earlier and must **not** be rerun. Proposed Calendar working activity/AFC source deletion in unmerged #98 requires a narrow service identity and separate destructive-data authorization, not just a PR.

Release: feature branch -> independent review -> protected product/governance freeze promotion -> PR CI -> authorized merge -> exact-main CI -> reviewed SQL/API cutover -> Firebase Hosting-only deploy -> authenticated browser+API+SQL acceptance -> dated agent.Ai update. CI PASS never means deployed. Never move owner-approved enabled DOE gates to false simply to satisfy a stale Hosting workflow.

## 10. Future integrations, not implemented

Microsoft Graph Outlook invites/updates and D2L Brightspace Calendar/content updates are architectural proposals only. They need university app registrations, exact course/faculty/event mappings, constrained permissions, idempotent event IDs and approval/retry workflows. CSV/ICS export is not automatic synchronization.
