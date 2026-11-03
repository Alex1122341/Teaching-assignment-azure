'use strict';
// UX-03 governance: promotes the reviewed Change History keyword fix (one API file).
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),{execFileSync}=require('node:child_process');
const freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze'),report=require('../tools/beta-baseline.json');
const root=path.resolve(__dirname,'..'),previous='4da4598bd27f2b7adea07c9682f6569a2c7a3529',product='feb2f7494437f3535388911d1bb07e1cce258e46';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
test('UX-03 promotion pins the Change History search fix and changes only one API file',()=>{
 assert.equal(freeze.BASELINE_COMMIT,product);assert.equal(api.BASELINE_COMMIT,product);assert.equal(report.sourceCommit,product);
 assert.ok(git('show','7c950e20db8c457a316b60912483c399163458a5:tools/beta-freeze.js').includes(`const BASELINE_COMMIT='${previous}'`));
 git('merge-base','--is-ancestor',previous,product);git('merge-base','--is-ancestor',product,'HEAD');
 assert.equal(git('diff','--name-only',previous,product,'--','frontend','database'),'');
 assert.equal(git('diff','--name-only',previous,product,'--','server/src','swa-api'),'server/src/history/change-history-projection.js');
 assert.deepEqual(report.sha256,JSON.parse(git('show','7c950e20db8c457a316b60912483c399163458a5:tools/beta-baseline.json')).sha256);
 assert.deepEqual(api.baselineRuntimeFiles({root,baselineCommit:product}),api.baselineRuntimeFiles({root,baselineCommit:previous}));
 assert.equal(git('diff','--name-only',previous,product,'--','tools/static-assets.json','package.json','package-lock.json','server/package.json','server/package-lock.json','deploy/aca/Dockerfile','firestore.rules','firestore.indexes.json'),'');
 assert.equal(freeze.verifyFreeze({root}).ok,true);assert.equal(api.verifyFreeze({root}).ok,true);
});
