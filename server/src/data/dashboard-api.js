'use strict';

// BETA-R4D-10A2 — read-only Dashboard API.
//
// Authorization model (server-side, authoritative):
//
//   administrator roles : owner, administrator, adfa_general, adfa_regular, admin
//   self-service roles  : faculty, hicc, visc
//   denied              : viewer, other_office (retired), any unsupported role
//
// Endpoint contract:
//
//   GET /dashboard/summary          administrators only; self-service => 403
//   GET /dashboard/faculty          administrators: full active roster
//                                   self-service  : exactly ONE row (own FacultyId)
//   GET /dashboard/faculty/:id      administrators: any faculty
//                                   self-service  : own FacultyId only, else 403
//
// A faculty-scoped caller without a linked FacultyId is refused with
// 403 FACULTY_LINK_REQUIRED before any SQL read happens. Scope is enforced by a
// server-side predicate, never by hiding fields in the UI.

const { InvalidAcademicYearError, resolveAcademicYear } = require('./academic-year');

const ADMIN_ROLES = new Set(['owner', 'administrator', 'adfa_general', 'adfa_regular', 'admin']);
const SELF_SERVICE_ROLES = new Set(['faculty', 'hicc', 'visc']);
const DASHBOARD_ROLES = new Set([...ADMIN_ROLES, ...SELF_SERVICE_ROLES]);

const result = (status, body) => ({ status, body });
const error = (status, code, message) => result(status, { error: { code, message } });
const text = value => (value === null || value === undefined ? '' : String(value).trim());

function roleOf(profile) {
  return text(profile && profile.baseRole).toLowerCase();
}

function isAdministrator(role) {
  return ADMIN_ROLES.has(role);
}

function isSelfService(role) {
  return SELF_SERVICE_ROLES.has(role);
}

// Resolves the caller's Dashboard scope. Returns either a denial `result` or an
// authorization descriptor.
function resolveScope(profile) {
  if (!profile || profile.active !== true) {
    return error(403, 'PROFILE_REQUIRED', 'An active SQL user profile is required.');
  }
  if (profile.mustChangePassword === true) {
    return error(403, 'PASSWORD_CHANGE_REQUIRED', 'Password change is required before Dashboard access.');
  }

  const role = roleOf(profile);
  if (!DASHBOARD_ROLES.has(role)) {
    return error(403, 'ROLE_DENIED', 'This role cannot read Dashboard data.');
  }

  if (isAdministrator(role)) {
    return { role, administrator: true, facultyScoped: false, facultyId: null };
  }

  const facultyId = text(profile.facultyId);
  if (!facultyId) {
    return error(403, 'FACULTY_LINK_REQUIRED', 'A linked faculty profile is required.');
  }
  return { role, administrator: false, facultyScoped: true, facultyId };
}

// Resolves the effective academic year for a request query parameter. An
// explicitly supplied malformed value is a 400; an omitted value defaults.
function resolveYear(value) {
  const raw = value === null || value === undefined ? '' : String(value).trim();
  if (!raw) return { year: resolveAcademicYear(undefined) };
  try {
    return { year: resolveAcademicYear(raw) };
  } catch (caught) {
    if (caught instanceof InvalidAcademicYearError) {
      return { error: error(400, 'INVALID_ACADEMIC_YEAR', `Academic year '${raw}' is not a recognised academic year.`) };
    }
    throw caught;
  }
}

function createDashboardApi({ verifyToken, findUser, repository }) {
  async function authorize(token) {
    let decoded;
    try {
      decoded = await verifyToken(token);
    } catch (_) {
      return error(401, 'UNAUTHENTICATED', 'Authentication required.');
    }

    let profile;
    try {
      profile = await findUser(decoded.uid);
    } catch (_) {
      return error(503, 'SERVICE_UNAVAILABLE', 'The SQL read service is temporarily unavailable.');
    }

    const scope = resolveScope(profile);
    if (scope.status) return scope;
    return { decoded, profile, scope };
  }

  async function guarded(token, run) {
    const auth = await authorize(token);
    if (auth.status) return auth;
    try {
      return await run(auth.scope);
    } catch (_) {
      return error(503, 'SQL_UNAVAILABLE', 'The SQL read service is unavailable.');
    }
  }

  return {
    // GET /api/v1/dashboard/summary — administrators only.
    async summary(token, { academicYear: year } = {}) {
      const resolved = resolveYear(year);
      if (resolved.error) return resolved.error;
      return guarded(token, scope => {
        if (!scope.administrator) {
          return error(403, 'ROLE_DENIED', 'This role cannot read the Dashboard summary.');
        }
        return repository
          .summary({ academicYear: resolved.year })
          .then(summary => result(200, { summary }));
      });
    },

    // GET /api/v1/dashboard/faculty
    // Administrators receive the full active roster. A faculty-scoped caller is
    // narrowed by its own FacultyId to exactly one row rather than denied.
    async faculty(token, { academicYear: year, search, limit } = {}) {
      const resolved = resolveYear(year);
      if (resolved.error) return resolved.error;
      return guarded(token, scope => repository
        .faculty({
          academicYear: resolved.year,
          search,
          limit,
          facultyId: scope.facultyScoped ? scope.facultyId : null
        })
        .then(faculty => result(200, { faculty, count: faculty.length })));
    },

    // GET /api/v1/dashboard/faculty/:facultyId
    // A faculty-scoped caller may read only its own record; any other id is
    // refused with 403 rather than 404 so the response never confirms that an
    // unrelated FacultyId exists.
    async facultyById(token, facultyId, { academicYear: year } = {}) {
      const resolved = resolveYear(year);
      if (resolved.error) return resolved.error;
      return guarded(token, scope => {
        if (scope.facultyScoped && text(facultyId).toLowerCase() !== scope.facultyId.toLowerCase()) {
          return error(403, 'ROLE_DENIED', 'This role cannot read another faculty record.');
        }
        return repository
          .facultyById({ facultyId, academicYear: resolved.year })
          .then(record => (record
            ? result(200, record)
            : error(404, 'FACULTY_NOT_FOUND', 'Faculty record not found.')));
      });
    }
  };
}

module.exports = {
  createDashboardApi,
  resolveScope,
  resolveYear,
  ADMIN_ROLES,
  SELF_SERVICE_ROLES,
  DASHBOARD_ROLES
};
