'use strict';

// Firestore Testing release readiness is distinct from green SQL/legacy Beta CI.
// The completed modules below are read-only: no SQL-backed capability may be
// advertised as a working Firestore feature until its own implementation and
// authenticated emulator/browser acceptance are proven.
const { loadConfig, sameSiteCandidate } = require('../render-environment-config');
const { testingFixtures } = require('./firestore-seed');

const REQUIRED = Object.freeze({
  calendar: ['GET /api/v1/sessions','POST /api/v1/sessions','PATCH /api/v1/sessions/:id',
    'POST /api/v1/sessions/batch','PATCH /api/v1/sessions/:id/assignments'],
  faculty: ['GET /api/v1/dashboard/summary','GET /api/v1/dashboard/faculty',
    'GET /api/v1/dashboard/faculty/:id','PATCH /api/v1/dashboard/faculty/:id',
    'GET /api/v1/dashboard/teaching-summary','GET /api/v1/dashboard/roles',
    'PUT /api/v1/dashboard/roles/:id/periods'],
  doe: ['GET /api/v1/dashboard/doe-overview','GET /api/v1/doe/policy',
    'GET /api/v1/doe/worksheet','GET /api/v1/doe/worksheets','POST /api/v1/doe/recalculate',
    'POST /api/v1/doe/assignments'],
  afc: ['GET /api/v1/dashboard/afc-records','POST /api/v1/dashboard/afc-records',
    'GET /api/v1/afc-requests','POST /api/v1/afc-forms'],
  teachingAssignments: ['GET /api/v1/teaching-assignments/work-queue',
    'GET /api/v1/teaching-assignments/packages/:id',
    'POST /api/v1/teaching-assignments/packages/:id/draft',
    'POST /api/v1/teaching-assignments/packages/:id/submit',
    'POST /api/v1/teaching-assignments/packages/:id/reviews',
    'POST /api/v1/teaching-assignments/publications'],
  calendarActivities: ['GET /api/v1/calendar-activities','GET /api/v1/calendar-activities/capabilities',
    'POST /api/v1/calendar-activity-imports','POST /api/v1/calendar-activity-imports/:id/commit'],
  ccc: ['GET /api/v1/ccc-schedule','POST /api/v1/ccc-replacements',
    'POST /api/v1/ccc-replacements/:id/commit'],
  administration: ['GET /api/v1/me','GET /api/v1/dashboard/leadership-directory',
    'GET /api/v1/change-history','GET /api/v1/reports/catalog','POST /api/v1/reports/query',
    'GET /api/v1/scheduling-tasks','GET /api/v1/support','POST /api/v1/support/start']
});

// Keep this list conservative and synchronize additions with emulator API tests.
// A listed route is only source-implemented, never proof of live acceptance.
const SOURCE_IMPLEMENTED = new Set([
  'GET /api/v1/me','GET /api/v1/sessions','PATCH /api/v1/sessions/:id', // explicit Testing-only write gate, default off
  'GET /api/v1/dashboard/summary',
  'GET /api/v1/dashboard/faculty','GET /api/v1/dashboard/faculty/:id',
  'GET /api/v1/dashboard/teaching-summary','GET /api/v1/dashboard/roles',
  'GET /api/v1/dashboard/leadership-directory','GET /api/v1/ccc-schedule',
  'GET /api/v1/calendar-activities','GET /api/v1/calendar-activities/capabilities'
]);

function assessFirestoreTestingReadiness({ production = loadConfig('production'), testing = loadConfig('testing'), liveEvidence = null } = {}) {
  const groups = Object.entries(REQUIRED).map(([name,routes]) => {
    const missing = routes.filter(route=>!SOURCE_IMPLEMENTED.has(route));
    return { name, implemented: routes.length-missing.length, required: routes.length, missing };
  });
  const fixtures = testingFixtures();
  const counts = Object.fromEntries([...new Set(fixtures.map(row=>row.collection))].sort().map(name =>
    [name, fixtures.filter(row=>row.collection===name).length]));
  const blockers = [];
  if (!sameSiteCandidate(production,testing)) blockers.push('SAME_SITE_CONFIG_UNPROVISIONED');
  if (groups.some(x=>x.missing.length)) blockers.push('FIRESTORE_BACKEND_NOT_FEATURE_COMPLETE');
  if (!fixtures.length || fixtures.some(x=>x.data.synthetic!==true)) blockers.push('SYNTHETIC_FIXTURE_INVALID');
  // A green PR or emulator run is not an authenticated deployment receipt.
  if (liveEvidence?.browserUatPassed !== true || liveEvidence?.adminAccountVerified !== true ||
      liveEvidence?.productionIsolationPassed !== true || liveEvidence?.privacyRulesPassed !== true ||
      liveEvidence?.firestoreBackendDeployed !== true || liveEvidence?.sameSiteAuthDomainVerified !== true) {
    blockers.push('LIVE_ADMIN_BROWSER_ISOLATION_AND_PRIVACY_UAT_MISSING');
  }
  return { ready:blockers.length===0, backend:'firestore', environment:'testing', requiredRoutes:groups.reduce((n,x)=>n+x.required,0),
    implementedRoutes:groups.reduce((n,x)=>n+x.implemented,0), groups, fixtures:counts, blockers };
}

if (require.main===module) {
  const argv=process.argv.slice(2);
  if (argv.some(arg=>!['--assert','--report'].includes(arg))) throw Error('Unknown readiness option');
  const report=assessFirestoreTestingReadiness();
  console.log(JSON.stringify(report,null,2));
  if (argv.includes('--assert') && !report.ready) process.exitCode=1;
}
module.exports={ REQUIRED, SOURCE_IMPLEMENTED, assessFirestoreTestingReadiness };
