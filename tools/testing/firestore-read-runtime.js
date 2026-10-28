'use strict';
// Unpublished Testing-only read slice. All other routes stay unavailable.
const { createFirebaseSqlAuth } = require('../../server/src/auth/firebase-sql-auth');
const { createDataApi } = require('../../server/src/data/data-api');
const { createSwaFunctions } = require('../../server/src/runtime/swa-functions');
const { createLabProfileReader } = require('./firestore-profile');
const { createLabCalendarReader } = require('./firestore-calendar');
const { createLabLeadershipReader } = require('./firestore-leadership');
const { createLeadershipDirectoryApi } = require('../../server/src/roles/leadership-directory-api');
const { createLeadershipDirectoryFunctions, PATH: LEADERSHIP_PATH } = require('../../server/src/runtime/swa-leadership-directory-functions');
const { createLabCccReader } = require('./firestore-ccc');
const { createCccScheduleApi } = require('../../server/src/ccc/ccc-schedule-api');
const { createCccScheduleFunctions } = require('../../server/src/runtime/swa-ccc-schedule-functions');
const CCC_PATH = '/api/v1/ccc-schedule';
const { createLabActivityReader } = require('./firestore-activity');
const { createCalendarActivityApi } = require('../../server/src/calendar/calendar-activity-api');
const { createCalendarActivityFunctions } = require('../../server/src/runtime/swa-calendar-activity-functions');
const ACTIVITY_PATH = '/api/v1/calendar-activities';
const { createLabDashboardReader } = require('./firestore-dashboard');
const { createDashboardApi } = require('../../server/src/data/dashboard-api');
const { createDashboardFunctions } = require('../../server/src/runtime/swa-dashboard-functions');
const { createLabSessionWrites } = require('./firestore-session-writes');
const DASHBOARD_PATHS = new Set(['/api/v1/dashboard/summary', '/api/v1/dashboard/faculty',
  '/api/v1/dashboard/teaching-summary', '/api/v1/dashboard/roles',
  '/api/v1/dashboard/faculty-admin/write-capabilities']);

function createLabReadRuntime({ db, verifyIdToken, enableSessionWrites = false, sessionWriter = null } = {}) {
  if (typeof verifyIdToken !== 'function') throw new Error('Firebase token verification is required');
  if (typeof enableSessionWrites !== 'boolean') throw Error('Invalid Testing write policy');
  const findUser = createLabProfileReader({ db });
  const listSessions = createLabCalendarReader({ db });
  const verifyToken = createFirebaseSqlAuth({ verifyIdToken, expectedProjectId: 'paws-testing-ucvm-20261022' });
  const writer = enableSessionWrites ? (sessionWriter || createLabSessionWrites({ db })) : null;
  if (enableSessionWrites && typeof writer?.updateSession !== 'function') throw Error('Missing trusted Testing session writer');
  const route = createSwaFunctions({ api: createDataApi({ verifyToken, findUser, listSessions,
    ...(writer ? { updateSession: writer.updateSession.bind(writer) } : {}),
    writeGates: enableSessionWrites ? { sessionEdit: true } : {} }) });
  const leadership = createLeadershipDirectoryFunctions({ api: createLeadershipDirectoryApi({ verifyToken, findUser, repository: { list: createLabLeadershipReader({ db }) } }) });
  const ccc = createCccScheduleFunctions({ api: createCccScheduleApi({ verifyToken, findUser, repository: { list: createLabCccReader({ db }) } }) });
  const activities = createCalendarActivityFunctions({ api: createCalendarActivityApi({ verifyToken, findUser, repository: { list: createLabActivityReader({ db, findUser }) }, writeGates: {} }) });
  const dashboard = createDashboardFunctions({ api: createDashboardApi({ verifyToken, findUser, repository: createLabDashboardReader({ db }), writeGates: {} }) });
  return async request => {
    const path = new URL(request.url).pathname;
    const isDashboard = DASHBOARD_PATHS.has(path) || /^\/api\/v1\/dashboard\/faculty\/[0-9a-f-]{36}$/i.test(path);
    const sessionEdit = /^\/api\/v1\/sessions\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(path);
    if (!isDashboard && !sessionEdit && !['/api/v1/me', '/api/v1/sessions', LEADERSHIP_PATH, CCC_PATH, ACTIVITY_PATH, ACTIVITY_PATH + '/capabilities'].includes(path)) return { status: 404, jsonBody: { error: { code: 'NOT_FOUND', message: 'Route not available.' } } };
    if (request.method !== 'GET' && !(sessionEdit && enableSessionWrites && request.method === 'PATCH')) return { status: 405, jsonBody: { error: { code: 'METHOD_NOT_ALLOWED', message: 'GET required.' } } };
    const result = await (isDashboard ? dashboard(request) : path === LEADERSHIP_PATH ? leadership(request) : path === CCC_PATH ? ccc(request) : path === ACTIVITY_PATH || path === ACTIVITY_PATH + '/capabilities' ? activities(request) : route(request));
    if (result.status === 503) return { status: 503, jsonBody: { error: { code: 'SERVICE_UNAVAILABLE', message: 'The Testing service is temporarily unavailable.' } } };
    if (path === '/api/v1/me' && result.status === 200) result.jsonBody.environment = { name: 'testing', testing: true };
    return result;
  };
}
module.exports = { createLabReadRuntime };
