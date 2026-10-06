'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('session validation stays in the scheduling core while browser save remains disabled',()=>{
  const source=read('timetable.js');
  assert.match(source,/const scheduling\s*=\s*window\.UCVM_SCHEDULING/);
  assert.match(source,/function timeToMinutes\([^)]*\)\s*\{\s*return scheduling\.parseTime\(/);
  assert.match(source,/function blockHours\([^)]*\)\s*\{[^}]*scheduling\.durationHours\(/s);
  assert.doesNotMatch(source,/function availabilityTimeMinutes\(/);
  assert.doesNotMatch(source,/function availabilityIntervalsOverlap\(/);
  assert.match(source,/function timetableAvailability\([^)]*\)\s*\{[\s\S]*?scheduling\.findFacultyConflicts\(/);
  assert.match(source,/function validateBulkRows\([^)]*\)\s*\{[\s\S]*?scheduling\.normalizeDate\(date\)[\s\S]*?scheduling\.validateInterval\(start,end\)/);
  assert.match(source,/\$\('session-form'\)\.onsubmit\s*=\s*event\s*=>\s*\{[\s\S]*?Session changes must use the PAWS University API/);
});

test('timetable does not keep a second AM PM parser or manual overlap formula',()=>{
  const source=read('timetable.js');
  assert.doesNotMatch(source,/function availabilityTimeMinutes[\s\S]*?match\(\/\^\(\\d\{1,2\}/);
  assert.doesNotMatch(source,/return as<be&&bs<ae/);
});

test('legacy ADFA approval application is disabled pending the trusted API workflow',()=>{
  const source=read('approval-workflow.js');
  assert.match(source,/approval application is disabled/);
  assert.doesNotMatch(source,/batch\.(?:set|update|delete)\(/);
  assert.doesNotMatch(source,/\.collection\(['"]sessions['"]\)\.doc\(/);
  const policy=read('approval-scheduling.js');
  assert.match(policy,/requiresOverride/);
  assert.match(policy,/overrideAudit/);
});
