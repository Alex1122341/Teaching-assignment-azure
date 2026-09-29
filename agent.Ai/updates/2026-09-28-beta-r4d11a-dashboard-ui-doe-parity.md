# BETA-R4D-11A — Dashboard UI parity + DOE evidence

Date: 2026-09-28  
Repository: `Alex1122341/Teaching-assignment-azure`  
Branch: `feature/beta-r4d11a-dashboard-ui-doe-parity`  
Base: `6adf40cd8cd89a915e23bcd505d0e3110f91b2e4`

## Delivered

- Added `dashboard-view-model.js` for deterministic curriculum-year/course/session
  grouping and stored DOE summaries.
- Added administrator-only GET routes for Teaching Summary, Roles &
  Appointments, and DOE Overview. SQL aggregation remains read-only and keeps
  null, zero, negative, and override semantics explicit.
- Added lazy client methods and restored the four read-only Dashboard tabs.
- Restored rich faculty detail sections: DOE Summary, Teaching / Courses,
  Roles & Appointments, Away from Campus, Professional Profile, joint
  appointments, identity metadata, and Identity.
- Added self-service rendering scoped to the linked FacultyId; no cross-faculty
  detail requests are possible from the UI.

## Verification

- Server tests: 102/102 pass.
- R4D-11A focused frontend tests: view model 4/4, client 11/11, parity UI 4/4,
  DOE regression 4/4, role-policy runtime checks pass.
- JavaScript syntax checks and `git diff --check` pass.
- Firestore/legacy dependency scan is clean for Dashboard HTML, controller,
  client, and view model.
- `node tools/beta-freeze.js` reports only the intentional protected runtime
  drift in `faculty-admin.html`, `faculty-admin.js`, and `paws-data-client.js`;
  no baseline promotion was performed.

## Safety boundary

No Azure resource, SQL, Firebase, Firestore, SWA, deployment, merge, or PR
operation was performed. The branch is ready for Architect review; it is not
ready for deployment or merge until that review and the repository's normal
release gates complete.
