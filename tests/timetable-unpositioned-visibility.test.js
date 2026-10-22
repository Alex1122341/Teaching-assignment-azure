'use strict';
const { repositoryPath } = require('../tools/build/frontend-paths');
// BETA-R4D-9G: sessions outside the Day/Week calendar grid must never disappear.
//
// The defect: `unpositionedSessionsHtml()` admitted a session only when
// `validateInterval().status !== 'valid'`, while the grid renderer dropped any
// interval that fell entirely outside the visible 07:30-17:00 window. `01:30-02:30`
// is a *valid* interval, so it failed the check-needed filter AND was dropped by the
// grid guard: it rendered nowhere. These tests pin the fix.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync(repositoryPath(process.cwd(), 'timetable.js'),'utf8');
const css=fs.readFileSync(repositoryPath(process.cwd(), 'timetable.css'),'utf8');

const CAL_START=450, CAL_END=1020; // 07:30 - 17:00

function minutes(value){
  if(value===null||value===undefined||value==='')return null;
  const m=/^(\d{1,2}):(\d{2})/.exec(String(value));
  if(!m)return null;
  const h=Number(m[1]), min=Number(m[2]);
  if(h>23||min>59)return null;
  return h*60+min;
}

// Mirrors scheduling.validateInterval() - interval well-formedness only.
function validateInterval(start,end,{timeUnknown=false}={}){
  if(timeUnknown)return{status:'unknown',startMinutes:null,endMinutes:null};
  const s=minutes(start), e=minutes(end);
  if(s===null||e===null)return{status:'invalid',startMinutes:s,endMinutes:e};
  if(e<=s)return{status:'invalid',startMinutes:s,endMinutes:e};
  return{status:'valid',startMinutes:s,endMinutes:e};
}

// Mirrors the shipped calendarTimingDisposition().
function disposition(session){
  if(session.date!==undefined){const date=String(session.date||''),parsed=new Date(date+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)return{disposition:'invalid-date',startMinutes:null,endMinutes:null}}
  const timing=validateInterval(session.start,session.end,{timeUnknown:session.timeUnknown===true});
  if(timing.status!=='valid')return{disposition:'invalid',startMinutes:null,endMinutes:null};
  if(timing.endMinutes<=CAL_START)return{disposition:'before',startMinutes:timing.startMinutes,endMinutes:timing.endMinutes};
  if(timing.startMinutes>=CAL_END)return{disposition:'after',startMinutes:timing.startMinutes,endMinutes:timing.endMinutes};
  return{disposition:'grid',startMinutes:timing.startMinutes,endMinutes:timing.endMinutes};
}

// Mirrors what the fixed grid renderer actually draws (clamped, or nothing).
function gridDraw(session){
  const d=disposition(session);
  if(d.disposition!=='grid')return null;
  const startM=Math.max(CAL_START,d.startMinutes), endM=Math.min(CAL_END,d.endMinutes);
  if(endM<=startM)return null;
  return{startM,endM};
}

const sess=(start,end,extra={})=>({id:`s-${start}-${end}`,start,end,date:'2026-10-01',...extra});

test('R4D-9G: 08:30-09:30 is grid-positionable',()=>{
  const s=sess('08:30','09:30');
  assert.equal(disposition(s).disposition,'grid');
  assert.deepEqual(gridDraw(s),{startM:510,endM:570});
});

test('R4D-9G: 13:00-16:30 is grid-positionable',()=>{
  const s=sess('13:00','16:30');
  assert.equal(disposition(s).disposition,'grid');
  assert.deepEqual(gridDraw(s),{startM:780,endM:990});
});

test('R4D-9G: 01:30-02:30 is VALID but NOT grid-positionable, and is surfaced',()=>{
  const s=sess('01:30','02:30');
  // The subtlety: it is a syntactically valid interval...
  assert.equal(validateInterval(s.start,s.end).status,'valid');
  // ...but unpositionable in this calendar window.
  assert.equal(disposition(s).disposition,'before');
  assert.equal(gridDraw(s),null);
});

test('R4D-9G: 02:45-04:15 is not grid-positionable and is surfaced',()=>{
  const s=sess('02:45','04:15');
  assert.equal(disposition(s).disposition,'before');
  assert.equal(gridDraw(s),null);
});

test('R4D-9G: 18:00-19:00 is not grid-positionable and is surfaced',()=>{
  const s=sess('18:00','19:00');
  assert.equal(disposition(s).disposition,'after');
  assert.equal(gridDraw(s),null);
});

test('R4D-9G: 08:30-04:30 reversed interval is not grid-positionable',()=>{
  const s=sess('08:30','04:30');
  assert.equal(validateInterval(s.start,s.end).status,'invalid');
  assert.equal(disposition(s).disposition,'invalid');
  assert.equal(gridDraw(s),null);
});

