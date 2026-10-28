'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),{execFileSync}=require('node:child_process');
const freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze');
const report=require('../tools/beta-baseline.json'),root=path.resolve(__dirname,'..');
const previous='cb4298c734e7162c86a71b729c797ff548111db7';
const product='2974df368d61ab8f71ea04a3b21074fb2aafe54b';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
test('multiple teaching roles promote independently reviewed product blobs and retain prior Calendar receipt',()=>{
 assert.ok(git('show','4883478270f1e2047947263a286c7fc18e0e3c6f:tools/beta-freeze.js').includes(`const BASELINE_COMMIT='${product}'`));
 git('merge-base','--is-ancestor',product,freeze.BASELINE_COMMIT);
 assert.equal(api.BASELINE_COMMIT,freeze.BASELINE_COMMIT);assert.equal(report.sourceCommit,freeze.BASELINE_COMMIT);
 assert.ok(git('show','d76aa7e8d8a2098857190fa7f7b868a192f20cc2:tools/beta-freeze.js').includes(`const BASELINE_COMMIT='${previous}'`));
 git('merge-base','--is-ancestor',previous,product);git('merge-base','--is-ancestor',product,'HEAD');
 const before=freeze.readBaselineManifest({root,baselineCommit:previous}),after=freeze.readBaselineManifest({root,baselineCommit:product});
 assert.deepEqual(after,before);assert.equal(after.length,96);
 assert.equal(freeze.protectedPaths({root,readManifest:()=>['index.html']}).length,96);
 assert.deepEqual(Object.keys(report.sha256).sort(),after.slice().sort());
 for(const file of after)assert.equal(report.sha256[file],freeze.sha256Canonical(freeze.readBaselineFile({root,baselineCommit:product,file})),file);
 assert.equal(freeze.verifyFreeze({root}).ok,true);
});
test('multiple teaching roles retain every earlier API input and protect the six added runtime modules',()=>{
 const before=api.baselineRuntimeFiles({root,baselineCommit:previous}),after=api.baselineRuntimeFiles({root,baselineCommit:product});
 assert.equal(before.length,127);assert.equal(after.length,133);assert.deepEqual(before.filter(file=>!after.includes(file)),[]);
 assert.equal(after.filter(file=>!before.includes(file)).length,6);
 assert.equal(api.verifyFreeze({root}).protected,136);assert.equal(api.verifyFreeze({root}).ok,true);
 for(const file of [...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES])assert.ok(api.bytesMatch(api.readBaselineFile({root,baselineCommit:previous,file}),api.readBaselineFile({root,baselineCommit:product,file})),file);
 assert.equal(git('diff','--name-only',previous,product,'--','package.json','package-lock.json','firestore.indexes.json','tools/static-assets.json'),'');
});
