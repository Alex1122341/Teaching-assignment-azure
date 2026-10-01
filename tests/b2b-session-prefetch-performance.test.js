'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const sourceFunction=require('../test-support/source-function.js');
const {createPawsAzureDataClient}=require('../paws-data-client.js');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('Azure session client preserves a 6000-row response without truncation',async()=>{
  const rows=Array.from({length:6000},(_,i)=>({id:String(i+1),date:'2026-09-01'}));
  const client=createPawsAzureDataClient({
    tokenProvider:async()=>'t',
    fetchImpl:async()=>({ok:true,status:200,json:async()=>({sessions:rows})})
  });
  const result=await client.listSessions();
  assert.equal(result.length,6000);
  assert.equal(result[0].id,'1');
  assert.equal(result[5999].id,'6000');
});

test('full-session cache filter returns all rows or a requested range without truncation',()=>{
  const src=sourceFunction('timetable.js','sessionsFromAllCache');
  const rows=Array.from({length:6000},(_,i)=>({id:String(i),date:i<3000?'2026-09-01':'2026-10-01'}));
  const context=vm.createContext({rows,range:{start:'2026-09-01',end:'2026-09-30'},Array,String});
  const result=vm.runInContext(`(()=>{${src}\nreturn {all:sessionsFromAllCache(rows,null),range:sessionsFromAllCache(rows,range)}})()`,context);
  assert.equal(result.all.length,6000);
  assert.equal(result.range.length,3000);
});

test('range reads prefer the current users completed full-session cache before network loading',()=>{
  const source=read('timetable.js');
  const start=source.indexOf('async function ensureSessionsForRange');
  const end=source.indexOf('async function ensureSessionsForDates',start);
  const body=source.slice(start,end);
  assert.match(body,/cachedSessionsForRange\(currentUser,range\)/);
  assert.match(body,/if\(cachedAll\)return cachedAll/);
  assert.ok(body.indexOf('cachedSessionsForRange')<body.indexOf('fetchAzureSessions'));
});

test('visible timetable subscription prefers user-owned full-session memory cache when available',()=>{
  const source=read('timetable.js');
  const start=source.indexOf('async function subscribeSessions');
  const end=source.indexOf('function refreshSessionScope',start);
  const body=source.slice(start,end);
  assert.match(body,/cachedSessionsForRange/);
  assert.match(body,/fetchAzureSessions/);
  assert.ok(body.indexOf('cachedSessionsForRange')<body.indexOf('fetchAzureSessions'));
});

test('full-session prefetch is scheduled only after T7 unlock and does not block login',()=>{
  const source=read('timetable.js');
  const start=source.indexOf('async function bootstrapForUser');
  const end=source.indexOf('auth.onAuthStateChanged',start);
  const body=source.slice(start,end);
  const t7=body.indexOf("markLoginStage('T7')");
  const prefetch=body.indexOf('scheduleAllSessionsPrefetch(',t7);
  assert.ok(t7>=0&&prefetch>t7,'prefetch must be scheduled after T7');
  assert.doesNotMatch(body.slice(t7,prefetch),/await\s+scheduleAllSessionsPrefetch/);
});

test('prefetch helper is bounded and cannot relock or sign out the UI',()=>{
  const src=sourceFunction('timetable.js','scheduleAllSessionsPrefetch');
  assert.match(src,/ownerUid/);
  assert.match(src,/ensureAllSessions/);
  assert.doesNotMatch(src,/setAppLocked|signOut|location\.reload|setInterval|while\s*\(/);
});

test('full cache implementation is tied to user ownership and stale-generation protection',()=>{
  const source=read('timetable.js');
  assert.match(source,/allSessionsOwnerUid/);
  assert.match(source,/allSessionsLoadingUid/);
  assert.match(source,/allSessionsLoadGeneration/);
  assert.match(source,/generation!==allSessionsLoadGeneration/);
});
