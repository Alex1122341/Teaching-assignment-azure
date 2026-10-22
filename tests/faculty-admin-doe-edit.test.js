'use strict';

const { repositoryPath } = require('../tools/build/frontend-paths');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class Element {
  constructor(id = '') {
    this.id = id;
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.dataset = {};
    this.disabled = false;
    this.handlers = {};
    this.classList = { toggle() {} };
  }
  addEventListener(name, handler) { this.handlers[name] = handler; }
  setAttribute() {}
  querySelector(selector) { return this.children?.get(selector) || null; }
  querySelectorAll() { return []; }
  appendChild(child) { this.section = child; }
  insertBefore(child) { this.section = child; }
  remove() {}
}

function setup(api) {
  const window = { confirm: () => true };
  const document = { createElement: () => new Element('section') };
  vm.runInNewContext(fs.readFileSync(repositoryPath(process.cwd(), 'faculty-admin-doe-edit.js'), 'utf8'), { window, document }, { filename: 'faculty-admin-doe-edit.js' });

  const form = new Element('form');
  form.dataset.facultyId = 'faculty-1';
  form.querySelector = selector => selector === '.form-actions' ? null : null;

  const view = window.UCVM_FACULTY_DOE_EDIT.create({ api, academicYear: () => '2026-27', canWrite: () => true });
  view.mount(form, { facultyId: 'faculty-1' });
  const section = form.section;
  const nodes = new Map();
  const active = new Element('active');
  const byId = id => {
    if (!nodes.has(id)) nodes.set(id, new Element(id));
    return nodes.get(id);
  };
  section.querySelector = selector => {
    if (selector === '.p4-doe-new') return row;
    if (selector === '.p4-doe-active') return active;
    const match = /^#(.+)$/.exec(selector);
    return match ? byId(match[1]) : null;
  };

  const row = new Element('new-row');
  row.dataset = {};
  const role = new Element('role'); role.value = 'Course Coordinator';
  const scope = new Element('scope'); scope.value = 'VTMD 204';
  const notes = new Element('notes'); notes.value = '';
  row.querySelector = selector => ({
    '.role-type': role,
    '.role-scope': scope,
    '.role-notes': notes
  }[selector] || null);
  active.innerHTML = 'Loading authoritative DOE Worksheet…';
  return { section, row, role, scope, nodes, byId };
}

const click = (section, selector) => section.handlers.click({ target: { closest: value => value === selector ? {} : null } });
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };

test('new assignment ignores a stale preview that resolves after a newer fact preview', async () => {
  let resolveFirst;
  const previews = [];
  const api = {
    doeWorksheet: async () => ({ lines: [], target: {} }),
    doePreview: args => {
      previews.push(args);
      if (previews.length === 1) return new Promise(resolve => { resolveFirst = resolve; });
      return Promise.resolve({ resultDoe: 12, ruleKey: 'course-coordination' });
    }
  };
  const { section, row, scope, byId } = setup(api);

  const first = click(section, '#p4-doe-preview-new');
  await flush();
  scope.value = 'VTMD 205';
  const second = click(section, '#p4-doe-preview-new');
  await second;
  assert.equal(byId('p4-doe-new-result').textContent, '12.00%');
  assert.equal(JSON.parse(row.dataset.previewFacts).courseCode, 'VTMD 205');

  resolveFirst({ resultDoe: 4, ruleKey: 'stale-course' });
  await first;
  assert.equal(byId('p4-doe-new-result').textContent, '12.00%');
  assert.equal(JSON.parse(row.dataset.previewFacts).courseCode, 'VTMD 205');
  assert.equal(previews.length, 2);
});

test('Edit Faculty embeds the Experimental-style assignment and annual override sections', async () => {
  const api = {
    doeWorksheet: async () => ({ lines: [], target: {} }),
    doePreview: async () => ({ resultDoe: 12, ruleKey: 'course-coordination' })
  };
  const { section, role, byId } = setup(api);
  for (const label of [
    'DOE Role Assignment · 2026-27', 'Access role and DOE assignment are separate.',
    'Role Type', 'Course / Subject / Scope', 'Calculated DOE', 'Notes',
    'Add DOE assignment', 'Office DOE override · 2026-27', 'Override DOE %',
    'Reason', 'Special notes', 'RSL', 'Mat Leave', 'Sick Leave', 'Special Event'
  ]) assert.ok(section.innerHTML.includes(label), label);
  assert.doesNotMatch(section.innerHTML, /name=["']?doeCredit|data-doe-field=["']doeCredit/i);

  role.value = 'VISC';
  await section.handlers.change({ target: { closest: () => null, matches: selector => selector === '#p4-doe-new-role' } });
  await flush();
  assert.equal(byId('p4-doe-new-result').textContent, '12.00%');
});

test('new assignment save obtains a fresh server preview when facts changed after preview', async () => {
  const previews = [];
  const saves = [];
  const api = {
    doeWorksheet: async () => ({ lines: [], target: {} }),
    doePreview: async args => { previews.push(args); return { resultDoe: previews.length, ruleKey: 'active-rule' }; },
    saveDoeAssignment: async args => { saves.push(args); return {}; }
  };
  const { section, scope, byId } = setup(api);

  await click(section, '#p4-doe-preview-new');
  assert.equal(previews.length, 1);
  scope.value = 'VTMD 205';
  await click(section, '#p4-doe-save-new');

  assert.equal(previews.length, 2);
  assert.equal(previews[1].facts.courseCode, 'VTMD 205');
  assert.equal(saves.length, 1);
  assert.equal(saves[0].facts.courseCode, 'VTMD 205');
  assert.equal(byId('p4-doe-new-result').textContent, 'Preview required');
});
