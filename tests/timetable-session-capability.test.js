'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sourceFunction = require('../test-support/source-function');

const source = fs.readFileSync(path.join(__dirname, '..', 'timetable.js'), 'utf8');

test('SQL existing-session edit capability does not expose Firestore create or multi-edit controls', () => {
  assert.match(source, /const sessionWritesEnabled\s*=\s*Boolean\(window\.UCVM_PAWS_DATA\s*&&\s*window\.UCVM_PAWS_DATA\.sessionWritesEnabled\(\)\)/);
  assert.match(source, /\$\('add-session-btn'\)\.classList\.toggle\('hidden',\s*!canEdit\(\)\s*\|\|\s*!sessionWritesEnabled\)/);
  assert.match(source, /\$\('bulk-add-session-btn'\)\.classList\.toggle\('hidden',\s*!UCVM\.admin\(currentUser\)\s*\|\|\s*!sessionWritesEnabled\)/);
  assert.match(source, /\$\('selection-controls'\)\.classList\.toggle\('hidden',\s*!canEdit\(\)\s*\|\|\s*!sessionWritesEnabled\)/);
  assert.match(source, /sessionEditEnabled\?\.\(\)/);
});

test('unsupported Firestore faculty reassignment stays hidden while SQL session editing is available', () => {
  assert.match(source, /const swap\s*=\s*!s\.isCcc\s*&&\s*isAdmin\(\)\s*&&\s*window\.UCVM_PAWS_DATA\?\.sessionWritesEnabled\?\.\(\)/);
  assert.match(source, /This timetable action is not available on the current VetMed-Ops API\./);
  assert.match(source, /Only session fields are editable\. Faculty assignments and DOE values remain unchanged\./);
});

test('the timetable source banner distinguishes authorized SQL editors from read-only roles', () => {
  const update = sourceFunction('timetable.js', 'updateScheduleSourceUI');
  for (const [role, expected, editEnabled = true] of [
    ['adfa_general', 'Authorized: ADFAD Owner · VetMed-Ops timetable'],
    ['adfa_regular', 'Authorized: ADFAD Admin · VetMed-Ops timetable'],
    ['adfa_general', 'Authorized: ADFAD Owner · VetMed-Ops timetable (read only)', false],
    ['faculty', 'Authorized: Faculty · VetMed-Ops timetable (read only)'],
    ['hicc', 'Authorized: HICC · VetMed-Ops timetable (read only)'],
    ['visc', 'Authorized: VISC · VetMed-Ops timetable (read only)']
  ]) {
    const nodes = new Map();
    const context = {
      scheduleSource: 'azure-sql',
      currentUser: { role },
      $: id => { if (!nodes.has(id)) nodes.set(id, { classList: { toggle() {} } }); return nodes.get(id); },
      canEditExistingSqlSession: () => ['owner', 'administrator', 'adfa_general', 'adfa_regular', 'admin'].includes(role),
      UCVM: {
        label: value => ({ adfa_general: 'ADFAD Owner', adfa_regular: 'ADFAD Admin', faculty: 'Faculty', hicc: 'HICC', visc: 'VISC' })[value] || value,
        admin: user => ['adfa_general', 'adfa_regular'].includes(user?.role)
      },
      window: { UCVM_PAWS_DATA: { sessionWritesEnabled: () => false, sessionEditEnabled: () => editEnabled } }
    };
    vm.runInNewContext(`${update}\nupdateScheduleSourceUI();`, context);
    assert.equal(nodes.get('conn-text').textContent, expected, role);
  }
});

test('session edit PATCH includes only changed supported scalar fields', () => {
  const build = sourceFunction('timetable.js', 'buildSqlSessionEditPatch');
  const result = vm.runInNewContext(`${build}\nbuildSqlSessionEditPatch(session, values)`, {
    session: { date: '2026-10-01', course: '315', type: 'LEC', start: '09:00', end: '10:00', topic: 'Old', room: 'VET 1' },
    values: { date: '2026-10-01', course: '315', type: 'LEC', start: '09:00', end: '10:00', topic: 'New', room: 'VET 1' }
  });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { topic: 'New' });
  const cleared = vm.runInNewContext(`${build}\nbuildSqlSessionEditPatch(session, values)`, {
    session: { date: '2026-10-01', course: '315', type: 'LEC', start: '09:00', end: '10:00', topic: 'Old', room: 'VET 1' },
    values: { date: '2026-10-01', course: '315', type: 'LEC', start: '', end: '', topic: 'Old', room: 'VET 1' }
  });
  assert.deepEqual(JSON.parse(JSON.stringify(cleared)), { startTime: null, endTime: null });
});

test('session edit backend errors are translated into actionable messages', () => {
  const message = sourceFunction('timetable.js', 'sessionEditErrorMessage');
  const actual = vm.runInNewContext(`${message}\n[
    sessionEditErrorMessage({code:'INVALID_SESSION_INTERVAL'}),
    sessionEditErrorMessage({code:'INVALID_COURSE_CODE'}),
    sessionEditErrorMessage({code:'SESSION_DATE_OUTSIDE_ACADEMIC_YEAR'}),
    sessionEditErrorMessage({code:'DUPLICATE_SESSION_CONFLICT'}),
    sessionEditErrorMessage({code:'ROLE_DENIED'}),
    sessionEditErrorMessage({code:'SQL_UNAVAILABLE'})
  ]`);
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), [
    'Enter a valid interval with an end time after its start time, or clear both times.',
    'Enter a valid course code.',
    'The date must remain inside this session’s stored academic year.',
    'These values conflict with another session. Review the course, date, and time.',
    'This account is not authorized to edit the timetable.',
    'The session was not saved because the VetMed-Ops service is unavailable. Try again later.'
  ]);
});

test('successful edits invalidate the active subscription before authoritative refresh', () => {
  const invalidate = sourceFunction('timetable.js', 'invalidateAllSessions');
  assert.match(invalidate, /sessionUnsubscribe\(\)/);
  assert.match(invalidate, /sessionUnsubscribe=null/);
  assert.match(invalidate, /sessionRangeKey=''/);
  assert.match(source, /const refreshed=await refreshSessionScope\(\)/);
});
