'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class Element {
  constructor(id = '') { this.id = id; this.value = ''; this.textContent = ''; this.innerHTML = ''; this.disabled = false; this.classList = { toggle() {} }; this.handlers = {}; this.dataset = {}; }
  addEventListener(name, fn) { this.handlers[name] = fn; }
  querySelectorAll() { return []; }
  dispatchEvent() {}
}

function setup({ canAdmin = true, canPublish = false, canRecalculate = false } = {}) {
  const nodes = new Map();
  let markup = '';
  const host = {
    set innerHTML(value) {
      markup = value;
      for (const match of value.matchAll(/\bid="([^"]+)"/g)) nodes.set(match[1], new Element(match[1]));
    },
    get innerHTML() { return markup; },
    querySelector(selector) { return nodes.get(selector.slice(1)) || null; },
    querySelectorAll(selector) { return selector === '[data-draft-only]' ? ['doe-policy-save', 'doe-policy-validate', 'doe-policy-impact'].map(id => nodes.get(id)) : []; }
  };
  const calls = [];
  let policy = null;
  const api = {
    doeActivePolicy: async args => { calls.push(['active', args]); return policy; },
    doePolicyVersion: async args => { calls.push(['version', args]); return policy; },
    doePolicyHistory: async args => { calls.push(['history', args]); return []; },
    createDoePolicyDraft: async args => { calls.push(['create', args]); policy = { version: { policyVersionId: 'p-1', academicYear: args.academicYear, status: 'draft', revision: 1 }, rules: [], references: [], courseMappings: [], subjectMappings: [], exceptions: [], reservePolicy: {} }; return policy; },
    copyDoePolicy: async args => { calls.push(['copy', args]); return policy; },
    saveDoePolicyDraft: async (id, args) => { calls.push(['save', id, args]); policy = { ...policy, version: { ...policy.version, revision: policy.version.revision + 1 } }; return policy; },
    validateDoePolicyDraft: async (id, args) => { calls.push(['validate', id, args]); return { valid: true, errors: [], warnings: [] }; },
    previewDoePolicyImpact: async (id, args) => { calls.push(['impact', id, args]); return { assignmentsEvaluated: 0 }; },
    publishDoePolicyDraft: async (id, args) => { calls.push(['publish', id, args]); return {}; },
    archiveDoePolicy: async (id, args) => { calls.push(['archive', id, args]); return policy; },
    recalculateDoe: async args => { calls.push(['recalculate', args]); return { recordsCreated: 0, remaining: 0 }; }
  };
  const window = {};
  vm.runInNewContext(fs.readFileSync('faculty-admin-doe-policy.js', 'utf8'), { window }, { filename: 'faculty-admin-doe-policy.js' });
  const view = window.UCVM_FACULTY_DOE_POLICY.create({ api, getAcademicYear: () => '2026-27', canAdmin: () => canAdmin, canPublish: () => canPublish, canRecalculate: () => canRecalculate });
  view.mount(host);
  return { view, host, nodes, calls };
}

test('Annual Rule Book presents the required annual lifecycle and relational editor sections', () => {
  const { host, nodes } = setup();
  for (const text of ['DOE Rules', 'Academic Year', 'Policy Version', 'Course Mapping', 'VISC Subjects', 'Preview &amp; Validate', 'History', 'Publish', 'Archive Draft', 'Recalculate']) assert.ok(host.innerHTML.includes(text), text);
  assert.match(host.innerHTML, /id="doe-policy-year" value="2026-27"/);
  assert.equal(nodes.get('doe-policy-publish').disabled, true);
  assert.equal(nodes.get('doe-policy-recalculate').disabled, true);
});

test('draft editing sends normalized policy collections and a revision precondition to the API', async () => {
  const { nodes, calls } = setup();
  await nodes.get('doe-policy-new-draft').handlers.click();
  assert.deepEqual(JSON.parse(JSON.stringify(calls.find(([name]) => name === 'create')[1])), { academicYear: '2026-27', versionLabel: '', sourceReference: '' });
  nodes.get('doe-policy-rules').value = '[{"ruleKey":"lecture","category":"assigned_teaching"}]';
  nodes.get('doe-policy-references').value = '[{"title":"UCVM Workload Guidelines","section":"4"}]';
  nodes.get('doe-policy-reserve').value = '{"splitThreshold":0.5}';
  await nodes.get('doe-policy-save').handlers.click();
  const save = calls.find(([name]) => name === 'save');
  assert.equal(save[1], 'p-1');
  assert.equal(save[2].expectedRevision, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(save[2].patch.rules)), [{ ruleKey: 'lecture', category: 'assigned_teaching' }]);
  assert.deepEqual(JSON.parse(JSON.stringify(save[2].patch.references)), [{ title: 'UCVM Workload Guidelines', section: '4' }]);
  assert.deepEqual(JSON.parse(JSON.stringify(save[2].patch.reservePolicy)), { splitThreshold: 0.5 });
});

test('publishing and recalculation controls stay independently capability-gated', () => {
  const { nodes } = setup({ canAdmin: true, canPublish: false, canRecalculate: false });
  assert.equal(nodes.get('doe-policy-publish').disabled, true);
  assert.equal(nodes.get('doe-policy-recalculate').disabled, true);
});
