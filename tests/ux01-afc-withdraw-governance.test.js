'use strict';
// UX-01 governance: promotes the reviewed AFC Withdraw / Withdrawn wording product.
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),{execFileSync}=require('node:child_process');
const freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze');
const root=path.resolve(__dirname,'..'),previous='2c87d5c6121284db36ade094b0652de6f2c3f91c',product='7dca82ecf41654bc6e8cbe106d0cacc4ea5a3709';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
test('historical UX-01 promotion pins the AFC withdraw wording product and changes only two static files and one API file',()=>{
 const report=JSON.parse(git('show','beca0d901660144120f907fd2f15c6faf3a99315:tools/beta-baseline.json'));
 assert.ok(git('show','beca0d901660144120f907fd2f15c6faf3a99315:tools/beta-freeze.js').includes(`const BASELINE_COMMIT='${product}'`));
 assert.ok(git('show','beca0d901660144120f907fd2f15c6faf3a99315:tools/beta-api-freeze.js').includes("require('./beta-freeze')"));assert.equal(report.sourceCommit,product);
 assert.ok(git('show','c74327fb562d8da877ab26b2183a6fa888b19d8e:tools/beta-freeze.js').includes(`const BASELINE_COMMIT='${previous}'`));
 git('merge-base','--is-ancestor',previous,product);git('merge-base','--is-ancestor',product,'HEAD');
 assert.equal(git('diff','--name-only',previous,product,'--','frontend'),'frontend/pages/faculty-admin.html\nfrontend/scripts/faculty-admin-afc-records.js');
 assert.equal(git('diff','--name-only',previous,product,'--','server/src','swa-api'),'server/src/data/dashboard-api.js');
 const before=JSON.parse(git('show','c74327fb562d8da877ab26b2183a6fa888b19d8e:tools/beta-baseline.json'));
 const expected={...before.sha256};
 for(const file of ['faculty-admin.html','faculty-admin-afc-records.js'])expected[file]=freeze.sha256Canonical(freeze.readBaselineFile({root,baselineCommit:product,file}));
 assert.deepEqual(report.sha256,expected);
 assert.deepEqual(freeze.readBaselineManifest({root,baselineCommit:product}),freeze.readBaselineManifest({root,baselineCommit:previous}));
 assert.deepEqual(api.baselineRuntimeFiles({root,baselineCommit:product}),api.baselineRuntimeFiles({root,baselineCommit:previous}));
 assert.equal(git('diff','--name-only',previous,product,'--','tools/static-assets.json','package.json','package-lock.json','server/package.json','server/package-lock.json','deploy/aca/Dockerfile','database','firestore.rules','firestore.indexes.json'),'');
 const historicalStatic={root,baselineCommit:product,readWorking:({file})=>freeze.readBaselineFile({root,baselineCommit:product,file})};
 const historicalApi={root,baselineCommit:product,readWorking:({file})=>api.readBaselineFile({root,baselineCommit:product,file})};
 assert.equal(freeze.protectedPaths(historicalStatic).length,96);assert.equal(freeze.verifyFreeze(historicalStatic).ok,true);
 assert.equal(api.baselineRuntimeFiles({root,baselineCommit:product}).length,133);assert.equal(api.verifyFreeze(historicalApi).protected,136);assert.equal(api.verifyFreeze(historicalApi).ok,true);
});
