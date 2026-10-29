'use strict';
// UX-07 governance: promotes the reviewed AFC date edit product (static + API).
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),{execFileSync}=require('node:child_process');
const freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze'),report=require('../tools/beta-baseline.json');
const root=path.resolve(__dirname,'..'),previous='7dca82ecf41654bc6e8cbe106d0cacc4ea5a3709',product='3425cbab798f0dc18291ac5ba31265270ee2fbce';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const STATIC=['frontend/scripts/afc-workflow-sql.js','frontend/scripts/faculty-admin-afc-records.js','frontend/scripts/faculty-admin.js','frontend/scripts/paws-data-client.js','frontend/styles/faculty-admin.css'];
const API=['server/src/afc/afc-request-api.js','server/src/data/dashboard-api.js','server/src/data/sql-afc-request-repository.js','server/src/data/sql-afc-write-repository.js','server/src/data/write-gates.js','server/src/history/change-history-projection.js','server/src/runtime/swa-afc-request-functions.js','server/src/runtime/swa-dashboard-functions.js'];
test('UX-07 promotion pins the AFC date edit product with exact static and API deltas',()=>{
 assert.equal(freeze.BASELINE_COMMIT,product);assert.equal(api.BASELINE_COMMIT,product);assert.equal(report.sourceCommit,product);
 assert.ok(git('show','04dff835d45354ab2d3bca49e88eb6b6b6252962:tools/beta-freeze.js').includes(`const BASELINE_COMMIT='${previous}'`));
 git('merge-base','--is-ancestor',previous,product);git('merge-base','--is-ancestor',product,'HEAD');
 assert.deepEqual(git('diff','--name-only',previous,product,'--','frontend').split('\n'),STATIC);
 assert.deepEqual(git('diff','--name-only',previous,product,'--','server/src','swa-api').split('\n'),API);
 assert.deepEqual(git('diff','--name-only',previous,product,'--','database').split('\n'),['database/azure-sql/064_afc_date_edit.sql','database/azure-sql/064_afc_date_edit_acceptance.sql','database/azure-sql/rollback_064_afc_date_edit.sql']);
 const before=JSON.parse(git('show','04dff835d45354ab2d3bca49e88eb6b6b6252962:tools/beta-baseline.json'));
 const expected={...before.sha256};
 for(const file of STATIC.map(p=>path.basename(p)))expected[file]=freeze.sha256Canonical(freeze.readBaselineFile({root,baselineCommit:product,file}));
 assert.deepEqual(report.sha256,expected);
 assert.deepEqual(freeze.readBaselineManifest({root,baselineCommit:product}),freeze.readBaselineManifest({root,baselineCommit:previous}));
 assert.deepEqual(api.baselineRuntimeFiles({root,baselineCommit:product}),api.baselineRuntimeFiles({root,baselineCommit:previous}));
 assert.equal(git('diff','--name-only',previous,product,'--','tools/static-assets.json','package.json','package-lock.json','server/package.json','server/package-lock.json','deploy/aca/Dockerfile','firestore.rules','firestore.indexes.json'),'');
 assert.equal(freeze.protectedPaths({root}).length,96);assert.equal(freeze.verifyFreeze({root}).ok,true);
 assert.equal(api.currentRuntimeFiles({root}).length,133);assert.equal(api.verifyFreeze({root}).protected,136);assert.equal(api.verifyFreeze({root}).ok,true);
});
