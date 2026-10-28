'use strict';

// Transactional, Testing-only Session edit adapter. The canonical PAWS data
// API verifies Firebase Auth, active role, allowed fields and the sessionEdit
// write gate before this function is called. No Production repository is used.
const { randomUUID } = require('node:crypto');
const names = require('../../server/src/domain/person-name');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELDS = Object.freeze({ date:'date',startTime:'start',endTime:'end',courseCode:'course',sessionType:'type',topic:'topic',room:'room' });
const fail = (number, message) => Object.assign(new Error(message), { number });
const validYearDate = (year, date) => {
  const match = /^(\d{4})-(\d{2})$/.exec(year || '');
  if (!match || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const start=Number(match[1]);
  return Number(match[2]) === ((start+1)%100) &&
    date >= match[1]+'-05-01' && date < String(start+1)+'-05-01';
};
const time = value => typeof value === 'string' ? value : '';
const duplicate = (a,b) => a.course.toLowerCase()===b.course.toLowerCase() &&
  a.type===b.type && a.date===b.date &&
  a.start===b.start && a.end===b.end &&
  String(a.topic||'').trim().toLowerCase()===String(b.topic||'').trim().toLowerCase();

function createLabSessionWrites({ db } = {}) {
  if (!db || db.projectId!=='vista-teaching-lab' || db.databaseId!=='(default)' ||
      typeof db.collection!=='function' || typeof db.runTransaction!=='function') {
    throw new Error('Testing Firestore project rejected');
  }
  return Object.freeze({
    async updateSession({sessionId,patch,actorFirebaseUid,actorName}={}){
      if (!UUID.test(sessionId||'') || !patch || typeof patch!=='object' || Array.isArray(patch) ||
          !Object.keys(patch).length || Object.keys(patch).some(k=>!Object.hasOwn(FIELDS,k)) ||
          typeof actorFirebaseUid!=='string' || !actorFirebaseUid.trim()) {
        throw fail(51242,'Invalid synthetic session edit');
      }
      const sessions=db.collection('paws_testing_sessions');
      const target=sessions.doc(sessionId);
      const audit=db.collection('paws_testing_audit').doc(randomUUID());
      return db.runTransaction(async tx=>{
        const snapshot=await tx.get(target);
        if (!snapshot.exists) return null;
        const existing=snapshot.data();
        if (existing?.synthetic!==true || existing.academicYear==null) throw Error('Non-synthetic session rejected');
        const updated={...existing};
        for(const [key,value] of Object.entries(patch)) updated[FIELDS[key]]=value;
        if (Object.hasOwn(patch,'startTime') && Object.hasOwn(patch,'endTime')) {
          updated.timeUnknown = patch.startTime === null && patch.endTime === null;
        }
        if (!validYearDate(updated.academicYear, updated.date)) throw fail(51245,'Invalid synthetic academic year date');
        if (updated.start!==null && updated.end!==null && time(updated.start)>=time(updated.end)) {
          throw fail(51242,'Invalid synthetic session interval');
        }
        // Query is inside the same Firestore transaction, so edits sharing a
        // date are serialized/retried and cannot introduce identical blocks.
        // The date field has a built-in Firestore single-field index.
        const daily=await tx.get(sessions.where('date','==',updated.date).limit(501));
        if (!Array.isArray(daily.docs) || daily.docs.length>500) throw Error('Synthetic daily session limit exceeded');
        if (updated.start !== null && updated.end !== null) {
          for(const doc of daily.docs){
            const other=doc.data();
            if (other.synthetic!==true) throw Error('Non-synthetic daily session rejected');
            if (doc.id!==sessionId && duplicate(updated,other)) throw fail(51246,'Duplicate synthetic session conflict');
          }
        }
        const revision=Number.isSafeInteger(existing.revision) && existing.revision>=0 ? existing.revision+1 : 1;
        const changedAtUtc=new Date().toISOString();
        const change={ date:updated.date,start:updated.start,end:updated.end,
          timeUnknown:updated.timeUnknown===true,course:updated.course,
          type:updated.type,topic:updated.topic,room:updated.room,revision,updatedAtUtc:changedAtUtc };
        // Use the same audited before/after contract as the Production
        // Change History projector; never expose raw Firestore documents.
        const historyRow = row => ({
          academicYear:row.academicYear,courseCode:row.course,
          courseName:row.courseName||'',sessionType:row.type,topic:row.topic,
          date:row.date,startTime:row.timeUnknown?null:row.start,
          endTime:row.timeUnknown?null:row.end,room:row.room,
          assignments:(Array.isArray(row.assignments)?row.assignments:[])
            .filter(person=>person && typeof person.facultyId==='string')
            .map(person=>({facultyId:person.facultyId,
              sourceFacultyName:names.format(person),teachingRole:person.role||null}))
        });
        const before = historyRow(existing), after = historyRow(updated);
        const recorded = new Map();
        for (const row of [before,after]) for (const person of row.assignments)
          recorded.set(person.facultyId.toLowerCase(),{
            facultyId:person.facultyId,facultyKey:person.facultyId,
            displayName:person.sourceFacultyName
          });
        for (const facultyId of [...(existing.facultyIds||[]),...(updated.facultyIds||[])])
          if (typeof facultyId==='string' && !recorded.has(facultyId.toLowerCase()))
            recorded.set(facultyId.toLowerCase(),{facultyId,facultyKey:facultyId});
        tx.update(target,change);
        tx.create(audit,{ synthetic:true,type:'SESSION_EDIT',source:'paws_testing',
          eventId:randomUUID(),eventType:'session_updated',entityType:'session',
          entityId:sessionId,sessionId,academicYear:updated.academicYear,
          actorFirebaseUid,actorName:typeof actorName==='string'?actorName.slice(0,260):null,
          occurredAtUtc:changedAtUtc,changedFields:Object.keys(patch),revision,
          beforeJson:JSON.stringify(before),afterJson:JSON.stringify(after),
          contextJson:JSON.stringify({academicYear:updated.academicYear,
            affectedFaculty:[...recorded.values()]}) });
        const assignments=Array.isArray(updated.assignments)?updated.assignments:[];
        const allowed=assignments.filter(row=>row&&typeof row.facultyId==='string').map(row=>({
          facultyId:row.facultyId,teachingRole:row.role||null,
          displayName:names.format(row),active:typeof row.active==='boolean'?row.active:null }));
        return {
          id:sessionId,academicYear:updated.academicYear,curriculumYear:updated.year??null,
          courseCode:updated.course,courseName:updated.courseName||'',
          sessionType:updated.type,topic:updated.topic,date:updated.date,
          startTime:updated.timeUnknown?null:updated.start,
          endTime:updated.timeUnknown?null:updated.end,room:updated.room,
          instructorNames:Array.isArray(updated.instructorNames)?updated.instructorNames.join('; '):'',
          assignmentsJson:JSON.stringify(allowed),revision,updatedAtUtc:changedAtUtc
        };
      });
    }
  });
}
module.exports = { createLabSessionWrites };
