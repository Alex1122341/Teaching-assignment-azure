'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const sourceFunction = require('../test-support/source-function');
const names = require('../frontend/scripts/faculty-name');

function render(view, rows, query, type = '') {
  const nodes = new Map();
  for (const id of ['summary-body', 'roles-body', 'summary-search', 'roles-search', 'role-type-filter', 'role-status-filter', 'role-as-of']) nodes.set(id, {value: '', innerHTML: ''});
  nodes.get(view === 'summary' ? 'summary-search' : 'roles-search').value = query;
  nodes.get('role-type-filter').value = type;
  const ctx = {
    $: id => nodes.get(id), norm: value => String(value ?? '').trim().toLowerCase(),
    aggregateCache: {teachingSummary: rows, roles: rows}, facultyName: names.format,
    esc: value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;'),
    teachingSummaryDoeStatus: () => ({label: 'Complete', className: '', title: ''}),
    formatDoe: () => 'Not provided', display: value => value ?? 'Not provided',
    facultyManagement: {editAction: () => ''}, effectiveRoleDoe: () => ({}), rolePeriodsEditor: {action: () => ''},
    window: {PAWS_ROLE_PERIODS: {status: () => ({key: 'active', label: 'Active'}), summary: () => ''}},
    document: {querySelectorAll: () => []}
  };
  const fn = view === 'summary' ? 'renderTeachingSummary' : 'renderRoles';
  vm.runInNewContext(sourceFunction('faculty-admin.js', fn) + '\n' + fn + '();', ctx);
  return nodes.get(view === 'summary' ? 'summary-body' : 'roles-body').innerHTML;
}

for (const view of ['summary', 'roles']) {
  for (const row of [
    {preferredLastName: 'de la Cruz', preferredFirstName: 'Mary Jane', displayName: 'Legacy unrelated label'},
    {preferredLastName: 'Müller', preferredFirstName: 'Élodie', displayName: 'Old source alias'},
    {displayName: 'O’Neill, Jean-Luc'},
    {displayName: 'Locum'}
  ]) test(view + ' search finds the exact displayed name: ' + names.format(row), () => {
    const record = {...row, facultyId: 'faculty-1', roleType: 'HICC'};
    const original = JSON.stringify(record), label = names.format(record);
    assert.equal(names.format(label), label);
    assert.ok(render(view, [record], label.toLowerCase()).includes('data-summary-person="faculty-1"'));
    assert.equal(JSON.stringify(record), original, 'search must not rewrite source identity');
  });
  test(view + ' preserves original-name search and empty-result behavior', () => {
    const row = {facultyId: 'faculty-1', displayName: 'Legacy alias', preferredFirstName: 'Avery', preferredLastName: 'Example', roleType: 'HICC'};
    assert.ok(render(view, [row], 'legacy alias').includes('data-summary-person="faculty-1"'));
    assert.ok(!render(view, [row], 'no matching name').includes('data-summary-person='));
  });
}

test('roles name search still intersects the existing role-type filter', () => {
  const row = {facultyId: 'faculty-1', preferredFirstName: 'Mary Jane', preferredLastName: 'de la Cruz', roleType: 'HICC'};
  assert.ok(!render('roles', [row], 'de la cruz', 'VISC').includes('data-summary-person='));
  assert.ok(render('roles', [row], 'de la cruz', 'HICC').includes('data-summary-person="faculty-1"'));
});