test('R4D-9G: 00:00-00:00 sentinel is not grid-positionable',()=>{
  const s=sess('00:00','00:00');
  assert.equal(disposition(s).disposition,'invalid');
  assert.equal(gridDraw(s),null);
});

test('R4D-9G: 07:00-08:00 is grid-positionable and clipped to 07:30',()=>{
  const s=sess('07:00','08:00');
  assert.equal(disposition(s).disposition,'grid');
  assert.deepEqual(gridDraw(s),{startM:450,endM:480});
});

test('R4D-9G: 16:30-17:30 is grid-positionable and clipped to 17:00',()=>{
  const s=sess('16:30','17:30');
  assert.equal(disposition(s).disposition,'grid');
  assert.deepEqual(gridDraw(s),{startM:990,endM:1020});
});

test('R4D-9G: missing/unparseable interval is surfaced, never grid-positionable',()=>{
  for(const s of [sess('',''),sess(null,null),sess('abc','def'),sess('not-a-time',undefined)]){
    assert.equal(disposition(s).disposition,'invalid',JSON.stringify(s));
    assert.equal(gridDraw(s),null,JSON.stringify(s));
  }
});

test('R4D-9G: unknown-time sessions are surfaced, never grid-positionable',()=>{
  const s=sess('','',{timeUnknown:true});
  assert.equal(disposition(s).disposition,'invalid');
  assert.equal(gridDraw(s),null);
});

test('post-P3: missing or malformed dates are Check Needed even when times look valid',()=>{
  for(const s of [sess('09:00','10:00',{date:''}),sess('09:00','10:00',{date:null}),sess('09:00','10:00',{date:'2026-02-30'})]){
    assert.equal(disposition(s).disposition,'invalid-date');
    assert.equal(gridDraw(s),null);
  }
});

test('R4D-9G: real-data early-clock patterns are all surfaced (never silently dropped)',()=>{
  const patterns=[['01:00','02:30'],['01:30','02:30'],['02:30','03:30'],['03:30','04:30'],
                  ['02:45','04:15'],['01:15','02:45'],['03:00','04:30']];
  for(const [start,end] of patterns){
    const s=sess(start,end);
    assert.equal(validateInterval(start,end).status,'valid',`${start}-${end} should be a valid interval`);
    assert.notEqual(disposition(s).disposition,'grid',`${start}-${end} must not be grid-positioned`);
    assert.equal(gridDraw(s),null,`${start}-${end} must not be drawn`);
  }
});

test('R4D-9G: real-data reversed patterns stay surfaced',()=>{
  for(const [start,end] of [['08:30','04:30'],['09:00','03:30'],['09:15','03:30'],['09:15','04:15']]){
    const s=sess(start,end);
    assert.equal(disposition(s).disposition,'invalid',`${start}-${end}`);
    assert.equal(gridDraw(s),null,`${start}-${end}`);
  }
});

test('R4D-9G: grid and check-needed form an exhaustive partition (Week View)',()=>{
  const week=[sess('08:30','09:30'),sess('13:00','16:30'),sess('07:00','08:00'),sess('16:30','17:30'),
              sess('01:30','02:30'),sess('02:45','04:15'),sess('18:00','19:00'),sess('08:30','04:30'),
              sess('00:00','00:00'),sess('09:15','03:30'),sess('',''),sess('07:30','17:00')];
  const grid=week.filter(s=>disposition(s).disposition==='grid');
  const check=week.filter(s=>disposition(s).disposition!=='grid');
  assert.equal(grid.length+check.length,week.length,'no silent loss');
  assert.equal(grid.filter(s=>check.includes(s)).length,0,'sets must not overlap');
});

test('R4D-9G: grid and check-needed form an exhaustive partition (Day View)',()=>{
  const day=[sess('01:00','02:30'),sess('01:30','02:30'),sess('08:30','09:30'),sess('00:00','00:00'),
             sess('13:00','16:30'),sess('09:00','03:30')];
  const grid=day.filter(s=>disposition(s).disposition==='grid');
  const check=day.filter(s=>disposition(s).disposition!=='grid');
  assert.equal(grid.length+check.length,day.length);
  assert.equal(grid.filter(s=>check.includes(s)).length,0);
});

test('R4D-9G: shipped timetable.js uses the shared disposition helper, not ad-hoc window checks',()=>{
  assert.match(src,/function calendarTimingDisposition\(session\)/);
  assert.match(src,/const CALENDAR_DAY_START=450, CALENDAR_DAY_END=1020;/);
  // The grid layout must select via the disposition, never via bare 'valid'.
  const layout=src.slice(src.indexOf('function layoutDaySessions'),src.indexOf('function unpositionedSessionsHtml'));
  assert.match(layout,/calendarTimingDisposition\(session\)/);
  assert.match(layout,/item\.timing\.disposition==='grid'/);
  assert.doesNotMatch(layout,/item\.timing\.status==='valid'/);
});

