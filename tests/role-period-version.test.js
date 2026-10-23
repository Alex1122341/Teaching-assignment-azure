'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'scripts', 'faculty-role-periods.js'), 'utf8');
const ROLE_ID = '11111111-1111-4111-8111-111111111111';
const HEX = '0x00000000000000AF';

function harness(version) {
  const callbacks = {};
  const input = selector => {
    if (selector === '[data-start="0"]') return { value: '2026-11-01' };
    if (selector === '[data-end="0"]') return { value: '2027-04-30' };
    if (selector === '[data-status]') return status;
    throw Error('Unexpected selector: ' + selector);
  };
  const status = { textContent: '' };
  const dialog = {
    open: false, innerHTML: '',
    setAttribute() {}, addEventListener(name, fn) { callbacks[name] = fn; },
    querySelector: input, querySelectorAll() { return []; },
    showModal() { this.open = true; }, close() { this.open = false; }
  };
  const role = {
    roleAssignmentId: ROLE_ID, facultyId: '22222222-2222-4222-8222-222222222222',
    roleType: 'HICC', courseOrSubjectOrRotation: 'VETM 401',
    validityPeriods: [{ startDate: '2026-11-01', endDate: '2027-04-30' }],
    scheduleVersion: version
  };
  const sent = [];
  const context = {
    window: {}, Intl, Date,
    document: {
      body: { appendChild() {} },
      createElement: () => dialog,
      addEventListener(name, fn) { callbacks['document:' + name] = fn; }
    },
    UCVM_PAWS_DATA: {
      async updateRolePeriods(id, payload) { sent.push({ id, payload }); return { scheduleVersion: HEX }; }
    }
  };
  vm.runInNewContext(source, context);
  context.window.PAWS_ROLE_PERIODS.create({
    canWrite: () => true,
    getRoles: () => [role],
    onChanged: async () => {},
    notify: () => {}
  });
  async function save() {
    callbacks['document:click']({
      target: { closest: () => ({ dataset: { rolePeriodEdit: ROLE_ID } }) }
    });
    await callbacks.submit({ preventDefault() {} });
  }
  return { save, sent, dialog, status };
}

test('role editor converts an unprefixed SQL rowversion to the canonical wire token', async () => {
  const h = harness('00000000000000af');
  await h.save();
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].payload.expectedVersion, HEX);
  assert.deepEqual(JSON.parse(JSON.stringify(h.sent[0].payload.periods)), [{ startDate: '2026-11-01', endDate: '2027-04-30' }]);
});

test('role editor converts serialized SQL rowversion buffers without changing periods', async () => {
  const h = harness({ type: 'Buffer', data: [0, 0, 0, 0, 0, 0, 0, 175] });
  await h.save();
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].payload.expectedVersion, HEX);
});

test('invalid role versions are blocked without a blind null-version save', async () => {
  const h = harness({ unexpected: 'unknown' });
  await h.save();
  assert.equal(h.sent.length, 0);
  assert.equal(h.dialog.open, true);
  assert.match(h.status.textContent, /reload|reopen|refresh/i);
});

test('a missing schedule version remains null for the SQL first-insert guard', async () => {
  const h = harness(null);
  await h.save();
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].payload.expectedVersion, null);
});
