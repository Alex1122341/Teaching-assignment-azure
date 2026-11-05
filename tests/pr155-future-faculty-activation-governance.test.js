'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze');
const product='4da4598bd27f2b7adea07c9682f6569a2c7a3529',previous='5752b148b1966943910e87e1cfe2c272b934b072';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const changed=(...paths)=>git('diff','--name-only',previous,product,'--',...paths).split(/\r?\n/).filter(Boolean).sort();
test('historical PR155 pins reviewed Faculty activation product and keeps every protected path',()=>{
 const governance='7c950e20db8c457a316b60912483c399163458a5';
 const manifest=JSON.parse(git('show',`${governance}:tools/beta-baseline.json`));
 assert.equal(manifest.sourceCommit,product);
 assert.ok(git('show',`${governance}:tools/beta-freeze.js`).includes(`const BASELINE_COMMIT='${product}'`));
 assert.ok(git('show',`${governance}:tools/beta-api-freeze.js`).includes("const { BASELINE_COMMIT } = require('./beta-freeze');"));
 assert.equal(api.BASELINE_COMMIT,freeze.BASELINE_COMMIT);
 git('merge-base','--is-ancestor',product,governance);git('merge-base','--is-ancestor',governance,freeze.BASELINE_COMMIT);
 git('merge-base','--is-ancestor',previous,product);git('merge-base','--is-ancestor',product,'HEAD');
 assert.deepEqual(changed('frontend'),["frontend/pages/faculty-admin.html","frontend/scripts/faculty-admin-management.js","frontend/scripts/faculty-admin.js","frontend/scripts/paws-data-client.js","frontend/scripts/teaching-assignments.js","frontend/scripts/timetable.js"]);
 assert.deepEqual(changed('server/src','swa-api'),["server/src/data/dashboard-api.js","server/src/data/data-api.js","server/src/data/sql-account-access-repository.js","server/src/data/sql-dashboard-repository.js","server/src/data/sql-faculty-admin-repository.js","server/src/data/sql-user-repository.js","server/src/runtime/swa-dashboard-functions.js","server/src/teaching-assignment/teaching-assignment-api.js"]);
 assert.deepEqual(api.baselineRuntimeFiles({root,baselineCommit:previous}),api.baselineRuntimeFiles({root,baselineCommit:product}));
 assert.deepEqual(changed('database/azure-sql'),[
 'database/azure-sql/065_faculty_future_activation.sql',
 'database/azure-sql/065_faculty_future_activation_acceptance.sql',
 'database/azure-sql/rollback_065_faculty_future_activation.sql']);
 assert.equal(changed('server/package.json','server/package-lock.json','tools/static-assets.json','deploy/aca/Dockerfile','firestore.rules','firestore.indexes.json').length,0);
 assert.equal(freeze.verifyFreeze({root}).ok,true);assert.equal(api.verifyFreeze({root}).ok,true);
});
