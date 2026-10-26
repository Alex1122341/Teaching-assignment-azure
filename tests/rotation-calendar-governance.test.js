'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process');
const freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze');
const root=path.resolve(__dirname,'..'),BASE='62dfa3c120467c1c7e23440c4f8500f444322382',PRODUCT='a28f02dc7f0fcd965b963f6c31a5d0890ec71210';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
test('Rotation promotion pins the independently reviewed product and preserves the complete static union',()=>{
 assert.equal(freeze.BASELINE_COMMIT,PRODUCT);assert.equal(api.BASELINE_COMMIT,PRODUCT);assert.equal(require('../tools/beta-baseline.json').sourceCommit,PRODUCT);
 git('merge-base','--is-ancestor',BASE,PRODUCT);git('merge-base','--is-ancestor',PRODUCT,'HEAD');
 const before=freeze.readBaselineManifest({root,baselineCommit:BASE}),after=freeze.readBaselineManifest({root,baselineCommit:PRODUCT});
 assert.equal(before.length,92);assert.equal(after.length,93);assert.deepEqual(before.filter(file=>!after.includes(file)),[]);
 assert.deepEqual(after.filter(file=>!before.includes(file)),['calendar-activity-placement.js']);
 assert.equal(freeze.protectedPaths({root,readManifest:()=>['index.html']}).length,93);
});
test('Rotation product changes only its nine frontend sources and retains existing approval and history bytes',()=>{
 assert.deepEqual(git('diff','--name-only',BASE,PRODUCT,'--','frontend').split('\n'),[
  'frontend/pages/faculty-admin.html','frontend/pages/index.html','frontend/scripts/calendar-activities.js','frontend/scripts/calendar-activity-placement.js','frontend/scripts/calendar-search.js','frontend/scripts/faculty-admin.js','frontend/scripts/timetable.js','frontend/styles/calendar-activities.css','frontend/styles/timetable.css']);
 const changed=['faculty-admin.html','index.html','calendar-activities.js','calendar-search.js','faculty-admin.js','timetable.js','calendar-activities.css','timetable.css'];
 for(const file of freeze.readBaselineManifest({root,baselineCommit:BASE}).filter(file=>!changed.includes(file)))assert.ok(freeze.bytesMatch(freeze.readBaselineFile({root,baselineCommit:BASE,file}),freeze.readBaselineFile({root,baselineCommit:PRODUCT,file})),file);
 assert.equal(freeze.verifyFreeze({root}).ok,true);
});
test('Rotation promotion preserves every API input and all SQL permissions rules and dependencies',()=>{
 const before=api.baselineRuntimeFiles({root,baselineCommit:BASE}),after=api.baselineRuntimeFiles({root,baselineCommit:PRODUCT});assert.deepEqual(after,before);assert.equal(after.length,116);
 const files=[...after,...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES];assert.equal(files.length,119);
 for(const file of files)assert.ok(api.bytesMatch(api.readBaselineFile({root,baselineCommit:BASE,file}),api.readBaselineFile({root,baselineCommit:PRODUCT,file})),file);
 assert.equal(git('diff','--name-only',BASE,PRODUCT,'--','server','swa-api','database','firestore.rules','firestore.indexes.json','package.json','package-lock.json',':(exclude)server/test'),'');
 assert.equal(git('diff','--name-only',BASE,PRODUCT,'--','server/test'),'server/test/ccc-master-slots.test.js');
 assert.equal(api.verifyFreeze({root}).ok,true);
});
