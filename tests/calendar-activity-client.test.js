'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const {createPawsAzureDataClient}=require('../paws-data-client');
test('activity methods use authenticated University routes and bind only the explicit input fields',async()=>{
 const calls=[];const client=createPawsAzureDataClient({tokenProvider:async()=> 'synthetic',fetchImpl:async(url,init)=>{calls.push({url,init});return {ok:true,json:async()=>({activities:[],nextCursor:null})};}});
 await client.listCalendarActivities({start:'2026-05-01',end:'2026-05-08',category:'ccc',includeFacultyKeys:true});await client.calendarActivityCapabilities();
 await client.stageCalendarActivityImport({requestId:'r',sourceSha256:'sha',fileName:'file.xlsx',fileBase64:'base64',actorFirebaseUid:'spoof',rows:[]});
 await client.getCalendarActivityImport('batch/id');await client.previewCalendarActivityImport('batch/id',{expectedVersion:'version',actorFirebaseUid:'spoof'});
 await client.commitCalendarActivityImport('batch/id',{expectedVersion:'version',manifestSha256:'manifest',sourceSha256:'source',idempotencyKey:'key',confirm:true,afcIds:['spoof']});
 await client.resolveCalendarActivityTime('activity/id',{expectedVersion:'version',date:'2026-05-01',startTime:'09:00',endTime:'10:00',evidenceRef:'reference',evidenceNote:'note',facultyId:'spoof'});
 assert.match(calls[0].url,/calendar-activities\?.*includeFacultyKeys=true/);assert.match(calls[1].url,/calendar-activities\/capabilities$/);assert.match(calls[3].url,/calendar-activity-imports\/batch%2Fid$/);assert.match(calls[6].url,/calendar-activities\/activity%2Fid\/time-evidence$/);
 assert.equal(calls.every(call=>call.init.headers.Authorization==='Bearer synthetic'&&call.init.credentials==='omit'),true);
 for(const call of calls.filter(call=>call.init.body))assert.doesNotMatch(call.init.body,/spoof|afcIds|actorFirebaseUid|facultyId/);
 assert.deepEqual(calls.map(call=>call.init.method),['GET','GET','POST','GET','POST','POST','POST']);
});
