'use strict';

const SUPPORTED_ROLES = new Set([
  'owner',
  'administrator',
  'adfa_general',
  'adfa_regular',
  'admin',
  'faculty',
  'hicc',
  'visc',
  'viewer'
]);

// Only roles that represent a canonical Faculty person are Faculty-scoped.
// The two current Beta viewer accounts are office/test accounts (DVM/LAB) and
// deliberately remain non-Faculty; they must not be forced through a fuzzy
// Faculty match.
const FACULTY_SCOPED_ROLES = new Set(['faculty', 'hicc', 'visc']);

const result = (status, body) => ({ status, body });
const text = value => (value === null || value === undefined ? '' : String(value).trim());
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') &&
  !Number.isNaN(Date.parse(value + 'T00:00:00Z'));

function validateAuthorizedProfile(profile) {
  if (!profile || profile.active !== true) {
    return result(403, { error: { code: 'PROFILE_REQUIRED', message: 'An active SQL user profile is required.' } });
  }
  if (profile.mustChangePassword === true) {
    return result(403, { error: { code: 'PASSWORD_CHANGE_REQUIRED', message: 'Password change is required before timetable access.' } });
  }
  const role = text(profile.baseRole).toLowerCase();
  if (!SUPPORTED_ROLES.has(role)) {
    return result(403, { error: { code: 'ROLE_DENIED', message: 'This role cannot read SQL timetable data.' } });
  }
  const facultyScoped = FACULTY_SCOPED_ROLES.has(role);
  const facultyId = text(profile.facultyId);
  if (facultyScoped && !facultyId) {
    return result(403, { error: { code: 'FACULTY_LINK_REQUIRED', message: 'A linked faculty profile is required.' } });
  }
  return { profile, role, facultyScoped, facultyId: facultyScoped ? facultyId : null };
}

function normalizedRange(range = {}) {
  const start = text(range.start);
  const end = text(range.end);
  if (!start && !end) return { start: null, end: null };
  if (!validDate(start) || !validDate(end) || start >= end) return null;
  const days = (Date.parse(end) - Date.parse(start)) / 86400000;
  if (days > 550) return null;
  return { start, end };
}

function createDataApi({ verifyToken, findUser, listSessions, health = async () => true }) {
  async function authorize(token) {
    let decoded;
    try {
      decoded = await verifyToken(token);
    } catch (_) {
      return result(401, { error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } });
    }

    let profile;
    try {
      profile = await findUser(decoded.uid);
    } catch (_) {
      return result(503, { error: { code: 'SERVICE_UNAVAILABLE', message: 'The SQL read service is temporarily unavailable.' } });
    }

    const validated = validateAuthorizedProfile(profile);
    if (validated.status) return validated;
    return { decoded, ...validated };
  }

  return {
    async health() {
      try {
        await health();
        return result(200, { status: 'ok', service: 'paws-beta-sql-runtime' });
      } catch (_) {
        return result(503, { error: { code: 'SQL_UNAVAILABLE', message: 'The SQL read service is unavailable.' } });
      }
    },

    async currentUser(token) {
      const auth = await authorize(token);
      if (auth.status) return auth;
      return result(200, {
        profile: {
          displayName: auth.profile.displayName,
          role: auth.profile.baseRole,
          facultyId: auth.profile.facultyId || null,
          active: true,
          mustChangePassword: false
        }
      });
    },

    async sessions(token, range) {
      const auth = await authorize(token);
      if (auth.status) return auth;

      const normalized = normalizedRange(range);
      if (!normalized) {
        return result(400, { error: { code: 'INVALID_RANGE', message: 'Provide both start and end dates, or neither, within the Beta academic-year window.' } });
      }

      try {
        const sessions = await listSessions({
          start: normalized.start,
          end: normalized.end,
          facultyId: auth.facultyId
        });
        return result(200, { sessions });
      } catch (_) {
        return result(503, { error: { code: 'SQL_UNAVAILABLE', message: 'The SQL read service is unavailable.' } });
      }
    }
  };
}

module.exports = {
  createDataApi,
  validateAuthorizedProfile,
  SUPPORTED_ROLES,
  FACULTY_SCOPED_ROLES,
  normalizedRange
};
