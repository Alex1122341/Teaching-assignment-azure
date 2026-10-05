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
const SESSION_EDIT_ROLES = new Set(['owner', 'administrator', 'adfa_general', 'adfa_regular', 'admin']);
const SESSION_TYPES = new Set(['LEC', 'LAB', 'SRL', 'Quiz/Midterm', 'OSCE', 'Exam']);
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION_EDIT_FIELDS = new Set(['date', 'startTime', 'endTime', 'courseCode', 'sessionType', 'topic', 'room']);

const result = (status, body) => ({ status, body });
const text = value => (value === null || value === undefined ? '' : String(value).trim());
const SESSION_EDIT_SQL_ERRORS = new Map([
  [51242, { status: 400, code: 'INVALID_SESSION_VALUES', message: 'The session values are invalid.' }],
  [51243, { status: 400, code: 'COURSE_NOT_FOUND', message: 'The course code was not found.' }],
  [51244, { status: 409, code: 'SESSION_ACADEMIC_YEAR_INVALID', message: 'The session academic year is invalid.' }],
  [51245, { status: 400, code: 'SESSION_DATE_OUTSIDE_ACADEMIC_YEAR', message: 'The date does not match the session academic year.' }],
  [51246, { status: 409, code: 'DUPLICATE_SESSION_CONFLICT', message: 'The edit conflicts with an existing session.' }]
]);
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') &&
  !Number.isNaN(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;

function validateSessionEdit(sessionId, patch) {
  if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) return 'INVALID_SESSION_ID';
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return 'INVALID_SESSION_PATCH';
  const keys = Object.keys(patch);
  if (!keys.length || keys.some(key => !SESSION_EDIT_FIELDS.has(key))) return 'UNSUPPORTED_SESSION_FIELDS';
  if (Object.prototype.hasOwnProperty.call(patch, 'date') && !validDate(patch.date)) return 'INVALID_SESSION_DATE';
  const hasStart = Object.prototype.hasOwnProperty.call(patch, 'startTime');
  const hasEnd = Object.prototype.hasOwnProperty.call(patch, 'endTime');
  if (hasStart !== hasEnd) return 'INVALID_SESSION_INTERVAL';
  if (hasStart) {
    const { startTime: start, endTime: end } = patch;
    if (start === null || end === null) {
      if (start !== null || end !== null) return 'INVALID_SESSION_INTERVAL';
    } else if (typeof start !== 'string' || typeof end !== 'string' ||
      !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(start) ||
      !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(end) || start >= end) {
      return 'INVALID_SESSION_INTERVAL';
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'courseCode') &&
      (typeof patch.courseCode !== 'string' || !patch.courseCode.trim() || patch.courseCode.trim().length > 32)) return 'INVALID_COURSE_CODE';
  if (Object.prototype.hasOwnProperty.call(patch, 'sessionType') && !SESSION_TYPES.has(patch.sessionType)) return 'INVALID_SESSION_TYPE';
  if (Object.prototype.hasOwnProperty.call(patch, 'topic') && patch.topic !== null && typeof patch.topic !== 'string') return 'INVALID_SESSION_TOPIC';
  if (Object.prototype.hasOwnProperty.call(patch, 'room') && patch.room !== null && typeof patch.room !== 'string') return 'INVALID_SESSION_ROOM';
  if (patch.topic != null && patch.topic.length > 4000) return 'INVALID_SESSION_TOPIC';
  if (patch.room != null && patch.room.length > 256) return 'INVALID_SESSION_ROOM';
  return null;
}

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

function createDataApi({ verifyToken, findUser, listSessions, updateSession = async () => null, health = async () => true }) {
  async function authorize(token, timing) {
    let decoded;
    const verifyStarted = timing ? timing.start('firebase_verify') : null;
    try {
      decoded = await verifyToken(token);
    } catch (_) {
      return result(401, { error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } });
    } finally {
      if (timing) timing.end('firebase_verify', verifyStarted);
    }
    if (timing) timing.markEligible();

    let profile;
    try {
      profile = await findUser(decoded.uid, timing);
    } catch (_) {
      return result(503, { error: { code: 'SERVICE_UNAVAILABLE', message: 'The SQL read service is temporarily unavailable.' } });
    }

    let validated;
    const validationStarted = timing ? timing.start('profile_validate') : null;
    try {
      validated = validateAuthorizedProfile(profile);
    } finally {
      if (timing) timing.end('profile_validate', validationStarted);
    }
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

    async currentUser(token, timing) {
      const totalStarted = timing ? timing.start('me_total') : null;
      try {
        const auth = await authorize(token, timing);
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
      } finally {
        if (timing) timing.end('me_total', totalStarted);
      }
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
    ,
    async updateExistingSession(token, sessionId, patch) {
      const auth = await authorize(token);
      if (auth.status) return auth;
      if (!SESSION_EDIT_ROLES.has(auth.role)) {
        return result(403, { error: { code: 'ROLE_DENIED', message: 'This role cannot edit canonical timetable sessions.' } });
      }
      const invalid = validateSessionEdit(sessionId, patch);
      if (invalid) return result(400, { error: { code: invalid, message: 'The session edit is invalid.' } });
      try {
        const session = await updateSession({ sessionId, patch, actorFirebaseUid: auth.decoded.uid, actorName: text(auth.profile.displayName) || null });
        return session
          ? result(200, { session })
          : result(404, { error: { code: 'SESSION_NOT_FOUND', message: 'The timetable session was not found.' } });
      } catch (error) {
        const sqlNumber = Number(error?.number ?? error?.originalError?.info?.number);
        const known = SESSION_EDIT_SQL_ERRORS.get(sqlNumber);
        if (known) return result(known.status, { error: { code: known.code, message: known.message } });
        return result(503, { error: { code: 'SQL_UNAVAILABLE', message: 'The SQL write service is temporarily unavailable.' } });
      }
    }
  };
}

module.exports = {
  createDataApi,
  validateAuthorizedProfile,
  SUPPORTED_ROLES,
  FACULTY_SCOPED_ROLES,
  normalizedRange,
  validateSessionEdit,
  SESSION_EDIT_ROLES
};
