'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const runtimeCopyFiles = ['index.html', 'faculty-admin.html', 'faculty-admin.js', 'faculty-admin-enhancements.js', 'timetable.js', 'afc-workflow.js', 'user-management.html', 'user-management.js', 'faculty-access.js'];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('current UI identifies VetMed-Ops and the PAWS University API as the business-data path', () => {
  const html = read('faculty-admin.html');
  const timetable = read('timetable.js');
  assert.match(html, /VetMed-Ops teaching data/);
  assert.match(html, /PAWS University API/);
  assert.match(timetable, /VetMed-Ops/);
  assert.match(timetable, /PAWS University API/);
});

test('current UI does not describe business data as Azure SQL or current admin roles by retired labels', () => {
  const combined = runtimeCopyFiles.map(file => `${file}\n${read(file)}`).join('\n');
  assert.doesNotMatch(combined, /Beta\s*[·|-]\s*Azure SQL teaching data|PAWS Azure SQL Beta API|Azure SQL timetable|Azure SQL summary|Azure SQL Beta/i);
  assert.doesNotMatch(combined, /ADFA General|ADFA Regular/);
});
