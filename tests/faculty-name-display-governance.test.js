'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),freeze=require('../tools/beta-freeze'),api=require('../tools/beta-api-freeze'),report=require('../tools/beta-baseline.json');
const PRIOR_MAIN='924cc6761a3b2dfba4f19c2df912436cbd965b43';
const OLD='5b135dfc91332a6fad29376d1d88d9acd33fd62a',PRODUCT='ba915e99ca06677d58e129f6fb671bd40d21600e';
const expected=[
  "adfa-swap-panel.js",
  "afc-workflow-sql.js",
  "approval-workflow.js",
  "availability-lookup.js",
  "ccc-schedule.js",
  "faculty-admin-activity-import.js",
  "faculty-admin-ccc-replacement.js",
  "faculty-admin-doe-worksheet.js",
  "faculty-admin-trainees.js",
  "faculty-availability.js",
  "faculty-name.js",
  "lab-session-detail.js",
  "teaching-assignments.html",
  "teaching-assignments.js",
  "timetable.js",
  "user-management.html",
  "user-management.js",
  "workspace-tasks.js"
];
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const changed=(from,to)=>git('diff','--name-only',from,to).split(/\r?\n/).filter(Boolean);
test('faculty-name UI-only product changes exactly the reviewed 18 shipped static files',()=>{
 git('merge-base','--is-ancestor',PRIOR_MAIN,PRODUCT);
 git('merge-base','--is-ancestor',OLD,PRODUCT);
 git('merge-base','--is-ancestor',PRODUCT,'HEAD');
 const before=JSON.parse(git('show',OLD+':tools/static-assets.json'));
 const after=JSON.parse(git('show',PRODUCT+':tools/static-assets.json'));
 assert.equal(before.length,85);
 assert.deepEqual(after,before,'the shipped asset inventory must remain unchanged');
 assert.deepEqual(changed(OLD,PRODUCT).filter(f=>before.includes(f)).sort(),expected);
 for(const name of before.filter(f=>!expected.includes(f)))assert.equal(
  freeze.sha256Canonical(freeze.readBaselineFile({root,baselineCommit:OLD,file:name})),
  freeze.sha256Canonical(freeze.readBaselineFile({root,baselineCommit:PRODUCT,file:name})),name);
});
test('faculty-name promotion makes no changes to protected API inputs or SQL migrations',()=>{
 const before=api.baselineRuntimeFiles({root,baselineCommit:OLD});
 const after=api.baselineRuntimeFiles({root,baselineCommit:PRODUCT});
 assert.equal(before.length,110);
 assert.deepEqual(after,before);
 const protectedApi=[...before,...api.BUILD_DEFINITION_FILES,...api.REPOSITORY_INPUT_FILES];
 const changedFiles=changed(PRIOR_MAIN,PRODUCT);
 assert.deepEqual(changedFiles.filter(f=>protectedApi.includes(f)),[]);
 assert.deepEqual(changedFiles.filter(f=>f.startsWith('database/azure-sql/')),[]);
});
test('historical name governance changes zero protected application bytes and pins exact product commit',()=>{
 const report=JSON.parse(git('show','31e4bee:tools/beta-baseline.json'));
 assert.ok(git('show','31e4bee:tools/beta-freeze.js').includes("const BASELINE_COMMIT='"+PRODUCT+"'"));
 git('merge-base','--is-ancestor',PRODUCT,freeze.BASELINE_COMMIT);
 assert.equal(api.BASELINE_COMMIT,freeze.BASELINE_COMMIT);
 assert.equal(report.sourceCommit,PRODUCT);
 assert.deepEqual(Object.keys(report.sha256).sort(),JSON.parse(git('show',PRODUCT+':tools/static-assets.json')).sort());
 assert.deepEqual(changed(PRODUCT,'31e4bee').filter(f=>Object.hasOwn(report.sha256,f)||f.startsWith('server/src/')||f.startsWith('swa-api/')||api.BUILD_DEFINITION_FILES.includes(f)||api.REPOSITORY_INPUT_FILES.includes(f)),[]);
 assert.equal(freeze.verifyFreeze({root}).ok,true);
 assert.equal(api.verifyFreeze({root}).ok,true);
});
