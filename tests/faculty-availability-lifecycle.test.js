'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const { repositoryPath } = require('../tools/build/frontend-paths');
const source = fs.readFileSync(repositoryPath(process.cwd(), 'faculty-availability.js'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

const first = { facultyId: 'first-sdk-id', name: 'de la Cruz, Mary Jane', active: true, undatedSessions: 0, undatedRoles: 0 };
const second = { facultyId: 'second-sdk-id', name: 'Second, Avery', active: true, undatedSessions: 0, undatedRoles: 0 };
const date = '2027-01-11';
const mockResult = ({ name = 'Example session', person = first, status = 'busy', items, nextCursor = null, total } = {}) => {
  const events = items ?? [{
    eventKey: name, kind: 'teaching', label: name, type: 'LEC', facultyId: person.facultyId,
    startDate: date, endDate: date, startTime: '09:00', endTime: '10:00', availability: 'busy',
    segments: [{ date, start: 32400, end: 36000, status: 'busy', timing: 'verified', actualStart: 32400, actualEnd: 36000 }]
  }];
  return {
    snapshot: person.facultyId + '-snapshot', offset: 0, items: events, nextCursor, total: total ?? events.length,
    faculty: [person], summaries: [{ facultyId: person.facultyId, status, days: [status], conflict: status === 'busy' ? 'LEC' : null,
      conflictCount: events.length, time: '09:00–10:00' }],
    dates: [date], complete: true, window: { startDate: date, endDate: date, start: 28800, end: 57600 }
  };
};

function fixture(overrides = {}, { self = false } = {}) {
  const nodes = new Map(), calls = [], pending = [], downloads = [];
  const makeNode = () => ({
    value: '', innerHTML: '', textContent: '', disabled: false, hidden: false, checked: false, open: false, listeners: new Map(),
    querySelector: () => null, querySelectorAll: () => [], focus() {}, setAttribute() {},
    addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(fn); },
    async fire(name, target = this) { for (const handler of this.listeners.get(name) || []) await handler({ target, preventDefault() {} }); },
    showModal() { this.open = true; }, close() { this.open = false; }
  });
  const host = { ...makeNode(), querySelector(selector) {
    if (!nodes.has(selector)) nodes.set(selector, makeNode());
    return nodes.get(selector);
  } };
  const context = { setTimeout, clearTimeout };
  vm.runInNewContext(source, context);
  const $ = id => host.querySelector('#availability-' + id);
  const filters = { mode: 'upcoming', 'time-mode': 'all', filter: 'all', sort: 'name', kind: 'all', group: 'date' };
  for (const [id, value] of Object.entries(filters)) $(id).value = value;
  const api = {
    async facultyAvailabilityRoster(includeInactive) {
      calls.push({ includeInactive });
      return { faculty: self ? [first] : [first, second], canSelectAll: !self };
    },
    facultyAvailabilityQuery(input) { return new Promise((resolve, reject) => pending.push({ input, resolve, reject })); },
    ...overrides
  };
  const controller = context.PAWS_FACULTY_AVAILABILITY.createFacultyAvailability({ api, host, getSelfMode: () => self, download: file => downloads.push(file) });
  const choose = (index, checked = true) => $('faculty-options').fire('change', { dataset: { avPick: String(index) }, checked });
  const click = data => host.fire('click', { closest: () => ({ dataset: data, focus() {} }) });
  const submit = () => $('search-form').fire('submit');
  return { controller, $, choose, click, submit, calls, pending, downloads };
}

test('faculty searches and removable chips use IDs, preserve duplicate names, and query all active in one call', async () => {
  const h = fixture({ facultyAvailabilityRoster: async () => ({ faculty: [first, { ...second, name: first.name }], canSelectAll: true }) });
  await h.controller.open();
  h.$('faculty').value = 'Mary Cruz';
  await h.$('faculty').fire('input');
  assert.match(h.$('faculty-options').innerHTML, /de la Cruz, Mary Jane · Faculty 1/);
  assert.match(h.$('faculty-options').innerHTML, /de la Cruz, Mary Jane · Faculty 2/);
  assert.doesNotMatch(h.$('faculty-options').innerHTML, /sdk-id/);
  await h.choose(1);
  const p = h.submit();
  assert.equal(h.pending[0].input.facultyIds[0], second.facultyId);
  h.pending[0].resolve(mockResult({ person: second }));
  await p;
  await h.$('all').fire('click');
  assert.equal(h.$('selected-count').textContent, '2 selected');
  const all = h.submit();
  assert.equal(h.pending[1].input.selection, 'allActive');
  assert.equal(h.pending[1].input.facultyIds.length, 0);
  h.pending[1].resolve(mockResult());
  await all;
  await h.$('clear').fire('click');
  assert.equal(h.$('selected-count').textContent, '0 selected');
  assert.equal(h.$('result').hidden, true);
});

test('the same result powers all views, group filters and downloads without repeat queries', async () => {
  const exports = [];
  const h = fixture({ facultyAvailabilityExport: async (...args) => { exports.push(args); return { rowCount: 1 }; } });
  await h.controller.open();
  await h.choose(0);
  h.$('mode').value = 'day'; h.$('start').value = date;
  h.$('time-mode').value = 'custom'; h.$('from-time').value = '08:00'; h.$('to-time').value = '16:00';
  const p = h.submit();
  assert.equal(h.pending[0].input.mode, 'day');
  assert.equal(h.pending[0].input.startTime, '08:00');
  h.pending[0].resolve(mockResult());
  await p;
  assert.match(h.$('summary-table').innerHTML, /de la Cruz, Mary Jane/);
  await h.click({ avView: 'timeline' });
  assert.match(h.$('day').innerHTML, /--position:12\.5000%;--span:12\.5000%/);
  await h.click({ avView: 'agenda' });
  assert.match(h.$('events').innerHTML, /Example session/);
  h.$('group').value = 'faculty'; await h.$('group').fire('change');
  assert.match(h.$('events').innerHTML, /de la Cruz, Mary Jane/);
  await h.click({ avView: 'summary' });
  h.$('filter').value = 'conflicts'; h.$('sort').value = 'status';
  await h.click({ avExport: 'csv' });
  await tick();
  assert.equal(h.pending.length, 1);
  assert.deepEqual(exports[0], [first.facultyId + '-snapshot', 'csv', 'conflicts', 'status']);
  assert.equal(h.downloads.length, 1);
});

test('changing the selection or time invalidates delayed results and sign-out clears names', async () => {
  const h = fixture();
  await h.controller.open();
  await h.choose(0);
  const old = h.submit();
  await h.choose(0, false);
  await h.choose(1);
  const current = h.submit();
  assert.equal(h.pending.length, 1);
  h.pending[0].resolve(mockResult({ name: 'Stale event' }));
  await old;
  await tick();
  h.pending[1].resolve(mockResult({ person: second, name: 'Fresh event' }));
  await current;
  await h.click({ avView: 'agenda' });
  assert.match(h.$('events').innerHTML, /Fresh event/);
  assert.doesNotMatch(h.$('events').innerHTML, /Stale event/);
  await h.$('from-time').fire('input');
  assert.equal(h.$('events').innerHTML, '');
  h.controller.clear();
  assert.equal(h.$('chips').innerHTML, '');
  assert.doesNotMatch(h.$('faculty-options').innerHTML, /Mary|Avery/);
});

test('interrupted pagination stays partial and blocks no-conflict results and common time', async () => {
  const h = fixture({ facultyAvailabilityPage: async () => { throw Error('read failed'); } });
  await h.controller.open();
  await h.choose(0);
  const p = h.submit();
  h.pending[0].resolve(mockResult({ status: 'clear', nextCursor: '1', total: 2 }));
  await p;
  assert.match(h.$('status').textContent, /Partial results/);
  assert.doesNotMatch(h.$('summary-table').innerHTML, /No PAWS Conflict Found/);
  assert.equal(h.$('common-form').hidden, true);
});

test('expired session clears the result and the self-only picker never shows select-all', async () => {
  const h = fixture({}, { self: true });
  await h.controller.open();
  assert.equal(h.$('all').hidden, true);
  assert.equal(h.$('selected-count').textContent, '1 selected');
  const p = h.submit();
  h.pending[0].reject(Object.assign(Error('expired'), { status: 401 }));
  await p;
  assert.match(h.$('status').textContent, /session expired/);
  assert.equal(h.$('result').hidden, true);
  assert.equal(h.$('chips').innerHTML, '');
});

test('a late roster response after sign-out never restores private choices', async () => {
  let resolve;
  const h = fixture({ facultyAvailabilityRoster: () => new Promise(done => { resolve = done; }) });
  const pending = h.controller.open();
  h.controller.clear();
  resolve({ faculty: [first], canSelectAll: true });
  await pending;
  assert.doesNotMatch(h.$('faculty-options').innerHTML, /Mary Jane/);
});
