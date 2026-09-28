'use strict';

// BETA-R4D-10A — read-only Dashboard API.
//
// Authorization model (server-side, authoritative):
//
//   administrator roles : owner, administrator, adfa_general, adfa_regular, admin
//   self-service roles  : faculty, hicc, visc
//   denied              : viewer  (and any role not listed above)
//
// `other_office` is deliberately NOT introduced in this change.
//
// A faculty-scoped caller (faculty/hicc/visc) without a linked FacultyId is
// refused with 403 FACULTY_LINK_REQUIRED before any SQL read happens. The scope
// is enforced by a server-side predicate, never by hiding fields in the UI.

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
    // GET /api/v1/dashboard/summary
    async summary(token, { academicYear: year } = {}) {
      return guarded(token, scope => repository
        .summary({ academicYear: year, facultyId: scope.facultyScoped ? scope.facultyId : null })
        .then(summary => result(200, { summary })));
    },

    // GET /api/v1/dashboard/faculty
    // Administrator-only. A faculty-scoped caller is denied outright rather
    // than being silently rewritten to its own record.
    async faculty(token, { academicYear: year, search, limit } = {}) {
      return guarded(token, scope => {
        if (!scope.administrator) {
          return error(403, 'ROLE_DENIED', 'This role cannot read the faculty roster.');
        }
        return repository
          .faculty({ academicYear: year, search, limit })
          .then(faculty => result(200, { faculty, count: faculty.length }));
      });
    },

    // GET /api/v1/dashboard/faculty/:facultyId
    // A faculty-scoped caller may read only its own record; any other id is
    // refused with 403 rather than 404 so the response never confirms that an
    // unrelated FacultyId exists.
    async facultyById(token, facultyId, { academicYear: year } = {}) {
      return guarded(token, scope => {
        if (scope.facultyScoped && text(facultyId).toLowerCase() !== scope.facultyId.toLowerCase()) {
          return error(403, 'ROLE_DENIED', 'This role cannot read another faculty record.');
        }
        return repository
          .facultyById({ facultyId, academicYear: year })
          .then(record => (record
            ? result(200, { faculty: record })
            : error(404, 'FACULTY_NOT_FOUND', 'Faculty record not found.')));
      });
    }
  };
}

module.exports = {
  createDashboardApi,
  resolveScope,
  ADMIN_ROLES,
  SELF_SERVICE_ROLES,
  DASHBOARD_ROLES
};
