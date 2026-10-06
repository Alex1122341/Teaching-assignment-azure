'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('timetable loads the legacy multi-edit controller but keeps its write controls closed',()=>{
 const html=read('index.html'),js=read('timetable.js');
 assert.ok(html.indexOf('timetable-selection.js')<html.indexOf('timetable.js'));
 assert.ok(html.indexOf('faculty-doe.js')<html.indexOf('timetable.js'));
 for(const id of ['select-sessions-btn','selection-cancel-btn','review-selected-btn','selection-count'])assert.match(html,new RegExp(`id=["']${id}["']`));
 assert.match(js,/\$\('selection-controls'\)\.classList\.add\('hidden'\)/);
 assert.match(js,/async function startSessionSelection\(\)\{\s*if\(!requireSessionWrites\(\)\)return/);
});

test('faculty choices use effective DOE and visibly label overrides',()=>{
 const js=read('timetable.js');
 assert.match(js,/UCVM_FACULTY_DOE\.effectiveTarget/);
 assert.match(js,/Override DOE/);
 assert.doesNotMatch(js,/Contract Teaching DOE is shown when it exists/);
});

test('selection mode is hidden until an authorized session API capability exists',()=>{
 const js=read('timetable.js');
 const client=read('paws-data-client.js');
 assert.match(js,/\$\('selection-controls'\)\.classList\.add\('hidden'\)/);
 assert.match(client,/sessionWritesEnabled:\(\)=> false/);
 assert.match(client,/sessionEditEnabled:\(\)=> writeCapabilities\.sessionEdit===true/);
 assert.match(js,/async function saveSelectedChanges\(\)[\s\S]*?PAWS University API supports this operation[\s\S]*?return false/);
});

test('legacy spreadsheet mutation flow is dormant pending the trusted API',()=>{
 const js=read('timetable.js');
 const writer=js.match(/async function saveSelectedChanges\(\)\{([\s\S]*?)\n  \}/);
 assert.ok(writer);
 assert.match(writer[1],/PAWS University API supports this operation/);
 assert.doesNotMatch(writer[1],/batch|\.set\(|\.update\(|\.delete\(/);
});

test('back to selection rerenders immediately instead of relying on a subscription change',()=>{
 const js=read('timetable.js');
 const match=js.match(/\$\('selection-back-btn'\)\.onclick=\(\)=>\{([^}]*)\}/);
 assert.ok(match,'selection back handler must exist');
 const handler=match[1];
 assert.match(handler,/reviewingSelection=false/);
 assert.match(handler,/viewMode=selectionViewFlow\.finish\(\)/);
 assert.match(handler,/render\(\)/);
});
