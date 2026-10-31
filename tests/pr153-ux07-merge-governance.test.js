'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),{execFileSync}=require('node:child_process');
const freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze'),report=require('../tools/beta-baseline.json');
const root=path.resolve(__dirname,'..'),main='a53ad6540c64dbcace17baccfb2ef31ba42b3b6b',pr='948ce63189ce10af765bfb169575f9b89447b193',product='f1b42a3708e94eb1260454adc0a783eb934591cc';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
test('combined DOE and UX-07 main has immutable freeze, correct ancestry and no DB-file change',()=>{
 assert.equal(freeze.BASELINE_COMMIT,product);assert.equal(api.BASELINE_COMMIT,product);assert.equal(report.sourceCommit,product);
 git('merge-base','--is-ancestor',main,product);git('merge-base','--is-ancestor',pr,product);git('merge-base','--is-ancestor',product,'HEAD');
 assert.equal(git('diff','--name-only',main,product,'--','database'),'');
 assert.deepEqual(git('diff','--name-only',main,product,'--','frontend').split('\n'),['frontend/scripts/faculty-admin-doe-rulebook.js','frontend/scripts/faculty-admin-doe-worksheet.js','frontend/styles/faculty-admin.css']);
 assert.equal(freeze.protectedPaths({root}).length,96);assert.equal(freeze.verifyFreeze({root}).ok,true);
 assert.equal(api.currentRuntimeFiles({root}).length,133);assert.equal(api.verifyFreeze({root}).protected,136);assert.equal(api.verifyFreeze({root}).ok,true);
});
