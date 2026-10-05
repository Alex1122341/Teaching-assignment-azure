'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sourceFunction = require('../test-support/source-function');

const root = path.resolve(__dirname, '..');

function render(contractDoe) {
  const context = {
    number: value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value),
    esc: value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character])),
    formatDoe: value => value === null || value === undefined ? 'DOE unavailable' : `${Number(value).toFixed(2)}%`
  };
  vm.createContext(context);
  vm.runInContext(`${sourceFunction('faculty-admin.js', 'renderContractDoe')}\nthis.renderContractDoe=renderContractDoe;`, context);
  return context.renderContractDoe(contractDoe);
}

test('Faculty page distinguishes contract target allocations from assigned and role DOE, preserving zeros and omitting blank categories', () => {
  const source = fs.readFileSync(path.join(root, 'faculty-admin.js'), 'utf8');
  assert.match(source, /renderContractDoe\(data\.contractDoe/);
  const html = render({
    academicYear: '2026-27', teachingDoe: 0, source: 'DOE snapshot', policyVersionLabel: 'Faculty Master List DOE snapshot 2026-10-04',
    sourceReference: 'Faculty Master List.xlsx / DOE Summary',
    allocations: [
      { categoryCode: 'research', allocationDoe: 45 },
      { categoryCode: 'service_admin', allocationDoe: 0 }
    ]
  });
  assert.match(html, /Contract DOE Allocation/);
  assert.match(html, /Teaching[\s\S]*?0\.00%/);
  assert.match(html, /Research[\s\S]*?45\.00%/);
  assert.match(html, /Service \/ Admin[\s\S]*?0\.00%/);
  assert.match(html, /Total Contract DOE[\s\S]*?45\.00%/);
  assert.match(html, /Faculty Master List DOE snapshot/);
  assert.match(html, /2026-27/);
  assert.doesNotMatch(html, /PPVM Cost Share/);
  assert.doesNotMatch(html, /Assigned Teaching DOE|Role DOE/);
});

test('Faculty page shows unavailable Teaching and a partial source total without inventing optional zeros', () => {
  const html = render({ academicYear: '2026-27', teachingDoe: null, allocations: [] });
  assert.match(html, /Teaching DOE unavailable/);
  assert.match(html, /Total Contract DOE[\s\S]*?DOE unavailable/);
  assert.match(html, /2026-27/);
  assert.doesNotMatch(html, /Research|Service \/ Admin|0\.00%/);
});
