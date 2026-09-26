'use strict';
// Single shared Beta authorization policy for the Azure SQL read runtime.
//
// Both GET /api/v1/me and GET /api/v1/sessions MUST consume the same validated
// profile result. Role rules are never duplicated per endpoint.
//
// Authorization sequence:
//   valid Firebase token -> matching paws.UserProfile -> Active == true
//   -> role is supported -> faculty-shaped roles require FacultyId
//   -> authorized profile
//
// other_office is retired for the SQL runtime and is deliberately absent from
// SUPPORTED_ROLES, so it fails closed on every endpoint with no bypass.
const SUPPORTED_ROLES = new Set(['owner', 'administrator', 'adfa_general', 'adfa_regular', 'admin', 'faculty', 'hicc', 'visc', 'editor', 'viewer']);

// Beta compatibility maps editor -> faculty and viewer -> faculty, so all five
// of these roles are Faculty-scoped and must never receive a global read.
const FACULTY_SHAPED_ROLES = new Set(['faculty', 'hicc', 'visc', 'editor', 'viewer']);

const result = (status, body) => ({ status, body });
const text = value => (value === null || value === undefined ? '' : String(value).trim());
function validDate(v) { return /^\d{4}-\d{2}-\d{2}$/.test(v || '') && !Number.isNaN(Date.parse(v + 'T00:00:00Z')); }

// The one profile policy. Returns a validated descriptor, or a result() denial.
function validateAuthorizedProfile(profile) {
 if (!profile || profile.active !== true) return result(403, { error: { code: 'PROFILE_REQUIRED', message: 'An active SQL user profile is required.' } });
 const role = text(profile.baseRole).toLowerCase();
 if (!SUPPORTED_ROLES.has(role)) return result(403, { error: { code: 'ROLE_DENIED', message: 'This role cannot read SQL timetable data.' } });
 const facultyShaped = FACULTY_SHAPED_ROLES.has(role);
 const facultyId = text(profile.facultyId);
 if (facultyShaped && !facultyId) return result(403, { error: { code: 'FACULTY_LINK_REQUIRED', message: 'A linked faculty profile is required.' } });
 // Administrative roles keep their unscoped global read; faculty-shaped roles are always scoped.
 return { profile, role, facultyShaped, facultyId: facultyShaped ? facultyId : null };
}

function createDataApi({ verifyToken, findUser, listSessions, health = async () => true }) {
 async function authorize(token) {
  let decoded;
  try { decoded = await verifyToken(token); } catch (_) { return result(401, { error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } }); }
  let profile;
  try { profile = await findUser(decoded.uid); } catch (_) { return result(503, { error: { code: 'SERVICE_UNAVAILABLE', message: 'The SQL read service is temporarily unavailable.' } }); }
  const validated = validateAuthorizedProfile(profile);
  if (validated.status) return validated;
  return { decoded, ...validated };
 }
 return {
  async health() {
   try { await health(); return result(200, { status: 'ok', service: 'paws-beta-sql-runtime' }); } catch (_) { return result(503, { error: { code: 'SQL_UNAVAILABLE', message: 'The SQL read service is unavailable.' } }); }
  },
  async currentUser(token) {
   const auth = await authorize(token);
   if (auth.status) return auth;
   return result(200, { profile: { displayName: auth.profile.displayName, role: auth.profile.baseRole, facultyId: auth.profile.facultyId || null } });
  },
  async sessions(token, range) {
   if (!validDate(range.start) || !validDate(range.end) || range.start >= range.end) return result(400, { error: { code: 'INVALID_RANGE', message: 'A valid bounded date range is required.' } });
   const days = (Date.parse(range.end) - Date.parse(range.start)) / 86400000;
   if (days > 93) return result(400, { error: { code: 'INVALID_RANGE', message: 'Date range may not exceed 93 days.' } });
   const auth = await authorize(token);
   if (auth.status) return auth;
   try { return result(200, { sessions: await listSessions({ start: range.start, end: range.end, facultyId: auth.facultyId }) }); } catch (_) { return result(503, { error: { code: 'SQL_UNAVAILABLE', message: 'The SQL read service is unavailable.' } }); }
  }
 };
}
module.exports = { createDataApi, validateAuthorizedProfile, SUPPORTED_ROLES, FACULTY_SHAPED_ROLES };
