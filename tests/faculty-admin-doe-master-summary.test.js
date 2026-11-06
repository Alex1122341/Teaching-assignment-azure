'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const names = require('../frontend/scripts/faculty-name');

async function render(worksheet) {
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
  await view.loadDetail('faculty-1', worksheet.academicYear || '2026-27', panel, () => true);
  return panel.innerHTML;
}

function summaryEntries(html) {
  const summary = html.match(/<dl class="p4-doe-worksheet-summary">([\s\S]*?)<\/dl>/)?.[1] || '';
  return [...summary.matchAll(/<dt>(.*?)<\/dt><dd>(.*?)<\/dd>/g)].map(match => [match[1], match[2]]);
}

test('MASTER summary uses structured preferred names over a reversed stored display label',async()=>{
 const html=await render({displayName:'Douglas, Morck',preferredFirstName:'Douglas',preferredLastName:'Morck',academicYear:'2026-27',target:{},totals:{},lines:[]});
 assert.deepEqual(summaryEntries(html)[0],['Faculty Name','Morck, Douglas']);
});

test('worksheet presents the eight MASTER fields from independent API values and selected year', async () => {
  const worksheet = { facultyId: 'faculty-1', displayName: 'de la Cruz, Mary Jane', academicYear: '2027-28', status: 'calculated',
    target: { contractTeachingDoe: 30, contractClinicalTeachingDoe: 12, effectiveTargetDoe: 24, potentialGradTeachingDoe: 4 },
    totals: { assignedTeachingDoe: 19, remainingDoe: 5, adjustmentDoe: 1.5, scheduledTeachingDoe: 99, roleDoe: 88 },
    lines: [{ category: 'teaching', activityType: 'Lecture', scopeText: 'Evidence <course>', resultDoe: 19, status: 'recorded', reference: { title: 'Retained source' } }] };
  const original = JSON.stringify(worksheet);
  const html = await render(worksheet);
  assert.deepEqual(summaryEntries(html), [
    ['Faculty Name', 'de la Cruz, Mary Jane'], ['Contracted Teaching (%)', '30.00%'],
    ['Contracted Clinical Teaching (%)', '12.00%'], ['Expected 2027-28 Teaching (%)', '24.00%'],
    ['Assigned Teaching (%)', '19.00%'], ['% Difference (Expected - Assigned)', '5.00%'],
    ['Potential Grad Teaching', '4.00%'], ['Adjustment', '1.50%']
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
    totals: { assignedTeachingDoe: 0, remainingDoe: null, adjustmentDoe: 0 }, errors: [{ code: 'DOE_TARGET_UNAVAILABLE' }] });
  assert.deepEqual(summaryEntries(html), [
    ['Faculty Name', 'None'], ['Contracted Teaching (%)', 'None'], ['Contracted Clinical Teaching (%)', '0.00%'],
    ['Expected 2026-27 Teaching (%)', 'None'], ['Assigned Teaching (%)', '0.00%'],
    ['% Difference (Expected - Assigned)', 'None'], ['Potential Grad Teaching', 'None'], ['Adjustment', '0.00%']
  ]);
  assert.match(html, /Teaching balance: <strong>None<\/strong>/);
  assert.match(html, /Awaiting data \/ policy/);
});

test('balance uses supplied difference, signed values and words for all three states', async () => {
  for (const [remainingDoe, expectedValue, label, tone] of [[5, '5.00%', '5.00% Remaining', 'remaining'], [-2, '-2.00%', '2.00% Over', 'over'], [0, '0.00%', 'At expected', 'at']]) {
    const html = await render({ academicYear: '2026-27', status: 'calculated', target: { effectiveTargetDoe: 50 }, totals: { assignedTeachingDoe: 1, remainingDoe } });
    assert.equal(summaryEntries(html)[5][1], expectedValue);
    assert.ok(html.includes(`Teaching balance: <strong>${label}</strong>`));
    assert.ok(html.includes(`doe-master-balance-${tone}`));
  }
});

test('worksheet uses the shared idempotent formatter and escapes name output', async () => {
  for (const [input, expected] of [
    [{ preferredLastName: 'de la Cruz', preferredFirstName: 'Mary Jane' }, 'de la Cruz, Mary Jane'],
    ['Müller, Élodie', 'Müller, Élodie'], ['TBD', 'TBD']
  ]) {
    const canonical = names.format(input);
    assert.equal(canonical, expected);
    assert.equal(names.format(canonical), expected);
    assert.equal(summaryEntries(await render({ displayName: canonical, totals: {} }))[0][1], expected);
  }
  assert.equal(names.formatList('Doe, Jane; Smith, John'), 'Doe, Jane; Smith, John');
  const html = await render({ displayName: '<img onerror=bad>', academicYear: '2026-27', totals: {} });
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});
