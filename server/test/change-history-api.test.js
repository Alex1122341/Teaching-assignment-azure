'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createChangeHistoryApi}=require('../src/history/change-history-api');
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function harness({count=202}={}){
 let now=Date.parse('2026-10-16T12:00:00Z'),calls=0,serial=0;
 let profile={active:true,mustChangePassword:false,baseRole:'faculty',facultyId:A};
 let events=Array.from({length:count},(_,i)=>({source:'audit',eventId:String(i),eventType:'session_updated',entityType:'session',entityId:A,occurredAtUtc:'2026-10-16T10:00:00Z',beforeJson:'{"room":"Old"}',afterJson:JSON.stringify({room:'New '+i}),contextJson:JSON.stringify({affectedFaculty:[{facultyId:A,displayName:'Teacher'}]})}));
 const api=createChangeHistoryApi({verifyToken:async token=>{if(token==='bad')throw Error('private');return token?{uid:token}:null;},findUser:async()=>profile,repository:{list:async()=>{calls++;return events;}},clock:()=>now,randomId:()=>String(++serial).padStart(8,'0')+'-aaaa-4aaa-8aaa-aaaaaaaaaaaa'});
 return {api,calls:()=>calls,setProfile:p=>profile=p,advance:ms=>now+=ms,mutate:()=>events=[],now:()=>now};
}
test('authentication/profile denial precedes all reads and fixed errors reveal no internals',async()=>{
 const h=harness();for(const token of ['',null,'bad'])assert.equal((await h.api.query(token,{scope:'mine'})).status,401);
 for(const profile of [null,{active:false,baseRole:'faculty'},{active:true,baseRole:'faculty'},{active:true,baseRole:'owner',mustChangePassword:true},{active:true,baseRole:'other_office'}]){h.setProfile(profile);assert.equal((await h.api.query('a',{scope:'mine'})).status,403);}
 assert.equal(h.calls(),0);
});
test('closed filters reject spoofing, arrays, impossible dates, duplicate route values and invalid formats',async()=>{
 const h=harness();for(const query of [{scope:'evil'},{scope:'mine',actorFirebaseUid:'spoof'},{scope:'mine',course:['206']},{scope:'mine',start:'2026-02-30',end:'2026-03-10'},{scope:'mine',start:'2026-11-01',end:'2026-10-01'},{scope:'mine',faculty:'raw-id'},{scope:'mine',academicYear:'wrong'}])assert.equal((await h.api.query('a',query)).status,400);
 assert.equal(h.calls(),0);
});
test('all filtered records belong to a stable snapshot across pages and both real exports',async()=>{
 const h=harness(),q=await h.api.query('a',{scope:'mine'});assert.equal(q.status,200);assert.equal(q.body.total,202);assert.equal(q.body.rows.length,100);
 h.mutate();const page=await h.api.page('a',{snapshot:q.body.snapshot,offset:100});assert.equal(page.status,200);assert.equal(page.body.rows.length,100);assert.equal(h.calls(),1);
 for(const format of ['csv','xlsx']){const out=await h.api.export('a',{snapshot:q.body.snapshot,format});assert.equal(out.status,200);assert.equal(out.body.rowCount,202);assert.ok(out.body.fileBase64);}
 assert.equal(h.calls(),1);
});
test('handles reject a different actor, changed role/link, inactive identity and expiry',async()=>{
 for(const change of ['actor','role','link','inactive','expiry']){
  const h=harness(),q=await h.api.query('a',{scope:'mine'});let token='a';
  if(change==='actor')token='b';if(change==='role')h.setProfile({active:true,baseRole:'owner',facultyId:A});if(change==='link')h.setProfile({active:true,baseRole:'faculty',facultyId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'});if(change==='inactive')h.setProfile({active:false,baseRole:'faculty',facultyId:A});if(change==='expiry')h.advance(600001);
  assert.ok([403,409].includes((await h.api.export(token,{snapshot:q.body.snapshot,format:'csv'})).status));
 }
});
test('snapshot retention evicts oldest after two queries per actor and rejects offset/format injection',async()=>{
 const h=harness(),one=await h.api.query('a',{scope:'mine'});await h.api.query('a',{scope:'mine'});await h.api.query('a',{scope:'mine'});
 assert.equal((await h.api.page('a',{snapshot:one.body.snapshot,offset:0})).status,409);
 const q=await h.api.query('a',{scope:'mine'});
 for(const offset of [-1,'01','1.5',101,999999])assert.equal((await h.api.page('a',{snapshot:q.body.snapshot,offset})).status,400);
 assert.equal((await h.api.export('a',{snapshot:q.body.snapshot,format:'pdf'})).status,400);
 assert.equal((await h.api.export('a',{snapshot:q.body.snapshot,format:'csv',actor:'spoof'})).status,400);
});
test('unlinked admin gets explicit My History error, not all-admin data',async()=>{
 const h=harness();h.setProfile({active:true,baseRole:'owner'});assert.equal((await h.api.query('a',{scope:'mine'})).status,403);assert.equal(h.calls(),0);
 assert.equal((await h.api.query('a',{scope:'timetable'})).status,200);
});
test('more than the bounded row set is rejected rather than silently truncated',async()=>{
 const h=harness({count:10001});const q=await h.api.query('a',{scope:'mine'});assert.equal(q.status,413);assert.equal(q.body.error.code,'HISTORY_LIMIT');assert.equal(q.body.rows,undefined);
});
test('query revalidates identity after asynchronous SQL read before releasing rows',async()=>{
 let profile={active:true,baseRole:'faculty',facultyId:A};
 const api=createChangeHistoryApi({verifyToken:async()=>({uid:'a'}),findUser:async()=>profile,repository:{list:async()=>{profile={active:false,baseRole:'faculty',facultyId:A};return [];}}});
 assert.equal((await api.query('a',{scope:'mine'})).status,403);
});
