'use strict';

// BETA-R4D-10A — Dashboard HTTP surface.
//
// Kept separate from the existing timetable wrapper so the reviewed timetable
// runtime stays untouched. Both wrappers are mounted by the same Functions app.
//
// Contract:
//   * GET only. Every other method on a known Dashboard path returns 405 with an
//     explicit `Allow: GET` header, never 404.
//   * Unauthenticated requests return 401; the API layer decides that, this
//     wrapper only extracts the bearer token.
//   * Unknown paths return 404.

const DASHBOARD_PREFIX = '/api/v1/dashboard/';

function bearer(request) {
  const header = request.headers && request.headers.get
    ? request.headers.get('authorization')
    : null;
  return header && /^Bearer /i.test(header) ? header.slice(7) : '';
}

function createDashboardFunctions({ api }) {
  return async request => {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname.replace(/\/+$/, '') || '/';

      if (!pathname.startsWith(DASHBOARD_PREFIX.replace(/\/$/, ''))) {
        return { status: 404, jsonBody: { error: { code: 'NOT_FOUND', message: 'Route not found.' } } };
      }

      if (request.method !== 'GET') {
        return {
          status: 405,
          headers: { Allow: 'GET' },
          jsonBody: { error: { code: 'METHOD_NOT_ALLOWED', message: 'GET required.' } }
        };
      }

      const token = bearer(request);
      const academicYear = url.searchParams.get('academicYear');

      if (pathname === '/api/v1/dashboard/summary') {
        const response = await api.summary(token, { academicYear });
        return { status: response.status, jsonBody: response.body };
      }

      if (pathname === '/api/v1/dashboard/faculty') {
        const limit = url.searchParams.get('limit');
        const response = await api.faculty(token, {
          academicYear,
          search: url.searchParams.get('search'),
          limit: limit === null ? undefined : Number(limit)
        });
        return { status: response.status, jsonBody: response.body };
      }

      if (pathname === '/api/v1/dashboard/teaching-summary') {
        const response = await api.teachingSummary(token, { academicYear });
        return { status: response.status, jsonBody: response.body };
      }

      if (pathname === '/api/v1/dashboard/roles') {
        const response = await api.roles(token, { academicYear });
        return { status: response.status, jsonBody: response.body };
      }

      if (pathname === '/api/v1/dashboard/doe-overview') {
        const response = await api.doeOverview(token, { academicYear });
        return { status: response.status, jsonBody: response.body };
      }

      const match = /^\/api\/v1\/dashboard\/faculty\/([^/]+)$/.exec(pathname);
      if (match) {
        let facultyId;
        try {
          facultyId = decodeURIComponent(match[1]);
        } catch (_) {
          return { status: 400, jsonBody: { error: { code: 'INVALID_FACULTY_ID', message: 'Faculty id is not a valid identifier.' } } };
        }
        const response = await api.facultyById(token, facultyId, { academicYear });
        return { status: response.status, jsonBody: response.body };
      }

      return { status: 404, jsonBody: { error: { code: 'NOT_FOUND', message: 'Route not found.' } } };
    } catch (_) {
      return {
        status: 503,
        jsonBody: { error: { code: 'SERVICE_UNAVAILABLE', message: 'The service is temporarily unavailable.' } }
      };
    }
  };
}

module.exports = { createDashboardFunctions, DASHBOARD_PREFIX };
