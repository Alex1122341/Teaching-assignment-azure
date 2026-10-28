'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { inspect } = require('../tools/testing/feature-readiness');

test('Testing release inventory includes every critical PAWS business area', () => {
  const rows = inspect();
  const names = new Set(rows.map(row => row.feature));
  assert.equal(names.size, rows.length);
  for (const name of ['Identity', 'Timetable', 'Session editing', 'Faculty Dashboard',
    'Faculty write', 'DOE policies', 'AFC records', 'AFC approval', 'CCC',
    'Teaching assignments', 'Reports', 'Change history', 'Support personas']) {
    assert.ok(names.has(name), 'missing release family: ' + name);
  }
  for (const row of rows) {
    assert.equal(row.accepted, false, 'source scanning cannot prove live acceptance');
    assert.match(row.acceptance, /LIVE_UAT/);
  }
});

test('source inventory shows current missing Testing API coverage instead of claiming parity', () => {
  const rows = inspect();
  assert.ok(rows.some(row => !row.testingRuntimeReferenced));
  assert.ok(rows.some(row => row.testingRuntimeReferenced));
});
