'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sourceFunction = require('../test-support/source-function.js');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function cachedHarness({ownerUid='A',rows=[]}={}){
  const filter=sourceFunction('timetable.js','sessionsFromAllCache');
  const one=sourceFunction('timetable.js','fullSessionCacheForUser');
  const two=sourceFunction('timetable.js','cachedSessionsForRange');
  const sandbox={allSessionsOwnerUid:ownerUid,allSessionsCache:rows,Array,String};
  sandbox.globalThis=sandbox;
  return vm.runInContext(`(()=>{${filter}\n${one}\n${two}\nreturn{full:fullSessionCacheForUser,range:cachedSessionsForRange}})()`,vm.createContext(sandbox));
}

test('full session cache is readable only by the same Firebase user',()=>{
  const h=cachedHarness({ownerUid:'A',rows:[{id:'1',date:'2026-09-01'}]});
  assert.equal(h.full({uid:'B'}),null);
  assert.equal(h.full(null),null);
  assert.deepEqual(Array.from(h.full({uid:'A'}),x=>({...x})),[{id:'1',date:'2026-09-01'}]);
});

test('full session cache can satisfy a visible date range without SQL',()=>{
  const h=cachedHarness({ownerUid:'A',rows:[
    {id:'1',date:'2026-09-01'},
    {id:'2',date:'2026-09-03'},
    {id:'3',date:'2026-09-20'}
  ]});
  const rows=h.range({uid:'A'},{start:'2026-09-01',end:'2026-09-05'});
  assert.deepEqual(Array.from(rows,x=>x.id),['1','2']);
  assert.equal(h.range({uid:'B'},{start:'2026-09-01',end:'2026-09-05'}),null);
});

test('navigation checks full in-memory cache before issuing another session request',()=>{
  const source=read('timetable.js');
  const start=source.indexOf('async function subscribeSessions');
  const end=source.indexOf('\n  function refreshSessionScope',start);
  const body=source.slice(start,end);
  assert.match(body,/cachedSessionsForRange/);
  assert.ok(body.indexOf('cachedSessionsForRange')<body.indexOf('fetchAzureSessions'),'cache must be checked before network');
});

test('range helper also uses the full cache before SQL',()=>{
  const source=read('timetable.js');
  const start=source.indexOf('async function ensureSessionsForRange');
  const end=source.indexOf('\n  async function ensureSessionsForDates',start);
  const body=source.slice(start,end);
  assert.match(body,/cachedSessionsForRange/);
  assert.ok(body.indexOf('cachedSessionsForRange')<body.indexOf('fetchAzureSessions'),'full cache must precede range fetch');
});

test('login unlock does not wait for full-session prefetch',()=>{
  const source=read('timetable.js');
  const start=source.indexOf('async function bootstrapForUser');
  const end=source.indexOf('\n      auth.onAuthStateChanged',start);
  const body=source.slice(start,end);
  assert.match(body,/scheduleAllSessionsPrefetch/);
  assert.doesNotMatch(body,/await\s+ensureAllSessions\(/);
  assert.ok(body.indexOf("markLoginStage('T7')")<body.indexOf('scheduleAllSessionsPrefetch'),'T7 must happen before full prefetch scheduling');
});

test('full-session prefetch is stale-safe across account changes',()=>{
  const source=read('timetable.js');
  const start=source.indexOf('async function ensureAllSessions');
  const end=source.indexOf('\n  function scheduleAllSessionsPrefetch',start);
  const body=source.slice(start,end);
  assert.match(body,/allSessionsOwnerUid/);
  assert.match(body,/allSessionsLoadGeneration/);
  assert.match(body,/currentUser\?\.uid/);
});

test('session read path has no row cap and can return 6000+ rows',()=>{
  const repo=read('server/src/data/sql-session-repository.js');
  const api=read('server/src/data/data-api.js');
  assert.doesNotMatch(repo,/\bTOP\s*\(|\bOFFSET\b|\bFETCH\s+NEXT\b/i);
  assert.doesNotMatch(api,/session[^\n]{0,80}limit|limit[^\n]{0,80}session/i);
  assert.match(repo,/FROM paws\.vCalendarSession/);
});

test('no polling loop is introduced for full-session prefetch',()=>{
  const source=read('timetable.js');
  const start=source.indexOf('function scheduleAllSessionsPrefetch');
  const end=source.indexOf('\n  function invalidateAllSessions',start);
  const body=source.slice(start,end);
  assert.doesNotMatch(body,/setInterval|while\s*\(\s*true\s*\)/);
});
