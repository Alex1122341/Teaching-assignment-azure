'use strict';

// Synthetic-only, bounded Firestore Dashboard read adapter. Authorization and
// Faculty row-level scope are enforced by the existing PAWS Dashboard API.
// This reader cannot access shared lab collections or perform writes.
const names = require('../../server/src/domain/person-name');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FACULTY_FIELDS = ['synthetic','facultyId','firstName','lastName','displayName','email','rank','stream','fte','active','academicYear'];
const SESSION_FIELDS = ['synthetic','academicYear','facultyIds','start','end','timeUnknown'];
const ROLE_FIELDS = ['synthetic','academicYear','roleType','courseCode','recordedScope','facultyFirstName','facultyLastName','facultyKey','effectiveDate','expirationDate','hasSchedule'];
const MAX_FACULTY = 500, MAX_SESSIONS = 10000, MAX_ROLES = 1000;
const own = (db, name) => db.collection('paws_testing_' + name);

function createLabDashboardReader({ db } = {}) {
  if (!db || db.projectId !== 'vista-teaching-lab' || db.databaseId !== '(default)' || typeof db.collection !== 'function') {
    throw new Error('Testing Firestore project rejected');
  }

  async function all(name, fields, limit) {
    const snapshot = await own(db, name).select(...fields).limit(limit + 1).get();
    if (!Array.isArray(snapshot.docs) || snapshot.docs.length > limit) throw new Error('Testing Dashboard collection limit exceeded');
    return snapshot.docs.map(doc => {
      const data = doc.data();
      if (!data || data.synthetic !== true) throw new Error('Non-synthetic Testing Dashboard document rejected');
      return { id: doc.id, ...data };
    });
  }
  const facultyRow = row => ({
    facultyId: row.facultyId,
    displayName: names.format({ firstName: row.firstName, lastName: row.lastName, name: row.displayName }),
    firstName: row.firstName || null, lastName: row.lastName || null,
    email: row.email || null, rank: row.rank || null, stream: row.stream || null,
    fte: row.fte ?? null, active: row.active === true, recordType: 'faculty'
  });
  const validYear = year => typeof year === 'string' && /^\d{4}-\d{2}$/.test(year);
  const matches = (row, year) => !row.academicYear || row.academicYear === year;

  async function faculty({ academicYear = '2026-27', search = null, limit = null, status = 'active', facultyId = null } = {}) {
    if (!validYear(academicYear) || !['active','inactive','all'].includes(status)) throw new Error('Invalid Testing Dashboard filter');
    if (facultyId !== null && (!UUID.test(facultyId) || status !== 'active')) throw new Error('Invalid Testing Faculty scope');
    const max = limit == null ? MAX_FACULTY : Number(limit);
    if (!Number.isInteger(max) || max < 1 || max > MAX_FACULTY) throw new Error('Invalid Testing Faculty limit');
    const query = String(search || '').trim().toLowerCase().slice(0,100);
    // Never scan the whole roster when a Faculty user asks for their own row.
    // The PAWS Dashboard API has already checked the actor's canonical scope.
    let rows;
    if (facultyId) {
      const snapshot = await own(db, 'faculty').doc(facultyId).get();
      if (!snapshot.exists) rows = [];
      else {
        const data = snapshot.data();
        if (!data || data.synthetic !== true || data.facultyId !== facultyId) throw Error('Testing Faculty scope rejected');
        rows = [data];
      }
    } else rows = await all('faculty', FACULTY_FIELDS, MAX_FACULTY);
    return rows.filter(row => matches(row,academicYear) &&
      (!facultyId || row.facultyId === facultyId) &&
      (status === 'all' || (row.active === true) === (status === 'active')) &&
      (!query || String([row.displayName,row.firstName,row.lastName,row.rank,row.stream].join(' ')).toLowerCase().includes(query)))
      .map(facultyRow).sort((a,b)=>a.displayName.localeCompare(b.displayName)||a.facultyId.localeCompare(b.facultyId)).slice(0,max);
  }

  async function facultyById({ facultyId, academicYear = '2026-27', includeInactive = false } = {}) {
    if (!UUID.test(facultyId || '') || !validYear(academicYear)) return null;
    const snapshot = await own(db, 'faculty').doc(facultyId).get();
    if (!snapshot.exists) return null;
    const row = snapshot.data();
    if (!row || row.synthetic !== true) throw Error('Non-synthetic Testing Faculty record rejected');
    if (!matches(row,academicYear) || !includeInactive && row.active !== true) return null;
    return { faculty: facultyRow(row), linkedRecords: {} };
  }

  async function summary({ academicYear = '2026-27' } = {}) {
    if (!validYear(academicYear)) throw Error('Invalid Testing academic year');
    const [facultyRows, sessionRows] = await Promise.all([all('faculty',FACULTY_FIELDS,MAX_FACULTY), all('sessions',SESSION_FIELDS,MAX_SESSIONS)]);
    const group = facultyRows.filter(row => matches(row,academicYear));
    const schedule = sessionRows.filter(row => row.academicYear === academicYear);
    return { academicYear, facultyCount: group.length, activeFacultyCount: group.filter(x=>x.active===true).length,
      sessionCount: schedule.length, assignedSessionCount: schedule.filter(row=>Array.isArray(row.facultyIds)&&row.facultyIds.length>0).length };
  }

  async function teachingSummary({ academicYear = '2026-27' } = {}) {
    if (!validYear(academicYear)) throw Error('Invalid Testing academic year');
    const [facultyRows, sessionRows] = await Promise.all([faculty({ academicYear, status:'all' }),all('sessions',SESSION_FIELDS,MAX_SESSIONS)]);
    const totals = new Map(facultyRows.map(row=>[row.facultyId,0]));
    for (const row of sessionRows) if (row.academicYear === academicYear && Array.isArray(row.facultyIds)) {
      for (const id of new Set(row.facultyIds)) if (totals.has(id)) totals.set(id,totals.get(id)+1);
    }
    return facultyRows.map(row=>({ facultyId: row.facultyId, displayName:row.displayName, sessionCount: totals.get(row.facultyId), academicYear }));
  }

  async function roles({ academicYear = '2026-27' } = {}) {
    if (!validYear(academicYear)) throw Error('Invalid Testing academic year');
    const rows = await all('leadership',ROLE_FIELDS,MAX_ROLES);
    return rows.filter(row=>matches(row,academicYear)).map(row=>({
      roleAssignmentId: row.id, roleType: row.roleType, facultyId: row.facultyKey,
      displayName: names.format({firstName: row.facultyFirstName,lastName:row.facultyLastName}),
      courseOrSubjectOrRotation: row.courseCode || row.recordedScope || '',
      courseCode: row.courseCode || null,
      effectiveDate: row.effectiveDate || null, expirationDate: row.expirationDate || null,
      active: true, academicYear
    }));
  }

  return Object.freeze({ summary, faculty, facultyById, teachingSummary, roles });
}
module.exports = { createLabDashboardReader };
