'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),cp=require('node:child_process');
const freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze'),report=require('../tools/beta-baseline.json');
const PRODUCT='c01ff949c0448f432c6f79ea3e0bebab02bdd972',PREVIOUS='6b10e01b5cb4ea940adb8c89d84122cc3fd6e061';
const git=(...args)=>cp.execFileSync('git',args,{encoding:'utf8'}).trim();
test('Sessional source labels and compact MASTER summary promote one explicit static/API product',()=>{
 assert.ok(git('show','e20771f:tools/beta-freeze.js').includes("const BASELINE_COMMIT='"+PREVIOUS+"'"));
 git('merge-base','--is-ancestor',PRODUCT,freeze.BASELINE_COMMIT);
 assert.equal(api.BASELINE_COMMIT,freeze.BASELINE_COMMIT);assert.equal(report.sourceCommit,freeze.BASELINE_COMMIT);
 assert.equal(freeze.verifyFreeze().ok,true);assert.equal(api.verifyFreeze().ok,true);
 const changed=git('diff','--name-only','e20771f',PRODUCT).split('\n');
 assert.equal(changed.some(file=>file==='firestore.rules'||file.includes('role-policy')||file.includes('doe-reserve-calculator')),false);
});
