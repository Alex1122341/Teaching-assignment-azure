'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createPawsDataClient}=require('../paws-data-client');
function fixture(type='text/csv; charset=utf-8'){
 const calls=[],bytes=new TextEncoder().encode('\uFEFFFaculty,Source DOE\r\nExample,0\r\n');
 const api=createPawsDataClient({tokenProvider:async()=>'synthetic',fetchImpl:async(url,init)=>{calls.push({url,init});return {ok:true,status:200,headers:{get:key=>key==='content-type'?type:null},json:async()=>({rows:[]}),arrayBuffer:async()=>bytes.buffer};}});
 return {api,calls,bytes};
}
test('trainee list closes filters and never sends actor/faculty supplied by browser',async()=>{
 const h=fixture();await h.api.dashboardTrainees({academicYear:'2026-27',query:'student name',category:'preceptor',cursor:'cursor',limit:25,facultyId:'other',actorFirebaseUid:'spoof'});
 assert.deepEqual(Object.fromEntries(new URL(h.calls[0].url).searchParams),{academicYear:'2026-27',query:'student name',category:'preceptor',cursor:'cursor',limit:'25'});
 assert.equal(h.calls[0].init.headers.Authorization,'Bearer synthetic');assert.equal(h.calls[0].init.method,'GET');
});
test('trainee CSV exports all matching authorized rows without a page cursor and validates response',async()=>{
 const h=fixture(),file=await h.api.exportDashboardTrainees({academicYear:'2026-27',query:'student',category:'im',cursor:'page2',limit:25});
 assert.deepEqual(Object.fromEntries(new URL(h.calls[0].url).searchParams),{academicYear:'2026-27',query:'student',category:'im'});
 assert.deepEqual(file.bytes,h.bytes);assert.equal(file.contentType,'text/csv; charset=utf-8');
 assert.equal(h.calls[0].init.headers.Accept,'text/csv');
 await assert.rejects(fixture('text/html').api.exportDashboardTrainees({academicYear:'2026-27'}),{code:'INVALID_ARTIFACT_RESPONSE'});
});
