'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {projectHistoryEvent,filterHistoryRows,publicHistoryRow}=require('../src/history/change-history-projection');
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const auth={uid:'viewer',role:'faculty',facultyId:A,admin:false,scope:'timetable'};
const event=(extra={})=>({source:'audit',eventId:A,eventType:'session_updated',entityType:'session',entityId:B,occurredAtUtc:'2026-10-16T14:00:00.000Z',beforeJson:JSON.stringify({courseCode:'201',topic:'Old topic',room:'A',academicYear:'2026-27'}),afterJson:JSON.stringify({courseCode:'206',topic:'New topic',room:'B',notes:'private-notes',email:'private-email',doeCredit:999}),contextJson:JSON.stringify({courseCode:'206',topic:'New topic',academicYear:'2026-27',affectedFaculty:[{facultyId:B,facultyKey:'opaque-b',displayName:'Teacher B'}]}),actorName:'Admin',...extra});
test('public teaching history is across faculty and a closed field projection',()=>{
 const rows=projectHistoryEvent(event(),auth);assert.equal(rows.length,3);
 assert.equal(rows.find(r=>r.field==='Room').previousValue,'A');
 const json=JSON.stringify(rows.map(publicHistoryRow));assert.doesNotMatch(json,/private|999|actorName|facultyId|opaque-b/);assert.match(json,/Teacher B/);
});
test('my teaching history follows recorded affected membership rather than actor',()=>{
 assert.equal(projectHistoryEvent(event(),{...auth,scope:'mine'}).length,0);
 assert.ok(projectHistoryEvent(event({actorFirebaseUid:'someone-else',contextJson:JSON.stringify({affectedFaculty:[{facultyId:A,displayName:'A'}]})}),{...auth,scope:'mine'}).length);
});
test('removed faculty is affected by before assignment snapshot and private DOE is stripped',()=>{
 const e=event({eventType:'session_assignments_replaced',beforeJson:JSON.stringify([{facultyId:A,sourceFacultyName:'Removed',teachingRole:'Lead',doeCredit:999,notes:'private'}]),afterJson:JSON.stringify([{facultyId:B,sourceFacultyName:'Replacement',teachingRole:'Lead'}])});
 const rows=projectHistoryEvent(e,{...auth,scope:'mine'});assert.equal(rows.length,1);assert.match(rows[0].previousValue,/Removed/);assert.match(rows[0].updatedValue,/Replacement/);assert.doesNotMatch(JSON.stringify(rows.map(publicHistoryRow)),/999|private|facultyId/);
});
test('legacy time edits without recorded membership do not guess my involvement',()=>{
 assert.equal(projectHistoryEvent(event({contextJson:null}),{...auth,scope:'mine'}).length,0);
 assert.ok(projectHistoryEvent(event({contextJson:null}),auth).length);
});
test('AFC details are only own or administrator dashboard history, never public or mine',()=>{
 const e=event({eventType:'afc_record_cancelled',entityType:'afc_record',beforeJson:JSON.stringify({FacultyId:B,ReasonCode:'medical',Notes:'private-medical',Active:true}),afterJson:JSON.stringify({FacultyId:B,ReasonCode:'medical',Notes:'private-medical',Active:false})});
 for(const scope of ['timetable','mine','dashboard'])assert.equal(projectHistoryEvent(e,{...auth,scope}).length,0);
 assert.ok(projectHistoryEvent(e,{...auth,scope:'dashboard',facultyId:B}).length);
 assert.ok(projectHistoryEvent(e,{...auth,scope:'dashboard',admin:true}).length);
});
test('Lookup history keeps own fields and rejects another person and office privilege escalation',()=>{
 const e=event({eventType:'FacultyUpdated',entityType:'Faculty',entityId:A,beforeJson:'{"rank":"Old","email":"own-before","password":"secret"}',afterJson:'{"rank":"New","email":"own-after","password":"secret-new"}'});
 assert.equal(projectHistoryEvent(e,{...auth,scope:'dashboard'}).length,2);
 assert.equal(projectHistoryEvent(e,{...auth,scope:'dashboard',facultyId:B,role:'adc'}).length,0);
 assert.doesNotMatch(JSON.stringify(projectHistoryEvent(e,{...auth,scope:'dashboard'})),/secret/);
});
test('faculty sees published policy public fields, never drafts, exceptions or actor details',()=>{
 const e=event({source:'doe',eventType:'published',entityType:'doe_policy_version',beforeJson:'{}',afterJson:JSON.stringify({revision:2,ruleBook:{rules:[{ruleKey:'lecture',ruleLabel:'Lecture',formulaText:'hours*rate',parameters:[{name:'rate',valueNumber:2}]}],exceptions:[{facultyId:B,reason:'private-exception',fixedDoe:999}]}})});
 const rows=projectHistoryEvent(e,{...auth,scope:'dashboard'});assert.ok(rows.length);assert.match(JSON.stringify(rows),/Lecture/);assert.doesNotMatch(JSON.stringify(rows.map(publicHistoryRow)),/private|999|Admin/);
 assert.equal(projectHistoryEvent({...e,eventType:'draft_updated'},{...auth,scope:'dashboard'}).length,0);
 assert.equal(projectHistoryEvent(e,auth).length,0);
});
test('unknown event and malformed audit JSON fail closed and do not expose raw strings',()=>{
 assert.deepEqual(projectHistoryEvent(event({eventType:'account_audit',afterJson:'{"password":"secret"}'}),auth),[]);
 assert.doesNotMatch(JSON.stringify(projectHistoryEvent(event({beforeJson:'secret raw SQL',afterJson:'bad-json',contextJson:null}),auth)),/secret|SQL|bad-json/);
});
test('course/topic filters match old and new and never infer VISC or academic year',()=>{
 const rows=projectHistoryEvent(event(),auth);
 for(const course of ['201','206'])assert.equal(filterHistoryRows(rows,{course}).length,rows.length);
 for(const topic of ['Old','New'])assert.equal(filterHistoryRows(rows,{topic}).length,rows.length);
 assert.equal(filterHistoryRows(rows,{faculty:'opaque-b'}).length,rows.length);
 assert.equal(filterHistoryRows(rows,{viscSubject:'Anatomy'}).length,0);
 assert.equal(filterHistoryRows(rows,{viscSubject:'__not_recorded__'}).length,rows.length);
 assert.equal(filterHistoryRows(rows,{academicYear:'2026-27'}).length,rows.length);
 assert.equal(projectHistoryEvent(event({beforeJson:'{"room":"A"}',afterJson:'{"room":"B"}',contextJson:null}),auth)[0].academicYear,null);
});
test('actor fields are only actually recorded admin names and not email/UID fallback',()=>{
 const row=projectHistoryEvent(event(),{...auth,admin:true})[0];assert.equal(publicHistoryRow(row).actor,'Admin');
 assert.equal(publicHistoryRow(projectHistoryEvent(event({actorName:null,actorFirebaseUid:'secret-uid'}),{...auth,admin:true})[0]).actor,undefined);
});
test('Dashboard includes own recorded manual/target DOE changes, but no other faculty values',()=>{
 const e=event({source:'doe',eventType:'manual_doe_updated',entityType:'manual_doe_assignment',facultyId:A,beforeJson:'{"DoeValue":1,"Notes":"Own note"}',afterJson:'{"DoeValue":2,"Notes":"New own note"}',contextJson:null});
 const rows=projectHistoryEvent(e,{...auth,scope:'dashboard'});assert.equal(rows.length,2);assert.match(JSON.stringify(rows),/New own note/);
 assert.equal(projectHistoryEvent({...e,facultyId:B},{...auth,scope:'dashboard'}).length,0);assert.equal(projectHistoryEvent(e,auth).length,0);
});
test('own migrated working schedule uses exact source evidence without AFC recovery payload',()=>{
 const e=event({source:'work',eventType:'calendar_activity_import_committed',entityType:'calendar_activity',beforeJson:null,afterJson:JSON.stringify({facultyId:A,label:'CCC Day',startDate:'2026-10-16',endDate:'2026-10-17',category:'ccc'}),contextJson:null});
 assert.ok(projectHistoryEvent(e,{...auth,scope:'mine'}).length);assert.equal(projectHistoryEvent(e,auth).length,0);assert.equal(projectHistoryEvent(e,{...auth,scope:'mine',facultyId:B}).length,0);
});