test('post-P3 Check Needed list covers the selected academic year and partitions by canonical disposition',()=>{
  const html=fs.readFileSync(repositoryPath(process.cwd(), 'index.html'),'utf8');
  assert.match(html,/id="list-global-controls"/);
  assert.match(html,/id="list-academic-year"/);
  assert.match(html,/id="list-session-mode"/);
  const listStart=src.indexOf('function renderList()');
  const listEnd=src.indexOf('function bindSessionBlocks()',listStart);
  const list=src.slice(listStart,listEnd);
  assert.match(list,/session\.academicYear/);
  assert.match(list,/listSessionMode==='CHECK NEEDED'\?checkRows:listSessionMode==='GRID-READY'\?gridRows:classified/);
  assert.match(list,/checkRows=classified\.filter\(row=>row\.check\.disposition!==['"]grid['"]\)/);
  assert.match(list,/gridRows=classified\.filter\(row=>row\.check\.disposition===['"]grid['"]\)/);
  assert.doesNotMatch(list,/date>=start|future sessions/);
  assert.match(src,/invalid-date/);
});

test('R4D-9G: no session is dropped by a window-based early return',()=>{
  // The original defect: `if (endM <= DAY_START || startM >= DAY_END) return;`
  assert.doesNotMatch(src,/endM\s*<=\s*DAY_START\s*\|\|\s*startM\s*>=\s*DAY_END/);
  assert.doesNotMatch(src,/endM\s*<=\s*CALENDAR_DAY_START\s*\|\|\s*startM\s*>=\s*CALENDAR_DAY_END/);
});

test('R4D-9G: check-needed predicate is the exact complement of the grid predicate',()=>{
  const body=src.slice(src.indexOf('function unpositionedSessionsHtml'),src.indexOf('function renderDay'));
  assert.match(body,/calendarTimingDisposition\(session\)/);
  assert.match(body,/row\.check\.disposition!=='grid'/);
  assert.doesNotMatch(body,/validateInterval\(session\.start,session\.end,\{timeUnknown:session\.timeUnknown===true\}\)\.status!=='valid'/);
});

test('R4D-9G: check-needed heading is truthful and does not assert the time is wrong',()=>{
  assert.match(src,/Sessions not shown in calendar grid - Check needed/);
  assert.doesNotMatch(src,/Time not confirmed - Check needed/);
});

test('R4D-9G: reasons distinguish unknown / invalid / outside-window',()=>{
  const body=src.slice(src.indexOf('function unpositionedReason'),src.indexOf('function unpositionedSessionsHtml'));
  assert.match(body,/'Time unknown'/);
  assert.match(body,/'Invalid time interval'/);
  assert.match(body,/Outside calendar hours/);
});

test('R4D-9G: check-needed buttons keep session click behavior',()=>{
  const body=src.slice(src.indexOf('function unpositionedSessionsHtml'),src.indexOf('function renderDay'));
  assert.match(body,/data-session-id="\$\{escapeHtml\(session\.id\)\}"/);
  // Click binding is delegated over every [data-session-id] node.
  assert.match(src,/document\.querySelectorAll\('\[data-session-id\]'\)/);
});

test('R4D-9G: no fabricated corrected times are emitted',()=>{
  const body=src.slice(src.indexOf('function unpositionedSessionsHtml'),src.indexOf('function renderDay'));
  assert.doesNotMatch(body,/\+\s*12/);
  assert.doesNotMatch(body,/12\s*\*\s*60/);
  assert.match(body,/session\.start/); // stored value only
});

test('R4D-9G: untimed section has dedicated styling',()=>{
  assert.match(css,/\.untimed-sessions\{/);
  assert.match(css,/\.untimed-sessions-list\{/);
  assert.match(css,/max-height:240px/);
  assert.match(css,/overflow-y:auto/);
  assert.match(css,/@media\(max-width:760px\)\{\.untimed-sessions-list/);
});

test('R4D-9G: no Firestore session fallback introduced and writes stay disabled',()=>{
  const body=src.slice(src.indexOf('function unpositionedSessionsHtml'),src.indexOf('function renderDay'));
  assert.doesNotMatch(body,/onSnapshot|collection\(SESSION_COLLECTION\)/);
  assert.doesNotMatch(body,/sessionWritesEnabled\s*\(/);
  assert.match(src,/scheduleSource = sessions\.length \? 'vetmed-ops' : 'vetmed-ops-empty'/);
});
