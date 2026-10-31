'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),{execFileSync}=require('node:child_process');
const freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze');
const root=path.resolve(__dirname,'..'),previous='09ae583238f5be04627ea41c8895614b82c97e19',product='079655e1d81c7240a70d6b2f70b669ba308111b0';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();

test('historical verified DOE reconciliation protects the independently reviewed runtime changes',()=>{
 const historicalReport=JSON.parse(git('show','948ce63189ce10af765bfb169575f9b89447b193:tools/beta-baseline.json'));
 assert.ok(git('show','948ce63189ce10af765bfb169575f9b89447b193:tools/beta-freeze.js').includes("const BASELINE_COMMIT='"+product+"'"));
 assert.equal(historicalReport.sourceCommit,product);
 git('merge-base','--is-ancestor',product,freeze.BASELINE_COMMIT);assert.equal(api.BASELINE_COMMIT,freeze.BASELINE_COMMIT);
 assert.ok(git('show','a7cc4d3e3a4c09528906b9fce076d6c874699264:tools/beta-freeze.js').includes(`const BASELINE_COMMIT='${previous}'`));
 git('merge-base','--is-ancestor',previous,product);git('merge-base','--is-ancestor',product,'HEAD');
 assert.equal(git('diff','--name-only',previous,product,'--','frontend'),['frontend/scripts/faculty-admin-doe-worksheet.js','frontend/styles/faculty-admin.css'].join('\n'));
 assert.equal(git('diff','--name-only',previous,product,'--','server/src','swa-api'),[
  'server/src/data/sql-doe-worksheet-repository.js','server/src/doe/doe-assignment-service.js',
  'server/src/domain/doe-calculator.js','server/src/domain/doe-rule-book.js'].join('\n'));
 const before=JSON.parse(git('show','a7cc4d3e3a4c09528906b9fce076d6c874699264:tools/beta-baseline.json'));
 const expected={...before.sha256};
 for(const file of ['faculty-admin-doe-worksheet.js','faculty-admin.css'])expected[file]=freeze.sha256Canonical(freeze.readBaselineFile({root,baselineCommit:product,file}));
 assert.deepEqual(historicalReport.sha256,expected);
 assert.deepEqual(freeze.readBaselineManifest({root,baselineCommit:product}),freeze.readBaselineManifest({root,baselineCommit:previous}));
 assert.deepEqual(api.baselineRuntimeFiles({root,baselineCommit:product}),api.baselineRuntimeFiles({root,baselineCommit:previous}));
 assert.equal(git('diff','--name-only',previous,product,'--','tools/static-assets.json','package.json','package-lock.json','server/package.json','server/package-lock.json','deploy/aca/Dockerfile','database','firestore.rules','firestore.indexes.json'),'');
 const historicalStatic={root,baselineCommit:product,readWorking:({file})=>freeze.readBaselineFile({root,baselineCommit:product,file})};
 const historicalApi={root,baselineCommit:product,readWorking:({file})=>api.readBaselineFile({root,baselineCommit:product,file})};
 assert.equal(freeze.protectedPaths(historicalStatic).length,96);assert.equal(freeze.verifyFreeze(historicalStatic).ok,true);
 assert.equal(api.baselineRuntimeFiles({root,baselineCommit:product}).length,133);assert.equal(api.verifyFreeze(historicalApi).protected,136);assert.equal(api.verifyFreeze(historicalApi).ok,true);
});
