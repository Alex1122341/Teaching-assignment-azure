'use strict';
// Inventory of the minimum user-visible API families for a COMPLETE PAWS Testing
// release. Source coverage is evidence of implementation only, NOT live acceptance.
// Run: node tools/testing/feature-readiness.js [--strict]
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const client = fs.readFileSync(path.join(root, 'frontend/scripts/paws-data-client.js'), 'utf8');
const runtime = fs.readFileSync(path.join(__dirname, 'firestore-read-runtime.js'), 'utf8');
const http = fs.readFileSync(path.join(__dirname, 'firestore-http.js'), 'utf8');
const groups = Object.freeze([
  ['Identity', '/api/v1/me', 'GET'],
  ['Timetable', '/api/v1/sessions', 'GET'],
  ['Session editing', '/api/v1/sessions/', 'PATCH'],
  ['Faculty Dashboard', '/api/v1/dashboard/faculty', 'GET'],
  ['Faculty write', '/api/v1/dashboard/faculty', 'PATCH'],
  ['DOE policies', '/api/v1/doe/policies', 'GET'],
  ['DOE assignment', '/api/v1/doe/assignments', 'POST'],
  ['AFC records', '/api/v1/dashboard/afc-records', 'GET'],
  ['AFC requests', '/api/v1/afc-requests', 'GET'],
  ['AFC approval', '/api/v1/afc-requests', 'POST'],
  ['AFC documents', '/api/v1/afc-forms', 'GET'],
  ['CCC', '/api/v1/ccc-schedule', 'GET'],
  ['CCC replacement', '/api/v1/ccc-replacements', 'POST'],
  ['Calendar activities', '/api/v1/calendar-activities', 'GET'],
  ['Calendar imports', '/api/v1/calendar-activity-imports', 'POST'],
  ['Teaching assignments', '/api/v1/teaching-assignments', 'GET'],
  ['Roles and responsibilities', '/api/v1/dashboard/roles', 'GET'],
  ['Leadership list', '/api/v1/dashboard/leadership-directory', 'GET'],
  ['Scheduling tasks', '/api/v1/scheduling-tasks', 'GET'],
  ['Reports', '/api/v1/reports', 'GET'],
  ['Change history', '/api/v1/change-history', 'GET'],
  ['Support personas', '/api/v1/support', 'POST']
]);
function inspect() {
  return groups.map(([feature, endpoint, method]) => {
    const frontend = client.includes(endpoint);
    // These are ONLY heuristic indicators; dynamic paths and handlers may
    // be represented by constants. Never mark a route as accepted on this basis.
    const backendReference = runtime.includes(endpoint) || http.includes(endpoint);
    return { feature, endpoint, method, frontendReferenced: frontend,
      testingRuntimeReferenced: backendReference,
      accepted: false, acceptance: 'REQUIRES_AUTHENTICATED_LIVE_UAT' };
  });
}
function main() {
  const features = inspect();
  const missing = features.filter(row => !row.testingRuntimeReferenced);
  const result = { releaseReady: false, sourceOnly: true,
    total: features.length, missingRuntimeReferences: missing.length,
    note: 'No endpoint is considered accepted without authenticated Testing UAT, writes, isolation and persistence checks.',
    features };
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (process.argv.includes('--strict') && missing.length) process.exitCode = 1;
}
if (require.main === module) main();
module.exports = { inspect };
