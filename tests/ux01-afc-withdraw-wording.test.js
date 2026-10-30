'use strict';
// UX-01: an admin removing an AFC record keeps it for history, so every label for
// that action and its saved state uses "Withdraw" / "Withdrawn" (agreed with Alex,
// 2026-10-29), matching the faculty "Withdraw request" / "Withdrawn" wording.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const afc = require('../frontend/scripts/faculty-admin-afc-records.js');

const name = row => row.facultyName || 'Name unavailable';
const base = { afcRecordId: '11111111-1111-4111-8111-111111111111', facultyId: '22222222-2222-4222-8222-222222222222', facultyName: 'One, Ada', startDate: '2099-11-05', endDate: '2099-11-06', sourceKind: 'manual', versionToken: '00000000000000AB' };

test('active AFC record offers Withdraw, not Delete', () => {
  const html = afc.renderRows([{ ...base, active: true }], { facultyName: name, canCancel: true });
  assert.match(html, />Withdraw<\/button>/);
  assert.doesNotMatch(html, /Delete|Archived/);
  const busy = afc.renderRows([{ ...base, active: true }], { facultyName: name, canCancel: true, busy: () => true });
  assert.match(busy, />Withdrawing…<\/button>/);
});

test('withdrawn AFC record reads Withdrawn in the list and the profile after refresh', () => {
  const html = afc.renderRows([{ ...base, active: false }], { facultyName: name, canCancel: true });
  assert.match(html, /<td>Withdrawn<\/td><td><span class="muted">N\/A<\/span><\/td><td>Withdrawn<\/td>/);
  assert.doesNotMatch(html, /Archived|>No</);
  const profile = afc.profileAfc([{ ...base, active: false }]);
  assert.match(profile, /<td>Withdrawn<\/td>/);
  assert.match(profile, /Past \/ Withdrawn · HR Archive/);
  assert.doesNotMatch(profile, /Inactive/);
  const active = afc.renderRows([{ ...base, active: true }], { facultyName: name, canCancel: false });
  assert.match(active, /<td>Active<\/td>/);
});

test('withdraw confirmation and result messages use the same word', async () => {
  const prompts = [], notes = [];
  let records = [{ ...base, active: true }];
  const actions = afc.createActions({
    api: { cancelDashboardAfcRecord: async () => { records = [{ ...base, active: false }]; } },
    facultyName: name, canCancel: () => true, getRecords: () => records,
    render() {}, refresh: async () => {}, refreshRecords: async () => {},
    notify: (message, error) => notes.push({ message, error: !!error }),
    confirm: message => { prompts.push(message); return true; }
  });
  await actions.cancel(`manual:${base.afcRecordId}`);
  assert.match(prompts[0], /^Withdraw the AFC record for One, Ada/);
  assert.doesNotMatch(prompts[0], /Delete/);
  assert.deepEqual(notes, [{ message: 'AFC record withdrawn. It no longer affects availability; its history is kept.', error: false }]);

  const failing = afc.createActions({
    api: { cancelDashboardAfcRecord: async () => { throw new Error(''); } },
    facultyName: name, canCancel: () => true, getRecords: () => [{ ...base, active: true }],
    render() {}, refresh: async () => {}, refreshRecords: async () => {},
    notify: (message, error) => notes.push({ message, error: !!error }), confirm: () => true
  });
  await failing.cancel(`manual:${base.afcRecordId}`);
  assert.deepEqual(notes.at(-1), { message: 'AFC record could not be withdrawn.', error: true });
});

test('AFC Records page filter, column and help text say Withdrawn', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'pages', 'faculty-admin.html'), 'utf8');
  assert.match(html, /<select class="select" id="afc-active-filter"><option value="">All status<\/option><option value="true" selected>Active<\/option><option value="false">Withdrawn<\/option><\/select>/);
  assert.match(html, /<th>Status<\/th><th>PDF<\/th><th>Actions<\/th>/);
  assert.match(html, /Withdrawing a record removes it from active availability while keeping its history\./);
  assert.doesNotMatch(html, /Deleting a record/);
});

test('AFC record API error messages say withdraw, not cancel or delete', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'src', 'data', 'dashboard-api.js'), 'utf8');
  const start = source.indexOf('async cancelAfcRecord');
  const body = source.slice(start, source.indexOf('\n    },', start));
  assert.ok(start > 0 && body.length > 0);
  assert.match(body, /This role cannot withdraw AFC records\./);
  assert.match(body, /Refresh the AFC records before withdrawing\./);
  assert.match(body, /Refresh and review it before withdrawing\./);
  assert.doesNotMatch(body, /before deleting|cannot cancel AFC/);
});
