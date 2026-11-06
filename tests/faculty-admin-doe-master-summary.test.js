'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const names = require('../frontend/scripts/faculty-name');

async function render(worksheet, options) {
  const context = { window: { PAWS_FACULTY_NAME: names } };
  vm.runInNewContext(fs.readFileSync('frontend/scripts/faculty-admin-doe-worksheet.js', 'utf8'), context);
  const view = context.window.UCVM_FACULTY_DOE_WORKSHEET.create({
    api: { doeWorksheet: async () => worksheet },
    escapeHtml: value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]),
    formatDoe: value => value == null ? 'Needs Review' : `${Number(value).toFixed(2)}%`,
    finiteDoe: value => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value),
    getFaculty: () => [], getAcademicYear: () => '2026-27', editAction: () => '', onView() {}
  });
  const panel = { isConnected: true, innerHTML: '' };
  await view.loadDetail('faculty-1', worksheet.academicYear || '2026-27', panel, () => true, options);
  return panel.innerHTML;
}

function summaryEntries(html) {
  const summary = html.match(/<dl class="p4-doe-worksheet-summary">([\s\S]*?)<\/dl>/)?.[1] || '';
  return [...summary.matchAll(/<dt>(.*?)<\/dt><dd>(.*?)<\/dd>/g)].map(match => [match[1], match[2]]);
}

test('MASTER summary leaves the faculty name to the profile header',async()=>{
 const html=await render({displayName:'Douglas, Morck',preferredFirstName:'Douglas',preferredLastName:'Morck',academicYear:'2026-27',target:{},totals:{},lines:[]});
 assert.equal(summaryEntries(html).length, 9);
 assert.doesNotMatch(html, /Faculty Name|Morck, Douglas|Douglas, Morck/);
});

test('embedded worksheet presents summary first and keeps errors visible above closed calculation details', async () => {
  const html = await render({ academicYear: '2026-27', status: 'needs_review', target: {}, totals: {},
    errors: [{ code: 'MISSING_SOURCE', message: 'Confirm course evidence' }],
    lines: [{ category: 'teaching', activityType: 'Lecture', resultDoe: null, status: 'needs_review' }] }, { embedded: true });
  assert.doesNotMatch(html, /class="section-title">Faculty DOE Worksheet/);
  assert.match(html, /<details class="doe-calculation-details"><summary>Calculation details · 1 source line<\/summary>/);
  const calculationStart = html.indexOf('<details class="doe-calculation-details">');
  assert.ok(html.indexOf('<dl class="p4-doe-worksheet-summary">') < calculationStart);
  assert.ok(html.indexOf('Confirm course evidence') < calculationStart);
  assert.ok(html.indexOf('Source requires review') < calculationStart);
  assert.doesNotMatch(html, /<details class="doe-calculation-details"[^>]*\bopen\b/);
});

test('worksheet presents the MASTER teaching fields and contract allocations from independent API values and selected year', async () => {
  const worksheet = { facultyId: 'faculty-1', displayName: 'de la Cruz, Mary Jane', academicYear: '2027-28', status: 'calculated',
    target: { contractTeachingDoe: 30, contractClinicalTeachingDoe: 12, effectiveTargetDoe: 24, potentialGradTeachingDoe: 4 },
    totals: { assignedTeachingDoe: 19, remainingDoe: 5, adjustmentDoe: 1.5, scheduledTeachingDoe: 99, roleDoe: 88 },
    lines: [{ category: 'teaching', activityType: 'Lecture', scopeText: 'Evidence <course>', resultDoe: 19, status: 'recorded', reference: { title: 'Retained source' } }] };
  const original = JSON.stringify(worksheet);
  const html = await render(worksheet, { contractDoe: { academicYear: '2027-28', allocations: [
    { categoryCode: 'contract_admin', allocationDoe: 0 }, { categoryCode: 'service_admin', allocationDoe: 18 }
  ] } });
  assert.deepEqual(summaryEntries(html), [
    ['Contracted Teaching (%)', '30.00%'],
    ['Contracted Clinical Teaching (%)', '12.00%'], ['Contract Admin (%)', '0.00%'], ['Expected 2027-28 Teaching (%)', '24.00%'],
    ['Assigned Teaching (%)', '19.00%'], ['% Difference (Expected - Assigned)', '5.00%'],
    ['Service / Admin (%)', '18.00%'], ['Potential Grad Teaching', '4.00%'], ['Adjustment', '1.50%']
  ]);
  assert.match(html, /Teaching balance: <strong>5\.00% Remaining<\/strong> · 1 source line/);
  assert.match(html, /Evidence &lt;course&gt;/);
  assert.match(html, /Retained source/);
  assert.match(html, /Assigned Teaching DOE · Excel-style Breakdown/);
  assert.match(html, /Current saved Worksheet Total Assigned: 19\.00%/);
  assert.equal(JSON.stringify(worksheet), original);
});

test('missing MASTER values remain None while real zeros remain numeric', async () => {
  const html = await render({ academicYear: '2026-27', status: 'needs_review',
    target: { contractTeachingDoe: null, contractClinicalTeachingDoe: 0, effectiveTargetDoe: undefined, potentialGradTeachingDoe: '' },
    totals: { assignedTeachingDoe: 0, remainingDoe: null, adjustmentDoe: 0 }, errors: [{ code: 'DOE_TARGET_UNAVAILABLE' }] }, { contractDoe: { academicYear: '2025-26', allocations: [{ categoryCode: 'service_admin', allocationDoe: 12 }] } });
  assert.deepEqual(summaryEntries(html), [
    ['Contracted Teaching (%)', 'None'], ['Contracted Clinical Teaching (%)', '0.00%'], ['Contract Admin (%)', 'None'],
    ['Expected 2026-27 Teaching (%)', 'None'], ['Assigned Teaching (%)', '0.00%'],
    ['% Difference (Expected - Assigned)', 'None'], ['Service / Admin (%)', 'None'], ['Potential Grad Teaching', 'None'], ['Adjustment', '0.00%']
  ]);
  assert.match(html, /Teaching balance: <strong>None<\/strong>/);
  assert.match(html, /Awaiting data \/ policy/);
});

test('balance uses supplied difference, signed values and words for all three states', async () => {
  for (const [remainingDoe, expectedValue, label, tone] of [[5, '5.00%', '5.00% Remaining', 'remaining'], [-2, '-2.00%', '2.00% Over', 'over'], [0, '0.00%', 'At expected', 'at']]) {
    const html = await render({ academicYear: '2026-27', status: 'calculated', target: { effectiveTargetDoe: 50 }, totals: { assignedTeachingDoe: 1, remainingDoe } });
    assert.equal(summaryEntries(html).find(([label]) => label.startsWith('% Difference'))[1], expectedValue);
    assert.ok(html.includes(`Teaching balance: <strong>${label}</strong>`));
    assert.ok(html.includes(`doe-master-balance-${tone}`));
  }
});
