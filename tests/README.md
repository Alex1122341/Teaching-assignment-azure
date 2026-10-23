# Regression test map

The test filenames are organized by domain prefixes. The test runner remains `npm test` (`tests/*.test.js`); do not move test files without updating the runner.

| Prefix / group | Responsibility |
| --- | --- |
| afc-*, calendar-*, ccc-* | Absence, working activities and CCC UI/API clients |
| faculty-*, doe-*, trainee-* | Dashboard, identity, DOE, availability and supervision |
| timetable-*, scheduling-*, selected-schedule-* | Calendar, assignments, tasks and exports |
| b2*, login-*, password-*, session-* | Authentication, continuity and browser performance |
| *-emulator.test.js | Auth/Firestore rules with isolated demo projects |
| beta-*, *-governance.test.js | Immutable release provenance and historical protection |
| repository-layout, static-bundle, hosting-boundary, runtime-assets | Source organization and unchanged public packaging |

Frontend module imports target `frontend/scripts`. Source-contract reads use the explicit `repositoryPath` helper, not filesystem monkey-patching. Historical Git snapshots retain their recorded original paths. Security skips or unavailable infrastructure must be reported, never relabeled as passed.
