'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('shared deployment allowlist includes every bulk import recovery runtime asset',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'tools/static-assets.json'),'utf8'));
 for(const name of ['bulk-import-core.js','bulk-import-backup.js','bulk-import-firestore.js','bulk-import-controller.js','bulk-import-ui.js','maintenance-state.js'])assert.ok(manifest.includes(name),name);
});

test('the API-only Faculty Dashboard no longer loads the bulk import runtime',()=>{
 const html=fs.readFileSync(path.join(root,'faculty-admin.html'),'utf8');
 for(const name of ['maintenance-state.js','bulk-import-core.js','bulk-import-backup.js','bulk-import-firestore.js','bulk-import-controller.js','bulk-import-ui.js'])assert.equal(html.includes(name),false,`${name} must not load on the API-only Dashboard`);
});
