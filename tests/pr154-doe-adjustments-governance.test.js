'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const freeze=require('../tools/beta-freeze');
const api=require('../tools/beta-api-freeze');
const product='d0275801dafff439c1afb35eecc9897730ea2e8b';
const previous='f1b42a3708e94eb1260454adc0a783eb934591cc';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();

test('PR154 promotes only two reviewed DOE API modules with no static or SQL schema changes',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'tools/beta-baseline.json'),'utf8'));
  assert.equal(freeze.BASELINE_COMMIT,product);
  assert.equal(manifest.sourceCommit,product);
  git('merge-base','--is-ancestor',previous,product);
  git('merge-base','--is-ancestor',product,'HEAD');
  const previousFiles=api.baselineRuntimeFiles({root,baselineCommit:previous});
  const currentFiles=api.baselineRuntimeFiles({root,baselineCommit:product});
  assert.deepEqual(currentFiles,previousFiles);
  const changed=git('diff','--name-only',previous,product,'--','server/src','swa-api').split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(changed,['server/src/data/sql-doe-worksheet-repository.js','server/src/doe/doe-worksheet-service.js']);
  assert.equal(git('diff','--name-only',previous,product,'--','frontend','tools/static-assets.json','database','server/package.json','server/package-lock.json','deploy/aca/Dockerfile','firestore.rules','firestore.indexes.json'),'');
  assert.deepEqual(manifest.sha256,JSON.parse(git('show','cbd5fa9e9e832e99d35f456fc9bb42d53ab889e7:tools/beta-baseline.json')).sha256);
  assert.equal(freeze.verifyFreeze({root}).ok,true);
  assert.equal(api.verifyFreeze({root}).ok,true);
});
