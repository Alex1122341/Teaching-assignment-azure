'use strict';
// UX-01 governance: promotes the reviewed AFC Withdraw / Withdrawn wording product.
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),{execFileSync}=require('node:child_process');
const freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze'),report=require('../tools/beta-baseline.json');
const root=path.resolve(__dirname,'..'),previous='2c87d5c6121284db36ade094b0652de6f2c3f91c',product='7dca82ecf41654bc6e8cbe106d0cacc4ea5a3709';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
test('UX-01 promotion pins the AFC withdraw wording product and changes only two static files and one API file',()=>{
 assert.ok(git('show','04dff835d45354ab2d3bca49e88eb6b6b6252962:tools/beta-freeze.js').includes(`const BASELINE_COMMIT='${product}'`));
 git('merge-base','--is-ancestor',product,freeze.BASELINE_COMMIT);
 assert.equal(api.BASELINE_COMMIT,freeze.BASELINE_COMMIT);assert.equal(report.sourceCommit,freeze.BASELINE_COMMIT);
 const historicalReport=JSON.parse(git('show','04dff835d45354ab2d3bca49e88eb6b6b6252962:tools/beta-baseline.json'));
 assert.equal(historicalReport.sourceCommit,product);
 assert.ok(git('show','c74327fb562d8da877ab26b2183a6fa888b19d8e:tools/beta-freeze.js').includes(`const BASELINE_COMMIT='${previous}'`));
 git('merge-base','--is-ancestor',previous,product);git('merge-base','--is-ancestor',product,'HEAD');
 assert.equal(git('diff','--name-only',previous,product,'--','frontend'),'frontend/pages/faculty-admin.html\nfrontend/scripts/faculty-admin-afc-records.js');
 assert.equal(git('diff','--name-only',previous,product,'--','server/src','swa-api'),'server/src/data/dashboard-api.js');
 const before=JSON.parse(git('show','c74327fb562d8da877ab26b2183a6fa888b19d8e:tools/beta-baseline.json'));
 const expected={...before.sha256};
 for(const file of ['faculty-admin.html','faculty-admin-afc-records.js'])expected[file]=freeze.sha256Canonical(freeze.readBaselineFile({root,baselineCommit:product,file}));
 assert.deepEqual(historicalReport.sha256,expected);
 assert.deepEqual(freeze.readBaselineManifest({root,baselineCommit:product}),freeze.readBaselineManifest({root,baselineCommit:previous}));
 assert.deepEqual(api.baselineRuntimeFiles({root,baselineCommit:product}),api.baselineRuntimeFiles({root,baselineCommit:previous}));
 assert.equal(git('diff','--name-only',previous,product,'--','tools/static-assets.json','package.json','package-lock.json','server/package.json','server/package-lock.json','deploy/aca/Dockerfile','database','firestore.rules','firestore.indexes.json'),'');
 assert.equal(freeze.protectedPaths({root}).length,96);assert.equal(freeze.verifyFreeze({root}).ok,true);
 assert.equal(api.currentRuntimeFiles({root}).length,133);assert.equal(api.verifyFreeze({root}).protected,136);assert.equal(api.verifyFreeze({root}).ok,true);
});
