'use strict';

const { randomUUID } = require('node:crypto');

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
const AFC_REASON_LABELS = Object.freeze({
  university_travel: 'University Travel',
  vacation: 'Vacation',
  rsl: 'RSL',
  medical: 'Medical',
  mat: 'MAT',
  special: 'Special',
  other: 'Other'
});
const AFC_REASON_CODES = new Set(Object.keys(AFC_REASON_LABELS));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function validUuid(value) {
  return typeof value === 'string' && UUID.test(value.trim());
}

function strictDate(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw ? null : raw;
}

function validateAfcInput(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return error(400, 'INVALID_JSON', 'AFC request JSON must be an object.');
  }
  const facultyId = text(payload.facultyId);
  if (!validUuid(facultyId)) return error(400, 'INVALID_FACULTY_ID', 'Faculty id is not a valid identifier.');
  const startDate = strictDate(payload.startDate);
  const endDate = strictDate(payload.endDate);
  if (!startDate || !endDate) return error(400, 'INVALID_DATE', 'AFC dates must use YYYY-MM-DD calendar dates.');
  if (endDate < startDate) return error(400, 'INVALID_DATE_RANGE', 'End date must be on or after start date.');
  const reasonCode = text(payload.reasonCode);
  if (!AFC_REASON_CODES.has(reasonCode)) return error(400, 'INVALID_REASON', 'Reason is not recognised.');
  const notes = payload.notes === null || payload.notes === undefined ? null : String(payload.notes).trim();
  if (notes && notes.length > 1000) return error(400, 'NOTES_TOO_LONG', 'Notes must be 1000 characters or fewer.');
  if ((reasonCode === 'special' || reasonCode === 'other') && !notes) {
    return error(400, 'NOTES_REQUIRED', 'Notes are required for Special and Other.');
  }
  return { facultyId, startDate, endDate, reasonCode, notes: notes || null };
}

function normalizeAfcRecord(row = {}) {
  const reasonCode = text(row.reasonCode);
  return {
    afcRecordId: row.afcRecordId,
    facultyId: row.facultyId,
    facultyName: text(row.facultyName),
    startDate: text(row.startDate),
    endDate: text(row.endDate),
    reasonCode: reasonCode || null,
    reason: text(row.reason) || (reasonCode ? AFC_REASON_LABELS[reasonCode] || null : null),
    notes: row.notes === null || row.notes === undefined ? null : text(row.notes),
    legacyPurpose: row.legacyPurpose === null || row.legacyPurpose === undefined ? null : text(row.legacyPurpose),
    active: row.active !== false && row.active !== 0,
    sourceKind: text(row.sourceKind) || 'manual'
  };
}

function mapAfcWriteError(caught) {
  const number = Number(caught && caught.number);
  const known = {
    51205: ['INVALID_DATE', 'AFC dates are required.'],
    51206: ['INVALID_DATE_RANGE', 'End date must be on or after start date.'],
    51207: ['INVALID_REASON', 'Reason is not recognised.'],
    51208: ['NOTES_REQUIRED', 'Notes are required for Special and Other.'],
    51209: ['NOTES_TOO_LONG', 'Notes must be 1000 characters or fewer.'],
    51210: ['FACULTY_NOT_FOUND', 'Active Faculty record was not found.']
  }[number];
  if (known) return error(number === 51210 ? 404 : 400, known[0], known[1]);
  if (caught && caught.code === 'FACULTY_NOT_FOUND') return error(404, 'FACULTY_NOT_FOUND', 'Active Faculty record was not found.');
  return error(503, 'SQL_UNAVAILABLE', 'The SQL write service is unavailable.');
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

function createDashboardApi({ verifyToken, findUser, repository, writeRepository = repository }) {
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
    },

    // Administrator-only read aggregates used by the restored Dashboard tabs.
    async teachingSummary(token, { academicYear: year } = {}) {
      const resolved = resolveYear(year);
      if (resolved.error) return resolved.error;
      return guarded(token, scope => {
        if (!scope.administrator) return error(403, 'ROLE_DENIED', 'This role cannot read the Dashboard teaching summary.');
        return repository.teachingSummary({ academicYear: resolved.year })
          .then(teachingSummary => result(200, { academicYear: resolved.year, teachingSummary }));
      });
    },

    async roles(token, { academicYear: year } = {}) {
      const resolved = resolveYear(year);
      if (resolved.error) return resolved.error;
      return guarded(token, scope => {
        if (!scope.administrator) return error(403, 'ROLE_DENIED', 'This role cannot read the Dashboard roles.');
        return repository.roles({ academicYear: resolved.year })
          .then(roles => result(200, { academicYear: resolved.year, roles }));
      });
    },

    async doeOverview(token, { academicYear: year } = {}) {
      const resolved = resolveYear(year);
      if (resolved.error) return resolved.error;
      return guarded(token, scope => {
        if (!scope.administrator) return error(403, 'ROLE_DENIED', 'This role cannot read the Dashboard DOE overview.');
        return repository.doeOverview({ academicYear: resolved.year })
          .then(doeOverview => result(200, { doeOverview }));
      });
    },

    // GET /api/v1/dashboard/doe-targets — administrator-only contract DOE data.
    async doeTargets(token, { academicYear: year } = {}) {
      const resolved = resolveYear(year);
      if (resolved.error) return resolved.error;
      return guarded(token, scope => {
        if (!scope.administrator) return error(403, 'ROLE_DENIED', 'This role cannot read DOE target data.');
        return repository.doeTargets({ academicYear: resolved.year })
          .then(doeTargets => result(200, {
            academicYear: resolved.year,
            doeTargets,
            count: doeTargets.length
          }));
      });
    },

    // GET /api/v1/dashboard/afc-records — administrators only. Imported and
    // manual rows are returned one-for-one from the unified SQL view.
    async afcRecords(token, { search, reason, active, limit } = {}) {
      return guarded(token, scope => {
        if (!scope.administrator) return error(403, 'ROLE_DENIED', 'This role cannot read administrator AFC records.');
        return repository.listAfcRecords({ search, reason, active, limit })
          .then(records => result(200, { afcRecords: records.map(normalizeAfcRecord), count: records.length }));
      });
    },

    // POST /api/v1/dashboard/afc-records — administrators only. Identity and
    // request IDs are deliberately generated after server-side authorization.
    async createAfcRecord(token, payload) {
      const auth = await authorize(token);
      if (auth.status) return auth;
      if (!auth.scope.administrator) return error(403, 'ROLE_DENIED', 'This role cannot create AFC records.');
      const input = validateAfcInput(payload);
      if (input.status) return input;
      try {
        const row = await writeRepository.createAfcRecord({
          ...input,
          afcRecordId: randomUUID(),
          requestId: randomUUID(),
          actorFirebaseUid: auth.decoded.uid,
          actorName: auth.profile.displayName
        });
        if (!row) return error(503, 'SQL_UNAVAILABLE', 'The SQL write service is unavailable.');
        return result(201, { afcRecord: normalizeAfcRecord(row) });
      } catch (caught) {
        return mapAfcWriteError(caught);
      }
    }
  };
}

module.exports = {
  createDashboardApi,
  resolveScope,
  resolveYear,
  ADMIN_ROLES,
  SELF_SERVICE_ROLES,
  DASHBOARD_ROLES,
  AFC_REASON_LABELS,
  AFC_REASON_CODES,
  validateAfcInput,
  normalizeAfcRecord,
  strictDate
};
