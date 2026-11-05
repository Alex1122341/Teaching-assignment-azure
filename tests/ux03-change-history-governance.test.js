'use strict';
// UX-03: preserve the original isolated product receipt and the reviewed integration into current main.
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),{execFileSync}=require('node:child_process');
const freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze'),report=require('../tools/beta-baseline.json');
const root=path.resolve(__dirname,'..');
const previous='23af7e978ef928469cc985ffcfee20d946413f20',product='8fb66b83f8c71d225ae71b06048119d1ff357cf1';
const originalPrevious='4da4598bd27f2b7adea07c9682f6569a2c7a3529',originalProduct='feb2f7494437f3535388911d1bb07e1cce258e46';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();

test('UX-03 preserves the original isolated one-API-file receipt',()=>{
 git('merge-base','--is-ancestor',originalPrevious,originalProduct);
 git('merge-base','--is-ancestor',originalProduct,product);
 assert.equal(git('diff','--name-only',originalPrevious,originalProduct,'--','frontend','database'),'');
 assert.equal(git('diff','--name-only',originalPrevious,originalProduct,'--','server/src','swa-api'),'server/src/history/change-history-projection.js');
});
test('UX-03 on current main promotes only the reviewed one API file',()=>{
 assert.equal(freeze.BASELINE_COMMIT,product);
 assert.equal(api.BASELINE_COMMIT,product);
 assert.equal(report.sourceCommit,product);
 git('merge-base','--is-ancestor',previous,product);
 git('merge-base','--is-ancestor',product,'HEAD');
 assert.equal(git('diff','--name-only',previous,product,'--','frontend','database'),'');
 assert.equal(git('diff','--name-only',previous,product,'--','server/src','swa-api'),'server/src/history/change-history-projection.js');
 assert.deepEqual(report.sha256,JSON.parse(git('show','036e8a6fd8d17cfa35f143668fca84f2865b5928:tools/beta-baseline.json')).sha256);
 assert.deepEqual(api.baselineRuntimeFiles({root,baselineCommit:product}),api.baselineRuntimeFiles({root,baselineCommit:previous}));
 assert.equal(git('diff','--name-only',previous,product,'--','tools/static-assets.json','package.json','package-lock.json','server/package.json','server/package-lock.json','deploy/aca/Dockerfile','firestore.rules','firestore.indexes.json'),'');
 assert.equal(freeze.verifyFreeze({root}).ok,true);
 assert.equal(api.verifyFreeze({root}).ok,true);
});
