'use strict';
// Testing-only repository. Callers must authorize the user and provide the
// corresponding Faculty scope before invoking this reader.
const names = require('../../server/src/domain/person-name');
const MAX_ROWS = 10000;
const PUBLIC_FIELDS = ['academicYear', 'year', 'course', 'courseName', 'topic', 'type', 'date', 'start', 'end', 'timeUnknown', 'room', 'instructor', 'instructorNames'];
const text = value => typeof value === 'string' ? value : '';

function createLabCalendarReader({ db } = {}) {
  if (!db || db.projectId !== 'vista-teaching-lab' || typeof db.collection !== 'function') throw new Error('Testing Firestore project rejected');
  return async function list({ start = null, end = null, facultyId = null, includeAssignmentTargets = false } = {}) {
    if ((start === null) !== (end === null) || (start !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start >= end))) throw new Error('Invalid calendar range');
    if (facultyId !== null && (typeof facultyId !== 'string' || !facultyId.trim())) throw new Error('Invalid Faculty scope');
    if (facultyId !== null && includeAssignmentTargets) throw new Error('Faculty cannot request assignment targets');
    let query = db.collection('sessions');
    if (facultyId !== null) query = query.where('facultyIds', 'array-contains', facultyId);
    if (start !== null) query = query.where('date', '>=', start).where('date', '<', end);
    query = query.select(...PUBLIC_FIELDS, ...(includeAssignmentTargets ? ['assignments'] : [])).limit(MAX_ROWS + 1);
    const snapshot = await query.get();
    if (snapshot.docs.length > MAX_ROWS) throw new Error('Testing calendar limit exceeded');
    return snapshot.docs.map(doc => {
      const data = doc.data();
      const assignments = includeAssignmentTargets && Array.isArray(data.assignments) ? data.assignments : [];
      const allowed = assignments.filter(item => item && typeof item.facultyId === 'string' && item.facultyId).map(item => ({
        facultyId: item.facultyId,
        teachingRole: text(item.role) || null,
        displayName: names.format(item),
        active: typeof item.active === 'boolean' ? item.active : null
      }));
      const instructors = Array.isArray(data.instructorNames) ? data.instructorNames.map(name => names.format(name)).filter(Boolean).join('; ') : names.formatList(text(data.instructor));
      return {
        id: doc.id, academicYear: text(data.academicYear), curriculumYear: data.year ?? null,
        courseCode: text(data.course), courseName: text(data.courseName), topic: text(data.topic),
        sessionType: text(data.type), date: text(data.date),
        startTime: data.timeUnknown === true ? null : text(data.start) || null,
        endTime: data.timeUnknown === true ? null : text(data.end) || null,
        room: text(data.room), instructorNames: instructors,
        assignmentsJson: JSON.stringify(allowed),
        unresolvedAssignmentCount: includeAssignmentTargets ? assignments.length - allowed.length : 0
      };
    }).sort((a, b) => a.date.localeCompare(b.date) || String(a.startTime || '').localeCompare(String(b.startTime || '')) || a.id.localeCompare(b.id));
  };
}
module.exports = { createLabCalendarReader };
