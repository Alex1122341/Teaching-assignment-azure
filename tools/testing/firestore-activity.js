'use strict';

// Testing-only activity reader. The active profile is checked again here
// because the SQL implementation also enforces the actor scope in its store.
const { validateAuthorizedProfile } = require('../../server/src/data/data-api');
const { isAdministratorRole } = require('../../server/src/auth/role-policy');
const names = require('../../server/src/domain/person-name');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ROWS = 10000;
const MAX_KEYS = 500;
const FIELDS = ['synthetic', 'activityId', 'facultyId', 'facultyDisplayName', 'category', 'label', 'startDate', 'endDate', 'courseCode', 'timeStatus', 'version', 'staffingKind', 'staffingLabel', 'blockLabel', 'timeEvidence'];
const error = (message, number) => Object.assign(new Error(message), { number });
const validDate = value => typeof value === 'string' && DATE.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

function createLabActivityReader({ db, findUser } = {}) {
  if (!db || db.projectId !== 'vista-teaching-lab' || db.databaseId !== '(default)' || typeof db.collection !== 'function' || typeof findUser !== 'function') throw Error('Testing Firestore project rejected');
  return async function list({ actorFirebaseUid, start, end, facultyKey = null, category = null, cursor = null, limit = 100, includeFacultyKeys = false } = {}) {
    const validated = validateAuthorizedProfile(await findUser(actorFirebaseUid));
    if (validated.status) throw error('Activity scope rejected', 53801);
    const admin = isAdministratorRole(validated.role);
    const own = validated.facultyScoped ? String(validated.profile.facultyId || '').toLowerCase() : null;
    if (own !== null && !UUID.test(own) || includeFacultyKeys && !admin) throw error('Activity scope rejected', 53801);
    if (!validDate(start) || !validDate(end) || start >= end || (Date.parse(end) - Date.parse(start)) / 86400000 > 550 || !Number.isInteger(limit) || limit < 1 || limit > 100 || facultyKey !== null && !UUID.test(facultyKey)) throw error('Activity query rejected', 53802);
    const keys = await db.collection('paws_testing_activity_keys').select('synthetic', 'facultyId', 'facultyKey', 'active').limit(MAX_KEYS + 1).get();
    if (keys.docs.length > MAX_KEYS) throw Error('Testing activity mapping limit exceeded');
    const byId = new Map(), byKey = new Map();
    for (const doc of keys.docs) {
      const row = doc.data();
      if (row.synthetic !== true) throw Error('Non-synthetic Testing activity mapping rejected');
      if (!UUID.test(row.facultyId || '') || !UUID.test(row.facultyKey || '') || typeof row.active !== 'boolean') throw Error('Invalid Testing activity mapping');
      const id = row.facultyId.toLowerCase(), key = row.facultyKey.toLowerCase();
      if (byId.has(id) || byKey.has(key)) throw Error('Duplicate Testing activity mapping');
      byId.set(id, { id, key, active: row.active }); byKey.set(key, id);
    }
    for (const key of byKey.keys()) if (byId.has(key)) throw Error('Testing activity mapping is not opaque');
    let filter = facultyKey === null ? null : byKey.get(facultyKey.toLowerCase());
    if (facultyKey !== null && !filter) throw error('Activity key not found', 53803);
    if (own !== null && filter !== null && filter !== own) throw error('Activity scope rejected', 53801);
    if (own !== null) filter = own;
    let query = db.collection('paws_testing_calendar_activities');
    if (filter !== null) query = query.where('facultyId', '==', filter);
    const snapshot = await query.select(...FIELDS).limit(MAX_ROWS + 1).get();
    if (snapshot.docs.length > MAX_ROWS) throw Error('Testing activity limit exceeded');
    const rows = [];
    for (const doc of snapshot.docs) {
      const row = doc.data();
      if (row.synthetic !== true) throw Error('Non-synthetic Testing activity rejected');
      if (!UUID.test(row.activityId || '') || !validDate(row.startDate) || !validDate(row.endDate) || row.startDate > row.endDate) throw Error('Invalid Testing activity');
      const person = typeof row.facultyId === 'string' ? byId.get(row.facultyId.toLowerCase()) : null;
      const unassigned = row.staffingKind === 'unassigned' && row.category === 'ccc' && row.staffingLabel === 'Locum' && row.facultyId == null;
      if (!unassigned && !person) throw Error('Testing activity mapping missing');
      if (person && !person.active) continue;
      if (filter !== null && (!person || person.id !== filter)) throw error('Activity scope rejected', 53801);
      if (row.startDate >= end || row.endDate < start || category && row.category !== category) continue;
      const position = row.startDate + '|' + row.activityId.toLowerCase();
      if (cursor !== null && position <= cursor.toLowerCase()) continue;
      rows.push({ activityId: row.activityId.toLowerCase(), facultyKey: person?.key ?? null,
        facultyDisplayName: unassigned ? 'Locum' : names.format(row.facultyDisplayName), category: row.category,
        label: row.label, startDate: row.startDate, endDate: row.endDate, courseCode: row.courseCode ?? null,
        timeStatus: row.timeStatus, version: row.version, staffingKind: row.staffingKind ?? 'assigned',
        staffingLabel: row.staffingLabel ?? null, blockLabel: row.blockLabel ?? null,
        timeEvidence: Array.isArray(row.timeEvidence) ? row.timeEvidence.map(t => ({ date: t.date, startTime: t.startTime, endTime: t.endTime })) : [] });
    }
    rows.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.activityId.localeCompare(b.activityId));
    const page = rows.slice(0, limit), last = page.at(-1);
    const current = validateAuthorizedProfile(await findUser(actorFirebaseUid));
    if (current.status || current.role !== validated.role || current.facultyScoped !== validated.facultyScoped || String(current.profile.facultyId || '').toLowerCase() !== String(validated.profile.facultyId || '').toLowerCase()) throw error('Activity scope changed', 53801);
    return { activities: page, nextCursor: rows.length > limit ? last.startDate + '|' + last.activityId : null,
      ...(includeFacultyKeys ? { facultyKeys: [...byId.values()].filter(x => x.active).sort((a, b) => a.id.localeCompare(b.id)).map(x => ({ facultyId: x.id, facultyKey: x.key })) } : {}) };
  };
}
module.exports = { createLabActivityReader };
