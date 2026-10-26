'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root,file),'utf8');

test('dual-runtime candidate verifier keeps static and API freezes', () => {
  const verifier = read('tools/verify-beta-candidate.js');
  for (const marker of ['beta-api-freeze','static:','api:','staticResult.ok&&apiResult.ok']) assert.ok(verifier.includes(marker),marker);
});
test('current CI keeps immutable source and both built artifact checks', () => {
  const wf = read('.github/workflows/azure-beta-build.yml');
  for (const marker of ['node tools/verify-beta-candidate.js','node tools/beta-freeze.js --artifact .azure-production/app','node tools/beta-api-freeze.js --artifact .azure-production/api','name: azure-beta-']) assert.ok(wf.includes(marker),marker);
  assert.doesNotMatch(wf,/docker build|az (?:acr|containerapp)|npm ci --prefix swa-api/);
});
test('server workspace locked dependencies precede both test suites', () => {
  const wf = read('.github/workflows/azure-beta-build.yml').replace(/\r\n/g, '\n');
  const rootInstall=wf.indexOf('- run: npm ci\n'),serverInstall=wf.indexOf('npm ci --prefix server'),rootTest=wf.indexOf('- run: npm test\n'),serverTest=wf.indexOf('npm test --prefix server');
  assert.ok(rootInstall>=0 && rootInstall<serverInstall && serverInstall<rootTest && serverInstall<serverTest);
});
test('personal Azure publishing/deployment workflows no longer exist', () => {
  for(const f of ['.github/workflows/azure-beta-aca-deploy.yml','.github/workflows/azure-beta-acr-publish.yml','tools/beta-acr-tag-guard.js'])
    assert.equal(fs.existsSync(path.join(root,f)),false,f);
});
test('Firebase publisher remains exact-source static-only deployment',()=>{
 const wf=read('.github/workflows/firebase-hosting-deploy.yml');
 for(const marker of ['workflow_dispatch:','source_run_id:','commit_sha:','azure-beta-build.yml','name: azure-beta-','path: .firebase-production','firebase deploy','--only hosting'])assert.ok(wf.includes(marker),marker);
 assert.doesNotMatch(wf,/Azure\/static-web-apps-deploy|az (?:acr|containerapp)/);
});
test('legacy ACA build definition stays frozen as evidence; it is not an active workflow',()=>{
 const image=read('deploy/aca/Dockerfile');
 assert.match(image,/mcr\.microsoft\.com\/azure-functions\/node:4-node22/);
 assert.doesNotMatch(read('.github/workflows/azure-beta-build.yml'),/docker build/);
});
