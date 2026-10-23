const { repositoryPath } = require('../tools/build/frontend-paths');
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const root=repositoryPath(__dirname,'..');
const {functionBody}=require('../test-support/source-contract.js');
const read=name=>fs.readFileSync(repositoryPath(root,name),'utf8');

test('assigned faculty replacement uses the live session object already owned by the session modal',()=>{
 const src=read('approval-workflow.js');
 const slice=functionBody(src,'function openFacultySession(s)');
 assert.ok(slice,'openFacultySession must exist');
 const body=slice.body;
 assert.match(body,/window\.UCVM_SAFE_SWAP\?\.openSelfReplacement/);
 assert.match(body,/openSelfReplacement\(s\)/);
 assert.match(body,/own\.length/);
});

test('replacement button is not intercepted by a second session-resolution listener',()=>{
 const src=read('faculty-swap-handoff.js');
 assert.doesNotMatch(src,/#workflow-self-swap/);
 assert.doesNotMatch(src,/stopImmediatePropagation/);
});
