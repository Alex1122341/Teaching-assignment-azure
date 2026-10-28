'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),path=require('node:path');
const freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze'),report=require('../tools/beta-baseline.json');
const root=path.resolve(__dirname,'..'),previous='2974df368d61ab8f71ea04a3b21074fb2aafe54b',product='8df12efc7c9ab6d2a6735d0aed057bf35820eeb9';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
test('GUID receipt promotion pins reviewed retry corrections and retains the earlier multiple-role receipt',()=>{
 assert.equal(freeze.BASELINE_COMMIT,product);assert.equal(api.BASELINE_COMMIT,product);assert.equal(report.sourceCommit,product);
 assert.ok(git('show','4883478270f1e2047947263a286c7fc18e0e3c6f:tools/beta-freeze.js').includes(`const BASELINE_COMMIT='${previous}'`));
 const guidProduct='d6b586a2ff8c0c1f987099a5776d72d61a2d6400';
 assert.ok(git('show','93e434aa974509e980b858a40dcfef42b08d31f1:tools/beta-freeze.js').includes(`const BASELINE_COMMIT='${guidProduct}'`));
 git('merge-base','--is-ancestor',guidProduct,product);
 git('merge-base','--is-ancestor',previous,product);git('merge-base','--is-ancestor',product,'HEAD');
 assert.deepEqual(report.sha256,JSON.parse(git('show','4883478270f1e2047947263a286c7fc18e0e3c6f:tools/beta-baseline.json')).sha256);
 assert.equal(git('diff','--name-only',previous,product,'--','frontend','tools/static-assets.json','package.json','package-lock.json','server/package.json','server/package-lock.json','deploy/aca/Dockerfile','firestore.rules','firestore.indexes.json'),'');
 const before=api.baselineRuntimeFiles({root,baselineCommit:previous}),after=api.baselineRuntimeFiles({root,baselineCommit:product});
 assert.deepEqual(after,before);assert.equal(after.length,133);
 assert.deepEqual(git('diff','--name-only',previous,product,'--','server/src','swa-api').split('\n'),[
  'server/src/access/account-access-api.js','server/src/access/leadership-access-api.js',
  'server/src/data/sql-account-access-repository.js','server/src/data/sql-leadership-access-repository.js']);
 assert.equal(freeze.protectedPaths({root}).length,96);assert.equal(freeze.verifyFreeze({root}).ok,true);
 assert.equal(api.verifyFreeze({root}).protected,136);assert.equal(api.verifyFreeze({root}).ok,true);
});
