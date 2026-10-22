'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('timetable.js','utf8');
const academic=source.match(/function academicPositionForDate\(d\) \{[\s\S]*?\n  \}/)?.[0];
const parse=source.match(/function parseYmd\(s\) \{[\s\S]*?\n  \}/)?.[0];
const azure=source.match(/function mapPawsSessionRow\(row\)\{[\s\S]*?\r?\n  \}\r?\n  async function fetchPawsSessions/)?.[0]?.replace(/\r?\n  async function fetchPawsSessions[\s\S]*$/,'');
assert.ok(academic&&parse&&azure,'calendar mapping helpers must remain discoverable');

function map(date){
  const context={result:null};
  vm.runInNewContext(`
    const SPRING_BASE_MONDAY=new Date(2026,3,27);
    const FALL_BASE_MONDAY=new Date(2026,7,24);
    const WINTER_BASE_MONDAY=new Date(2027,0,4);
    const WEEK_COUNT=17;
    function addDays(date,days){const d=new Date(date);d.setDate(d.getDate()+days);return d}
    ${academic}
    ${parse}
    function splitInstructorNames(v){return String(v||'').split(/[;\\n]+/).map(x=>x.trim()).filter(Boolean)}
    ${azure}
    result=mapPawsSessionRow({id:'sql-1',date:'${date}',curriculumYear:1,courseCode:'581',sessionType:'SRL',startTime:'00:00:00',endTime:'00:00:00'});
  `,context);
  return context.result;
}

test('Azure SQL normalization supplies semester and week fields',()=>{
  const row=map('2026-05-01');
  assert.equal(row.semester,'spring');
  assert.equal(row.week,1);
});

test('canonical academic mapping covers Spring Week 11',()=>{
  const row=map('2026-07-06');
  assert.equal(row.semester,'spring');
  assert.equal(row.week,11);
});

test('canonical academic mapping covers representative Fall and Winter dates',()=>{
  assert.deepEqual([map('2026-09-27').semester,map('2026-09-27').week],['fall',5]);
  assert.deepEqual([map('2027-01-04').semester,map('2027-01-04').week],['winter',1]);
});

test('calendar range and rendering contracts remain SQL-only and fail closed',()=>{
  assert.match(source,/listSessions\(range\)/);
  assert.match(source,/fetchPawsSessions\(\)\.then/);
  assert.match(source,/s\.semester\s*!==\s*selectedSemester/);
  assert.match(source,/s\.week\s*===\s*selectedWeek/);
  assert.match(source,/function renderDay/);
  assert.match(source,/function renderMonth/);
  assert.match(source,/function renderList/);
  assert.doesNotMatch(source,/collection\(['"]sessions['"]\).*fallback/s);
  assert.match(source,/sessionWritesEnabled\(\)/);
});
