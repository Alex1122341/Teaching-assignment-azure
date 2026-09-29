const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = ['faculty-admin.html','faculty-admin.js','faculty-admin.css']
  .map(name=>fs.readFileSync(path.resolve(__dirname, '..', name), 'utf8')).join('\n');

test('Assigned AD is removed from faculty lookup, editor, filters, and exports', () => {
  assert.doesNotMatch(source, /id="filter-ad"|field\('Assigned AD'|\['assignedAD'|\['assignedAD','Assigned AD'/);
});

test('the Dashboard no longer carries a DOE override badge or a legacy numeric adapter', () => {
  assert.equal(source.includes('doeOverride2026_27'), false);
  assert.equal(source.includes('overrideBadge'), false);
  assert.equal(source.includes('Office DOE Override'), false);
  assert.equal(/UCVM\./.test(source), false);
});
