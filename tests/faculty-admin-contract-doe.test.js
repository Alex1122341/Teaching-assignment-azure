'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const rendererSource = fs.readFileSync(path.join(root, 'faculty-admin-doe-renderer.js'), 'utf8');

function createRenderer({ esc, number, formatDoe } = {}) {
  const context = {
    window: {},
    esc: esc || (value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]))),
    number: number || (value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value)),
    formatDoe: formatDoe || (value => value === null || value === undefined ? 'DOE unavailable' : `${Number(value).toFixed(2)}%`),
    display: value => String(value ?? '—'),
    effectiveRoleDoe: () => ({ mapped: null, override: null, effective: null }),
    groupTeachingAssignments: () => []
  };
  vm.createContext(context);
  vm.runInContext(rendererSource, context);
  return context.window.UCVM_FACULTY_DOE_RENDERER.create(context);
}

function render(contractDoe) {
  return createRenderer().renderContractDoe(contractDoe);
}

function renderWithFaculty(contractDoe, faculty) {
  return createRenderer().renderContractDoe(contractDoe, faculty);
}

function renderRuleBook(ruleBook) {
  return createRenderer().renderDoeRuleBook(ruleBook);
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
  assert.match(html, /Workload \/ Contract/);
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

test('Faculty page presents FTE and its provenance separately from contract DOE totals', () => {
  const html = renderWithFaculty({
    academicYear: '2026-27', teachingDoe: 20, source: '2026-27 snapshot',
    allocations: [{ categoryCode: 'research', allocationDoe: 30 }]
  }, { fte: 0, fteSourceReference: 'PAWS_DOE_FTE_Import_2026-27.csv · SHA-256 verified', fteSourceRow: 7 });
  assert.match(html, /FTE[\s\S]*?0\.00/);
  assert.match(html, /FTE source[\s\S]*?PAWS_DOE_FTE_Import_2026-27\.csv/);
  assert.match(html, /Total Contract DOE[\s\S]*?50\.00%/);
  assert.doesNotMatch(html.slice(html.indexOf('Total Contract DOE')), /FTE/);
});

test('Faculty page renders versioned DOE rule values, references, and no-inference limitations', () => {
  const html = renderRuleBook({
    academicYear: '2026-27', policyVersionLabel: 'DOE/FTE source 2026-27',
    sourceReference: 'UCVM Workload Guidelines, updated 2025-12-23',
    rules: [
      { category: 'Assigned Teaching', ruleLabel: 'Lecture', rateOrTierPct: '0.30%', basis: 'per contact hour', requiredInput: 'contact hours', calculationOrNote: 'Only with evidence', sourceReference: 'UCVM Workload Guidelines' },
      { category: 'HICC Development', ruleLabel: 'New curriculum', rateOrTierPct: '2%', academicYearOrStage: 'curriculum finalization dependent', calculationOrNote: 'Only while development remains applicable' },
      { category: 'Research', ruleLabel: 'Research expectation ranges', calculationOrNote: 'Not a formula for individual contract DOE' }
    ]
  });
  assert.match(html, /DOE Rule Reference/);
  assert.match(html, /DOE\/FTE source 2026-27/);
  assert.match(html, /Lecture[\s\S]*?0\.30%[\s\S]*?per contact hour/);
  assert.match(html, /curriculum finalization dependent/);
  assert.match(html, /do not infer individual Research, PPVM, Service\/Admin/);
});
