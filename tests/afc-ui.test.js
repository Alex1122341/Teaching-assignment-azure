'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('timetable retains AFC panel navigation and loads the SQL workflow first',()=>{
 const html=read('index.html');
 for(const id of ['afc-request-btn','afc-panel'])assert.match(html,new RegExp(`id="${id}"`));
 assert.ok(html.indexOf('afc-workflow-sql.js')<html.indexOf('afc-workflow.js'));
 assert.doesNotMatch(html,/afc-actions\.js/);
});

test('Firestore AFC writer modules are absent or fail closed',()=>{
 const workflow=read('afc-workflow.js'),actions=read('afc-actions.js');
 assert.match(workflow,/browser Firestore submission is disabled/);
 assert.doesNotMatch(workflow,/collection\(['"]afc_requests['"]\)/);
 assert.match(actions,/direct Firestore mutation is disabled/);
 assert.doesNotMatch(actions,/batch\.(?:set|update|delete)\(/);
});

test('public read compatibility and authorized signature capture remain separate from AFC writes',()=>{
 const html=read('index.html'),sql=read('afc-workflow-sql.js'),client=read('paws-data-client.js');
 assert.match(html,/signature-capture\.js/);
 assert.match(sql,/listAfcRequests/);
 assert.match(client,/api\/v1\/afc-requests/);
});
