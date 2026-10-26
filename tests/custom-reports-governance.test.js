'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process');
const freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze');
const root=path.resolve(__dirname,'..'),MAIN='c0970cafddb53187906ba3257cfa81c9d31293eb',PRODUCT='a0c1adebf858fe54b632b71930622572ebddc90e';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
test('custom reports promotion pins the reviewed product and protects every previous static asset',()=>{
 assert.equal(freeze.BASELINE_COMMIT,PRODUCT);assert.equal(api.BASELINE_COMMIT,PRODUCT);assert.equal(require('../tools/beta-baseline.json').sourceCommit,PRODUCT);
 git('merge-base','--is-ancestor',MAIN,PRODUCT);git('merge-base','--is-ancestor',PRODUCT,'HEAD');
 const before=freeze.readBaselineManifest({root,baselineCommit:MAIN}),after=freeze.readBaselineManifest({root,baselineCommit:PRODUCT});assert.equal(before.length,93);assert.equal(after.length,95);assert.deepEqual(before.filter(file=>!after.includes(file)),[]);assert.deepEqual(after.filter(file=>!before.includes(file)).sort(),['faculty-reports.css','faculty-reports.js']);assert.equal(freeze.protectedPaths({root,readManifest:()=>['index.html']}).length,95);
 for(const file of before.filter(file=>!['faculty-admin.html','asset-loader.js','faculty-admin.js','paws-data-client.js'].includes(file)))assert.ok(freeze.bytesMatch(freeze.readBaselineFile({root,baselineCommit:MAIN,file}),freeze.readBaselineFile({root,baselineCommit:PRODUCT,file})),file);
 assert.equal(freeze.verifyFreeze({root}).ok,true);
});
test('reports add only five API runtime modules and preserve SQL migrations dependencies and write gates',()=>{
 const before=api.baselineRuntimeFiles({root,baselineCommit:MAIN}),after=api.baselineRuntimeFiles({root,baselineCommit:PRODUCT});assert.equal(before.length,116);assert.equal(after.length,121);assert.deepEqual(before.filter(file=>!after.includes(file)),[]);assert.deepEqual(after.filter(file=>!before.includes(file)).sort(),['server/src/reports/report-api.js','server/src/reports/report-definition.js','server/src/reports/report-export.js','server/src/reports/report-sources.js','server/src/runtime/swa-report-functions.js']);
 const changed=['server/src/data/sql-dashboard-repository.js','server/src/data/sql-session-repository.js','server/src/runtime/swa-sql-runtime.js','swa-api/index.js'];for(const file of before.filter(file=>!changed.includes(file)))assert.ok(api.bytesMatch(api.readBaselineFile({root,baselineCommit:MAIN,file}),api.readBaselineFile({root,baselineCommit:PRODUCT,file})),file);
 assert.equal(after.length+api.BUILD_DEFINITION_FILES.length+api.REPOSITORY_INPUT_FILES.length,124);
 assert.equal(git('diff','--name-only',MAIN,PRODUCT,'--','database','firestore.rules','firestore.indexes.json','package.json','package-lock.json','server/package.json','server/package-lock.json','deploy/aca/Dockerfile','server/src/data/write-gates.js'),'');assert.equal(api.verifyFreeze({root}).ok,true);
});
