'use strict';
// Unpublished Testing-only read slice. All other routes stay unavailable.
const { createFirebaseSqlAuth } = require('../../server/src/auth/firebase-sql-auth');
const { createDataApi } = require('../../server/src/data/data-api');
const { createSwaFunctions } = require('../../server/src/runtime/swa-functions');
const { createLabProfileReader } = require('./firestore-profile');
const { createLabCalendarReader } = require('./firestore-calendar');

function createLabReadRuntime({ db, verifyIdToken } = {}) {
  if (typeof verifyIdToken !== 'function') throw new Error('Firebase token verification is required');
  const findUser = createLabProfileReader({ db });
  const listSessions = createLabCalendarReader({ db });
  const verifyToken = createFirebaseSqlAuth({ verifyIdToken, expectedProjectId: 'paws-testing-ucvm-20261022' });
  const route = createSwaFunctions({ api: createDataApi({ verifyToken, findUser, listSessions, writeGates: {} }) });
  return async request => {
    const path = new URL(request.url).pathname;
    if (!['/api/v1/me', '/api/v1/sessions'].includes(path)) return { status: 404, jsonBody: { error: { code: 'NOT_FOUND', message: 'Route not available.' } } };
    if (request.method !== 'GET') return { status: 405, jsonBody: { error: { code: 'METHOD_NOT_ALLOWED', message: 'GET required.' } } };
    const result = await route(request);
    if (result.status === 503) return { status: 503, jsonBody: { error: { code: 'SERVICE_UNAVAILABLE', message: 'The Testing service is temporarily unavailable.' } } };
    if (path === '/api/v1/me' && result.status === 200) result.jsonBody.environment = { name: 'testing', testing: true };
    return result;
  };
}
module.exports = { createLabReadRuntime };
