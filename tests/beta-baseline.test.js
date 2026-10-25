'use strict';
const { repositoryPath } = require('../tools/build/frontend-paths');
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=repositoryPath(__dirname,'..');
const baseline=require('../tools/beta-baseline.json');
const freeze=require('../tools/beta-freeze.js');

// Work/Away classification is current. Prior Calendar timeout, activity filters, AFC recovery, DOE Lookup layout/UI, Selected Schedule Export, Scheduling Tasks, ADFA SWAP, Calendar activities, AFC/LAB and P4/DOE Calculator/AUTH-1/P3/P2/P1/W1M/W1H/W1F remain immutable historical evidence so each
// reviewed protected-runtime promotion stays independently pinned.
const BASELINE_COMMIT='50e7e5c4241debe078080adda7a7dcbd383a2ba1';
const CCC_SCHEDULE_PRODUCT_COMMIT='5b135dfc91332a6fad29376d1d88d9acd33fd62a';
const SELECTED_SCHEDULE_GOVERNANCE_COMMIT='e76878cbcfe470eb8d3f3c8b560da4114f9f16e6';
const DOE_RULEBOOK_LOOKUP_PRODUCT_COMMIT='6b1d2fe200b756f08049ae6cb30d1ba0194a18d5';
const DOE_LOOKUP_LAYOUT_PRODUCT_COMMIT='3cd51cacbd7de32367c55bf203a47801d5763abf';
const SCHEDULING_PRODUCT_COMMIT='a3dd9ca9e5324cc6889d09c7a0a1ad08993c8bca';
const ADFA_PRODUCT_COMMIT='0f81c3e0b7e63a9b9357755b7e957406018894fd';
const CALENDAR_PRODUCT_COMMIT='7526e86f295de062c228fb1ddee2f007706285c2';
const AFC_LAB_PRODUCT_COMMIT='fb2c625745957fa7d9990033f15a7b1ef91974a5';
const PREVIOUS_AFC_LAB_BASELINE_COMMIT='277c3cdfb1b9aa4cb9002f686a76a29a73a7f57b';
const P4_PRODUCT_COMMIT='d62f5406ce1f89813bf928611e551e864ae165fc';
const DOE_CALCULATOR_BASELINE_COMMIT='1fd064b0a1b2367cb2d3a58d71d6c8856fb1c74a';
const AUTH1_PRODUCT_COMMIT='ae8c822cb6594f0c4e789b7ea8f7d4c310a4b3f5';
const P3_PRODUCT_COMMIT='d6b433f3b7f5bb62400deedba537e47b970b34d2';
const P1_PRODUCT_COMMIT='efdedb3d1b62a774e74b859a723e5a7906f86956';
const P2_PRODUCT_COMMIT='e37981f35a3b9954b7b69e98e38fcf69262ec185';
const W1M_PRODUCT_COMMIT='06b517dff59a07e802cb8dff09400532fb195fe4';
const W1H_PRODUCT_COMMIT='ab75affcae728132ca91106551d63fc73453bfe0';
const W1F_FREEZE_COMMIT='da21223a1d92572ff72767796229a655d122efb4';
const PREVIOUS_FREEZE_COMMIT='51ed5f7aa0851aac5f20133ea213666028e018a3';
const W1F_MAIN_COMMIT='1dca1037f61e8dbb054cc53b119d2b73982ab810';
const W1C_PRODUCT_COMMIT='08633276663b71d7a6fc995e9be2d20c7cba4065';
const W1C_ACCEPTED_TIP='916a90cc2e3e9f55c01e26ace6a14f21c7d2cca9';
const W1D_ACCEPTED_TIP='2d40117eb34ce309826a0e0d357b694fcf86801a';
const W1E_ACCEPTED_TIP='ef7d925c4393d0d3c5e5d93ebd99e9870bc4d59c';
const P3_INTEGRATION_COMMIT='6fc77fb94e0de3aa116c9c4d5743d4aec45da61c';
const P3B4_BASELINE_COMMIT='b7b9ed45bcc88ea774fb2c64bbca8c753da41393';
const P3B3_BASELINE_COMMIT='adb943ccadff8851ba9de47bfc6b1d226916b89b';
const PREVIOUS_P3B3_BASELINE_COMMIT='2adafc731d3eaeec10ca08e058c1272ca2a463fb';
const PREVIOUS_P3B2_BASELINE_COMMIT='9d15cb7cd28cdda0eb56a34ccb99777c1d488569';
const PREVIOUS_API_BASELINE_COMMIT='1608577e474d58a2949c1a504bd9368f79d629ee';
const PREVIOUS_STATIC_BASELINE_COMMIT='1224fc5fb5f19a410f18c4f6d966c374498039b4';
const PREVIOUS_BASELINE_COMMIT='6bfd637af57955ded38e6a39d2c055bec67a0aa0';
const manifest=()=>JSON.parse(fs.readFileSync(repositoryPath(root,'tools/static-assets.json'),'utf8'));

function baselineJson(ref){
  return JSON.parse(execFileSync('git',['show',`${ref}:tools/static-assets.json`],{cwd:root,encoding:'utf8'}));
}
const historicalStaticPaths=commit=>freeze.protectedPaths({root,baselineCommit:commit,readManifest:()=>baselineJson(commit)});
const historicalApiPaths=commit=>require('../tools/beta-api-freeze.js').baselineRuntimeFiles({root,baselineCommit:commit});

test('Calendar workspace promotion adds only two views and preserves Phase1 and all API protection',()=>{
 const previous='16027769c774367c65d5dd68fc1a8002a052589e',product='64477000a17ae885776f664a93480af0aaaf110f';
 const history=execFileSync('git',['show','30f763dcbca8c669a87f0ced281327db5bd35a95:tools/beta-freeze.js'],{cwd:root,encoding:'utf8'});
 assert.ok(history.includes(`const BASELINE_COMMIT='${previous}'`));
 const before=historicalStaticPaths(previous),after=historicalStaticPaths(product);
 assert.equal(before.length,87);assert.equal(after.length,89);
 assert.deepEqual(before.filter(file=>!after.includes(file)),[]);
 assert.deepEqual(after.filter(file=>!before.includes(file)),['schedule-filter-view.js','workspace-navigation.js']);
 const changed=before.filter(file=>!freeze.bytesMatch(freeze.readBaselineFile({root,baselineCommit:previous,file}),freeze.readBaselineFile({root,baselineCommit:product,file}))).sort();
 assert.deepEqual(changed,['index.html','timetable.js','workspace.css']);
 const apiFreeze=require('../tools/beta-api-freeze.js'),oldApi=historicalApiPaths(previous),newApi=historicalApiPaths(product);
 assert.deepEqual(newApi,oldApi);assert.equal(newApi.length,115);
 const paths=[...new Set([...newApi,...apiFreeze.BUILD_DEFINITION_FILES,...apiFreeze.REPOSITORY_INPUT_FILES])];assert.equal(paths.length,118);
 for(const file of paths)assert.ok(freeze.bytesMatch(freeze.readBaselineFile({root,baselineCommit:previous,file}),freeze.readBaselineFile({root,baselineCommit:product,file})),file);
});

test('historical Away classification freeze protects only its reviewed two static and two API files',()=>{
 const previous='0be7e75c483b497cc566c24a3d9366ad32827f8c',product='3d983cf317147a20415e8e5cfd0d3f17532af27f';
 const historical=execFileSync('git',['show','9287d91b1d97cf484e6952dc67688d07f1edcf59:tools/beta-freeze.js'],{cwd:root,encoding:'utf8'});assert.ok(historical.includes(`const BASELINE_COMMIT='${product}'`));
 const before=historicalStaticPaths(previous),after=historicalStaticPaths(product),oldApi=historicalApiPaths(previous),newApi=historicalApiPaths(product);
 assert.equal(after.length,75);assert.deepEqual(after,before);for(const file of after)assert.ok(manifest().includes(file));
 const apiFreeze=require('../tools/beta-api-freeze.js'),protectedApi=[...new Set([...newApi,...apiFreeze.BUILD_DEFINITION_FILES,...apiFreeze.REPOSITORY_INPUT_FILES])].sort();
 assert.equal(newApi.length,76);assert.equal(protectedApi.length,79);assert.deepEqual(newApi,oldApi);
 const changed=execFileSync('git',['diff','--name-only',previous,product],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
 assert.deepEqual(changed.filter(file=>after.includes(file)).sort(),['calendar-activities.js','faculty-admin-activity-import.js']);
 assert.deepEqual(changed.filter(file=>protectedApi.includes(file)).sort(),['server/src/calendar/activity-import-policy.js','server/src/calendar/activity-workbook-worker.js']);
 for(const file of [...after,...protectedApi].filter(file=>!changed.includes(file)))assert.equal(freeze.bytesMatch(freeze.readBaselineFile({root,baselineCommit:previous,file}),freeze.readBaselineFile({root,baselineCommit:product,file})),true,file);
});

test('historical Calendar import timeout freeze changes only three reviewed API files',()=>{
 const previous='3f53695778ea144d0e4ec53ab624d4b85f849a75',product='0be7e75c483b497cc566c24a3d9366ad32827f8c';
 const full=execFileSync('git',['rev-parse',product],{cwd:root,encoding:'utf8'}).trim();
 const governance='b8be19f8131822f77e73fb9a394d7c3a5d6c25a7';
 const source=execFileSync('git',['show',`${governance}:tools/beta-freeze.js`],{cwd:root,encoding:'utf8'});
 const report=JSON.parse(execFileSync('git',['show',`${governance}:tools/beta-baseline.json`],{cwd:root,encoding:'utf8'}));
 assert.ok(source.includes(`const BASELINE_COMMIT='${full}'`));assert.equal(report.sourceCommit,full);
 const before=historicalStaticPaths(previous),after=historicalStaticPaths(full),api=historicalApiPaths(full),apiFreeze=require('../tools/beta-api-freeze.js');
 assert.equal(after.length,75);assert.deepEqual(after,before);for(const file of after)assert.ok(manifest().includes(file));assert.deepEqual(api,historicalApiPaths(previous));
 const protectedApi=[...new Set([...api,...apiFreeze.BUILD_DEFINITION_FILES,...apiFreeze.REPOSITORY_INPUT_FILES])].sort();assert.equal(api.length,76);assert.equal(protectedApi.length,79);
 const changed=execFileSync('git',['diff','--name-only',previous,full],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
 assert.deepEqual(changed.filter(file=>after.includes(file)),[]);
 assert.deepEqual(changed.filter(file=>protectedApi.includes(file)).sort(),['server/src/data/sql-calendar-activity-repository.js','server/src/data/sql-connection.js','server/src/runtime/swa-sql-runtime.js']);
 for(const file of after)assert.equal(freeze.bytesMatch(freeze.readBaselineFile({root,baselineCommit:previous,file}),freeze.readBaselineFile({root,baselineCommit:full,file})),true,file);
});

test('historical working activity type filter freeze protects its reviewed four-file static delta',()=>{
 const previous='d049fe0fb4fb51e9fcefab3a4151c2600d3cc074',product='3f53695778ea144d0e4ec53ab624d4b85f849a75';
 const governance='f8dad82bb31bb9d4feeb3b8cddf2c413907dd609';
 const source=execFileSync('git',['show',`${governance}:tools/beta-freeze.js`],{cwd:root,encoding:'utf8'});
 const report=JSON.parse(execFileSync('git',['show',`${governance}:tools/beta-baseline.json`],{cwd:root,encoding:'utf8'}));
 assert.ok(source.includes(`const BASELINE_COMMIT='${product}'`));assert.equal(report.sourceCommit,product);
 const before=historicalStaticPaths(previous),after=historicalStaticPaths(product),oldApi=historicalApiPaths(previous),newApi=historicalApiPaths(product);
 assert.equal(before.length,75);assert.deepEqual(after,before);for(const file of after)assert.ok(manifest().includes(file));
 const apiFreeze=require('../tools/beta-api-freeze.js'),protectedApi=[...new Set([...newApi,...apiFreeze.BUILD_DEFINITION_FILES,...apiFreeze.REPOSITORY_INPUT_FILES])].sort();
 assert.equal(newApi.length,76);assert.equal(protectedApi.length,79);assert.deepEqual(newApi,oldApi);
 const changed=execFileSync('git',['diff','--name-only',previous,product],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
 assert.deepEqual(changed.filter(file=>after.includes(file)).sort(),['calendar-activities.css','calendar-activities.js','index.html','timetable.js']);
 assert.deepEqual(changed.filter(file=>protectedApi.includes(file)),[]);
 for(const file of protectedApi)assert.equal(freeze.bytesMatch(freeze.readBaselineFile({root,baselineCommit:previous,file}),freeze.readBaselineFile({root,baselineCommit:product,file})),true,file);
 execFileSync('git',['merge-base','--is-ancestor','750db6edc5195ed5e30b92a0a302f152d7bcd362',product],{cwd:root});
});

test('historical AFC confirmation recovery freeze protects only its reviewed three-file delta',()=>{
 const previous=DOE_LOOKUP_LAYOUT_PRODUCT_COMMIT,product='d049fe0fb4fb51e9fcefab3a4151c2600d3cc074';
 const governance='2c39af86244b4e07fa5a678ecee53ff43cb7a0a5';
 const source=execFileSync('git',['show',`${governance}:tools/beta-freeze.js`],{cwd:root,encoding:'utf8'});
 const report=JSON.parse(execFileSync('git',['show',`${governance}:tools/beta-baseline.json`],{cwd:root,encoding:'utf8'}));
 assert.ok(source.includes(`const BASELINE_COMMIT='${product}'`));assert.equal(report.sourceCommit,product);
 const before=historicalStaticPaths(previous),after=historicalStaticPaths(product),oldApi=historicalApiPaths(previous),newApi=historicalApiPaths(product);
 assert.equal(before.length,75);assert.deepEqual(after,before);for(const file of after)assert.ok(manifest().includes(file));
 assert.equal(oldApi.length,76);assert.deepEqual(newApi,oldApi);
 const apiFreeze=require('../tools/beta-api-freeze.js');
 const apiProtected=[...new Set([...newApi,...apiFreeze.BUILD_DEFINITION_FILES,...apiFreeze.REPOSITORY_INPUT_FILES])].sort();
 assert.equal(apiProtected.length,79);
 const changed=execFileSync('git',['diff','--name-only',previous,product],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
 assert.deepEqual(changed.filter(file=>after.includes(file)).sort(),['afc-workflow-sql.js','faculty-admin-afc-records.js','faculty-admin.js']);
 assert.deepEqual(changed.filter(file=>apiProtected.includes(file)),[]);
 for(const file of apiProtected)assert.equal(freeze.bytesMatch(freeze.readBaselineFile({root,baselineCommit:previous,file}),freeze.readBaselineFile({root,baselineCommit:product,file})),true,file);
 execFileSync('git',['merge-base','--is-ancestor','d75d8eb97f0172c25deddaeed87327216631ecd6',product],{cwd:root});
});

test('historical DOE Lookup summary layout freeze preserves its reviewed single-file delta',()=>{
 const previous=DOE_RULEBOOK_LOOKUP_PRODUCT_COMMIT,product=DOE_LOOKUP_LAYOUT_PRODUCT_COMMIT;
 const governance='4082c6253c25ff6b8bedb76172042700084ea705';
 const historicalSource=execFileSync('git',['show',`${governance}:tools/beta-freeze.js`],{cwd:root,encoding:'utf8'});
 const historicalReport=JSON.parse(execFileSync('git',['show',`${governance}:tools/beta-baseline.json`],{cwd:root,encoding:'utf8'}));
 assert.ok(historicalSource.includes(`const BASELINE_COMMIT='${product}'`));assert.equal(historicalReport.sourceCommit,product);
 const before=historicalStaticPaths(previous),after=historicalStaticPaths(product),oldApi=historicalApiPaths(previous),newApi=historicalApiPaths(product);
 assert.equal(before.length,75);assert.deepEqual(after,before);for(const file of after)assert.ok(manifest().includes(file));
 assert.equal(oldApi.length,76);assert.deepEqual(newApi,oldApi);
 const apiFreeze=require('../tools/beta-api-freeze.js');
 const apiProtected=[...new Set([...newApi,...apiFreeze.BUILD_DEFINITION_FILES,...apiFreeze.REPOSITORY_INPUT_FILES])].sort();
 assert.equal(apiProtected.length,79);
 const changed=execFileSync('git',['diff','--name-only',previous,product],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
 assert.deepEqual(changed.filter(file=>after.includes(file)),['faculty-admin.css']);
 assert.deepEqual(changed.filter(file=>apiProtected.includes(file)),[]);
 for(const file of apiProtected)assert.equal(freeze.bytesMatch(freeze.readBaselineFile({root,baselineCommit:previous,file}),freeze.readBaselineFile({root,baselineCommit:product,file})),true,file);
 execFileSync('git',['merge-base','--is-ancestor','bfe175b7117e213b2dc954797074aad90a4061ce',product],{cwd:root});
});

test('historical DOE Rule Book / Faculty Lookup freeze preserves its exact reviewed UI delta',()=>{
 const previous='bb6b86611a1c9eba2479f158ba864d63626b0b4d',product=DOE_RULEBOOK_LOOKUP_PRODUCT_COMMIT;
 const governance='7a90331884afd6990822cffd371a047674a90854';
 const historicalSource=execFileSync('git',['show',`${governance}:tools/beta-freeze.js`],{cwd:root,encoding:'utf8'});
 const historicalReport=JSON.parse(execFileSync('git',['show',`${governance}:tools/beta-baseline.json`],{cwd:root,encoding:'utf8'}));
 assert.ok(historicalSource.includes(`const BASELINE_COMMIT='${product}'`));assert.equal(historicalReport.sourceCommit,product);
 assert.equal(freeze.baselineCommitExists(root,product),true);
 execFileSync('git',['merge-base','--is-ancestor','85d0cb9202e34724882c02ece01f33c5910fe91d',product],{cwd:root});
 execFileSync('git',['merge-base','--is-ancestor','d8b2109dbf07f2b2500bb1be79ad06572683af66',product],{cwd:root});
 const before=historicalStaticPaths(previous),after=historicalStaticPaths(product),oldApi=historicalApiPaths(previous),newApi=historicalApiPaths(product);
 assert.equal(before.length,75);assert.deepEqual(after,before);for(const file of after)assert.ok(manifest().includes(file));
 assert.equal(oldApi.length,76);assert.deepEqual(newApi,oldApi);
 const apiFreeze=require('../tools/beta-api-freeze.js');
 const apiProtected=[...new Set([...newApi,...apiFreeze.BUILD_DEFINITION_FILES,...apiFreeze.REPOSITORY_INPUT_FILES])].sort();
 assert.equal(apiProtected.length,79);
 const changed=execFileSync('git',['diff','--name-only',previous,product],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
 assert.deepEqual(changed.filter(file=>after.includes(file)).sort(),[
  'faculty-admin-doe-rulebook.css','faculty-admin-doe-rulebook.js','faculty-admin-doe-worksheet.js','faculty-admin.js'
 ]);
 assert.deepEqual(changed.filter(file=>apiProtected.includes(file)),[]);
 for(const file of apiProtected)assert.equal(freeze.bytesMatch(freeze.readBaselineFile({root,baselineCommit:previous,file}),freeze.readBaselineFile({root,baselineCommit:product,file})),true,file);
});

test('Selected Schedule Export remains pinned as historical governance evidence',()=>{
 const product='bb6b86611a1c9eba2479f158ba864d63626b0b4d',previous='a3dd9ca9e5324cc6889d09c7a0a1ad08993c8bca';
 const historicalSource=execFileSync('git',['show',`${SELECTED_SCHEDULE_GOVERNANCE_COMMIT}:tools/beta-freeze.js`],{cwd:root,encoding:'utf8'});
 const historicalReport=JSON.parse(execFileSync('git',['show',`${SELECTED_SCHEDULE_GOVERNANCE_COMMIT}:tools/beta-baseline.json`],{cwd:root,encoding:'utf8'}));
 assert.ok(historicalSource.includes(`const BASELINE_COMMIT='${product}'`));assert.equal(historicalReport.sourceCommit,product);
 const before=historicalStaticPaths(previous),after=historicalStaticPaths(product),oldApi=historicalApiPaths(previous),newApi=historicalApiPaths(product);
 assert.equal(before.length,75);assert.deepEqual(after,before);assert.equal(oldApi.length,76);assert.deepEqual(newApi,oldApi);
 const changed=execFileSync('git',['diff','--name-only',previous,product],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
 assert.deepEqual(changed.filter(file=>after.includes(file)).sort(),['timetable-selection.js','timetable.css','timetable.js']);
 assert.deepEqual(changed.filter(file=>newApi.includes(file)),[]);
 for(const file of newApi)assert.equal(freeze.bytesMatch(freeze.readBaselineFile({root,baselineCommit:previous,file}),freeze.readBaselineFile({root,baselineCommit:product,file})),true,file);
});

test('historical Scheduling Tasks freeze pins the reviewed product and preserves exact static and API coverage',()=>{
 const historicalSource=execFileSync('git',['show','a356df195c10f0b5464dfaceed2125985f40b8a1:tools/beta-freeze.js'],{cwd:root,encoding:'utf8'});
 const historicalReport=JSON.parse(execFileSync('git',['show','a356df195c10f0b5464dfaceed2125985f40b8a1:tools/beta-baseline.json'],{cwd:root,encoding:'utf8'}));
 assert.ok(historicalSource.includes("const BASELINE_COMMIT='"+SCHEDULING_PRODUCT_COMMIT+"'"));assert.equal(historicalReport.sourceCommit,SCHEDULING_PRODUCT_COMMIT);
 const before=historicalStaticPaths(ADFA_PRODUCT_COMMIT),after=historicalStaticPaths(SCHEDULING_PRODUCT_COMMIT),oldApi=historicalApiPaths(ADFA_PRODUCT_COMMIT),newApi=historicalApiPaths(SCHEDULING_PRODUCT_COMMIT);
 assert.equal(before.length,75);assert.equal(after.length,75);assert.equal(oldApi.length,73);assert.equal(newApi.length,76);
 assert.deepEqual(before.filter(file=>!after.includes(file)),[]);assert.deepEqual(oldApi.filter(file=>!newApi.includes(file)),[]);
 assert.deepEqual(after.filter(file=>!before.includes(file)),[]);
 assert.deepEqual(newApi.filter(file=>!oldApi.includes(file)).sort(),['server/src/data/sql-scheduling-task-repository.js','server/src/runtime/swa-scheduling-task-functions.js','server/src/scheduling/scheduling-task-api.js']);
 const changed=execFileSync('git',['diff','--name-only',ADFA_PRODUCT_COMMIT,SCHEDULING_PRODUCT_COMMIT],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
 assert.deepEqual(changed.filter(file=>after.includes(file)).sort(),['paws-data-client.js','timetable.js','workspace-tasks.js','workspace.css']);
 assert.deepEqual(changed.filter(file=>newApi.includes(file)).sort(),['server/src/data/sql-scheduling-task-repository.js','server/src/data/write-gates.js','server/src/runtime/swa-scheduling-task-functions.js','server/src/runtime/swa-sql-runtime.js','server/src/scheduling/scheduling-task-api.js']);
});

test('historical ADFA SWAP freeze preserves its reviewed product and exact static and API delta',()=>{
 const historicalSource=execFileSync('git',['show','c6dab5d39ba3e15fad825c587327dabf51974665:tools/beta-freeze.js'],{cwd:root,encoding:'utf8'});
 const historicalReport=JSON.parse(execFileSync('git',['show','c6dab5d39ba3e15fad825c587327dabf51974665:tools/beta-baseline.json'],{cwd:root,encoding:'utf8'}));
 assert.ok(historicalSource.includes("const BASELINE_COMMIT='"+ADFA_PRODUCT_COMMIT+"'"));assert.equal(historicalReport.sourceCommit,ADFA_PRODUCT_COMMIT);
 const before=historicalStaticPaths(CALENDAR_PRODUCT_COMMIT),after=historicalStaticPaths(ADFA_PRODUCT_COMMIT),oldApi=historicalApiPaths(CALENDAR_PRODUCT_COMMIT),newApi=historicalApiPaths(ADFA_PRODUCT_COMMIT);
 assert.equal(before.length,74);assert.equal(after.length,75);assert.equal(oldApi.length,73);assert.equal(newApi.length,73);
 assert.deepEqual(before.filter(file=>!after.includes(file)),[]);assert.deepEqual(oldApi.filter(file=>!newApi.includes(file)),[]);
 assert.deepEqual(after.filter(file=>!before.includes(file)),['adfa-swap-panel.js']);
 const changed=execFileSync('git',['diff','--name-only',CALENDAR_PRODUCT_COMMIT,ADFA_PRODUCT_COMMIT],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
 assert.deepEqual(changed.filter(file=>after.includes(file)).sort(),['adfa-swap-panel.js','index.html','paws-data-client.js','swap-workflow-sql.css','swap-workflow-sql.js']);
 assert.deepEqual(changed.filter(file=>newApi.includes(file)).sort(),['server/src/data/sql-swap-repository.js','server/src/runtime/swa-sql-runtime.js','server/src/runtime/swa-swap-functions.js','server/src/swap/swap-api.js']);
});

test('Calendar activity freeze promotion pins the accepted product with no runtime exception',()=>{
 const historicalSource=execFileSync('git',['show','9f4290d057629c0583d41a6e03616e0204a71a82:tools/beta-freeze.js'],{cwd:root,encoding:'utf8'});
 const historicalReport=JSON.parse(execFileSync('git',['show','9f4290d057629c0583d41a6e03616e0204a71a82:tools/beta-baseline.json'],{cwd:root,encoding:'utf8'}));
 assert.ok(historicalSource.includes("const BASELINE_COMMIT='"+CALENDAR_PRODUCT_COMMIT+"'"));
 assert.equal(historicalReport.sourceCommit,CALENDAR_PRODUCT_COMMIT);
 execFileSync('git',['merge-base','--is-ancestor',CALENDAR_PRODUCT_COMMIT,BASELINE_COMMIT],{cwd:root});
});

test('Calendar activity freeze promotion preserves AFC LAB coverage and names the exact runtime delta',()=>{
 const previous='fb2c625745957fa7d9990033f15a7b1ef91974a5',accepted='7526e86f295de062c228fb1ddee2f007706285c2';
 const before=historicalStaticPaths(previous),after=historicalStaticPaths(accepted),oldApi=historicalApiPaths(previous),newApi=historicalApiPaths(accepted);
 assert.equal(before.length,71);assert.equal(after.length,74);assert.equal(oldApi.length,67);assert.equal(newApi.length,73);
 assert.deepEqual(before.filter(file=>!after.includes(file)),[]);assert.deepEqual(oldApi.filter(file=>!newApi.includes(file)),[]);
 assert.deepEqual(after.filter(file=>!before.includes(file)).sort(),['calendar-activities.css','calendar-activities.js','faculty-admin-activity-import.js']);
 const changed=execFileSync('git',['diff','--name-only',previous,accepted],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
 assert.deepEqual(changed.filter(file=>after.includes(file)).sort(),['calendar-activities.css','calendar-activities.js','faculty-admin-activity-import.js','faculty-admin.html','faculty-admin.js','index.html','paws-data-client.js','swap-workflow-sql.js','timetable.js']);
 assert.deepEqual(changed.filter(file=>newApi.includes(file)).sort(),['server/src/calendar/activity-import-policy.js','server/src/calendar/activity-workbook-worker.js','server/src/calendar/activity-workbook.js','server/src/calendar/calendar-activity-api.js','server/src/data/sql-calendar-activity-repository.js','server/src/data/sql-swap-repository.js','server/src/data/write-gates.js','server/src/runtime/swa-calendar-activity-functions.js','server/src/runtime/swa-sql-runtime.js','server/src/runtime/university-http-server.js','swa-api/index.js','swa-api/package-lock.json','swa-api/package.json']);
 execFileSync('git',['merge-base','--is-ancestor',previous,accepted],{cwd:root});
});

// A. Baseline identity -------------------------------------------------------
test('beta identity is pinned to the DOE Rule Book / Faculty Lookup product baseline',()=>{
  assert.equal(baseline.sourceCommit,BASELINE_COMMIT);
  assert.equal(baseline.siteUrl,'https://tester-teaching.web.app');
  assert.equal(freeze.BASELINE_COMMIT,BASELINE_COMMIT);
});

test('the promoted dual-runtime baseline exists as a Git commit and is an ancestor of HEAD',()=>{
  assert.equal(freeze.baselineCommitExists(root,BASELINE_COMMIT),true);
  execFileSync('git',['merge-base','--is-ancestor',BASELINE_COMMIT,'HEAD'],{cwd:root});
});

test('W1F history remains the accepted W1D product before W1E governance',()=>{
  const isAncestor=(ancestor,descendant)=>execFileSync('git',['merge-base','--is-ancestor',ancestor,descendant],{cwd:root});
  assert.equal(W1F_FREEZE_COMMIT,'da21223a1d92572ff72767796229a655d122efb4');
  for(const [ancestor,descendant] of [
    [PREVIOUS_FREEZE_COMMIT,W1C_PRODUCT_COMMIT],
    [W1C_PRODUCT_COMMIT,W1C_ACCEPTED_TIP],
    [W1C_ACCEPTED_TIP,W1F_FREEZE_COMMIT],
    [W1F_FREEZE_COMMIT,W1D_ACCEPTED_TIP],
    [W1D_ACCEPTED_TIP,W1E_ACCEPTED_TIP],
    [W1E_ACCEPTED_TIP,'HEAD']
  ])assert.doesNotThrow(()=>isAncestor(ancestor,descendant),`${ancestor} must precede ${descendant}`);
  const integrationCommits=execFileSync('git',['rev-list','--reverse',`${W1F_MAIN_COMMIT}..${W1F_FREEZE_COMMIT}`],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
  assert.deepEqual(integrationCommits,[W1C_PRODUCT_COMMIT,W1C_ACCEPTED_TIP,W1F_FREEZE_COMMIT],
    'the historical W1F anchor must contain only the accepted W1C/W1D product chain, without unrelated commits');
});

test('W1H freeze promotion preserves coverage and permits only the exact reviewed protected delta',()=>{
  const apiFreeze=require('../tools/beta-api-freeze.js');
  const w1fStatic=historicalStaticPaths(W1F_FREEZE_COMMIT);
  const w1hStatic=historicalStaticPaths(W1H_PRODUCT_COMMIT);
  const w1fApi=historicalApiPaths(W1F_FREEZE_COMMIT);
  const w1hApi=historicalApiPaths(W1H_PRODUCT_COMMIT);
  assert.equal(w1fStatic.length,52);
  assert.equal(w1hStatic.length,52);
  assert.deepEqual(w1fStatic.filter(name=>!w1hStatic.includes(name)),[]);
  assert.deepEqual(w1hStatic.filter(name=>!w1fStatic.includes(name)),[]);
  assert.equal(w1fApi.length,34);
  assert.equal(w1hApi.length,34);
  assert.deepEqual(w1fApi.filter(name=>!w1hApi.includes(name)),[]);
  assert.deepEqual(w1hApi.filter(name=>!w1fApi.includes(name)),[]);

  const changed=(paths)=>paths.filter(name=>!freeze.bytesMatch(
    freeze.readBaselineFile({root,baselineCommit:W1F_FREEZE_COMMIT,file:name}),
    freeze.readBaselineFile({root,baselineCommit:W1H_PRODUCT_COMMIT,file:name})
  )).sort();
  assert.deepEqual(changed(w1hStatic),['afc-workflow-sql.js','paws-data-client.js'],
    'static protected delta must contain only the two reviewed W1H client assets');
  assert.deepEqual(changed(w1hApi),[
    'server/src/afc/afc-approval-api.js',
    'server/src/afc/afc-approved-artifact-api.js',
    'server/src/afc/afc-request-api.js',
    'server/src/data/write-gates.js',
    'server/src/runtime/swa-afc-request-functions.js',
    'server/src/runtime/swa-sql-runtime.js'
  ],'API protected delta must contain only the six reviewed W1H authority files');

  const gates=freeze.readBaselineFile({root,baselineCommit:W1H_PRODUCT_COMMIT,file:'server/src/data/write-gates.js'}).toString('utf8');
  for(const envName of [
    'PAWS_AFC_REQUEST_WRITE_ENABLED','PAWS_AFC_DECISION_WRITE_ENABLED','PAWS_AFC_ARTIFACT_WRITE_ENABLED',
    'PAWS_AFC_SINGLE_WRITE_ENABLED','PAWS_AFC_BATCH_WRITE_ENABLED','PAWS_SESSION_EDIT_WRITE_ENABLED'
  ]){
    assert.ok(gates.includes(`${envName} === 'true'`),`${envName} must remain an independent exact-true gate`);
  }
  assert.doesNotMatch(gates,/ALL_WRITES_ENABLED|AFC_ALL_WRITES/,
    'W1H must not replace the independent domain gates with a global write switch');

  const migration017='database/azure-sql/017_w1e_runtime_least_privilege.sql';
  assert.deepEqual(freeze.readBaselineFile({root,baselineCommit:W1E_ACCEPTED_TIP,file:migration017}),
    freeze.readBaselineFile({root,baselineCommit:W1H_PRODUCT_COMMIT,file:migration017}),`${migration017} must remain byte-identical`);
  const migration018='database/azure-sql/018_w1h_afc_runtime_write_roles.sql';
  assert.ok(execFileSync('git',['cat-file','-e',`${W1H_PRODUCT_COMMIT}:${migration018}`],{cwd:root}));
});

test('W1M freeze promotion preserves coverage and permits only the University HTTP adapter delta',()=>{
  const apiFreeze=require('../tools/beta-api-freeze.js');
  const w1hStatic=historicalStaticPaths(W1H_PRODUCT_COMMIT);
  const w1mStatic=historicalStaticPaths(W1M_PRODUCT_COMMIT);
  const w1hApi=historicalApiPaths(W1H_PRODUCT_COMMIT);
  const w1mApi=historicalApiPaths(W1M_PRODUCT_COMMIT);
  assert.equal(w1hStatic.length,52);
  assert.equal(w1mStatic.length,52);
  assert.equal(w1hApi.length,34);
  assert.equal(w1mApi.length,34);
  assert.deepEqual(w1hStatic.filter(name=>!w1mStatic.includes(name)),[]);
  assert.deepEqual(w1mStatic.filter(name=>!w1hStatic.includes(name)),[]);
  const changed=paths=>paths.filter(name=>!freeze.bytesMatch(
    freeze.readBaselineFile({root,baselineCommit:W1H_PRODUCT_COMMIT,file:name}),
    freeze.readBaselineFile({root,baselineCommit:W1M_PRODUCT_COMMIT,file:name})
  )).sort();
  assert.deepEqual(changed(w1mStatic),[],'W1M must not change protected static runtime bytes');
  assert.deepEqual(changed(w1mApi),['server/src/runtime/university-http-server.js'],
    'W1M may change only the protected University HTTP adapter');
});

test('P1 freeze promotion preserves coverage and permits only the reviewed DOE/dashboard/write API delta',()=>{
  const apiFreeze=require('../tools/beta-api-freeze.js');
  const w1mStatic=historicalStaticPaths(W1M_PRODUCT_COMMIT);
  const p1Static=historicalStaticPaths(P1_PRODUCT_COMMIT);
  const w1mApi=historicalApiPaths(W1M_PRODUCT_COMMIT);
  const p1Api=historicalApiPaths(P1_PRODUCT_COMMIT);
  assert.equal(w1mStatic.length,52);
  assert.equal(p1Static.length,52);
  assert.equal(w1mApi.length,34);
  assert.equal(p1Api.length,34);
  assert.deepEqual(w1mStatic.filter(name=>!p1Static.includes(name)),[]);
  assert.deepEqual(p1Static.filter(name=>!w1mStatic.includes(name)),[]);
  assert.deepEqual(w1mApi.filter(name=>!p1Api.includes(name)),[]);
  assert.deepEqual(p1Api.filter(name=>!w1mApi.includes(name)),[]);

  const changed=paths=>paths.filter(name=>!freeze.bytesMatch(
    freeze.readBaselineFile({root,baselineCommit:W1M_PRODUCT_COMMIT,file:name}),
    freeze.readBaselineFile({root,baselineCommit:P1_PRODUCT_COMMIT,file:name})
  )).sort();
  assert.deepEqual(changed(p1Static),[
    'faculty-admin-doe-renderer.js','faculty-admin.js','paws-data-client.js','timetable.js'
  ],'P1 protected static delta must match the reviewed product assets');
  assert.deepEqual(changed(p1Api),[
    'server/src/afc/afc-request-api.js','server/src/data/data-api.js',
    'server/src/data/sql-session-repository.js','server/src/data/write-gates.js',
    'server/src/runtime/swa-functions.js','server/src/runtime/swa-sql-runtime.js',
    'server/src/runtime/university-http-server.js'
  ],'P1 protected API delta must match the reviewed API/runtime files');
  execFileSync('git',['merge-base','--is-ancestor',W1M_PRODUCT_COMMIT,P1_PRODUCT_COMMIT],{cwd:root});
  execFileSync('git',['merge-base','--is-ancestor',P1_PRODUCT_COMMIT,P2_PRODUCT_COMMIT],{cwd:root});
  execFileSync('git',['merge-base','--is-ancestor',BASELINE_COMMIT,'HEAD'],{cwd:root});
});

test('P2 freeze promotion preserves the P1 runtime and adds only the teaching-assignment workflow delta',()=>{
  const p1Static=historicalStaticPaths(P1_PRODUCT_COMMIT);
  const p2Static=historicalStaticPaths(P2_PRODUCT_COMMIT);
  const p1Api=historicalApiPaths(P1_PRODUCT_COMMIT);
  const p2Api=historicalApiPaths(P2_PRODUCT_COMMIT);
  assert.equal(p1Static.length,52);
  assert.equal(p2Static.length,55);
  assert.deepEqual(p1Static.filter(file=>!p2Static.includes(file)),[]);
  assert.deepEqual(p2Static.filter(file=>!p1Static.includes(file)),[
    'teaching-assignments.css','teaching-assignments.html','teaching-assignments.js'
  ]);
  assert.equal(p1Api.length,34);
  assert.equal(p2Api.length,37);
  assert.deepEqual(p1Api.filter(file=>!p2Api.includes(file)),[]);
  assert.deepEqual(p2Api.filter(file=>!p1Api.includes(file)),[
    'server/src/data/sql-teaching-assignment-workflow-repository.js',
    'server/src/runtime/swa-teaching-assignment-functions.js',
    'server/src/teaching-assignment/teaching-assignment-api.js'
  ]);
  const changed=(paths,previous,current)=>paths.filter(file=>{
    let before;
    try{before=freeze.readBaselineFile({root,baselineCommit:previous,file});}catch{}
    let after;
    try{after=freeze.readBaselineFile({root,baselineCommit:current,file});}catch{}
    return !before||!after||!freeze.bytesMatch(before,after);
  }).sort();
  assert.deepEqual(changed(p2Static,P1_PRODUCT_COMMIT,P2_PRODUCT_COMMIT),[
    'asset-loader.js','faculty-admin.html','index.html','paws-data-client.js','teaching-assignments.css',
    'teaching-assignments.html','teaching-assignments.js','timetable.js'
  ]);
  assert.deepEqual(changed(p2Api,P1_PRODUCT_COMMIT,P2_PRODUCT_COMMIT),[
    'server/src/data/sql-teaching-assignment-workflow-repository.js','server/src/data/write-gates.js',
    'server/src/runtime/swa-sql-runtime.js','server/src/runtime/swa-teaching-assignment-functions.js',
    'server/src/teaching-assignment/teaching-assignment-api.js'
  ]);
});

test('W1H protected static and API paths retain W1F coverage and historical bytes',()=>{
  const apiFreeze=require('../tools/beta-api-freeze.js');
  const oldStatic=baselineJson(PREVIOUS_FREEZE_COMMIT);
  const w1cStatic=baselineJson(W1C_ACCEPTED_TIP);
  const w1dStatic=baselineJson(W1D_ACCEPTED_TIP);
  const promotedStatic=historicalStaticPaths(W1H_PRODUCT_COMMIT);
  const allStatic=new Set([...oldStatic,...w1cStatic,...w1dStatic]);
  assert.equal(promotedStatic.length,52);
  for(const name of allStatic)assert.ok(promotedStatic.includes(name),`${name} must remain protected`);
  for(const name of promotedStatic){
    assert.equal(freeze.bytesMatch(
      freeze.readBaselineFile({root,baselineCommit:W1F_FREEZE_COMMIT,file:name}),
      freeze.readBaselineFile({root,baselineCommit:W1E_ACCEPTED_TIP,file:name})
    ),true,`static bytes must match at W1F anchor and W1E head: ${name}`);
  }

  const promotedApi=historicalApiPaths(W1M_PRODUCT_COMMIT);
  const priorApi=historicalApiPaths(PREVIOUS_FREEZE_COMMIT);
  const w1cApi=historicalApiPaths(W1C_ACCEPTED_TIP);
  const w1dApi=historicalApiPaths(W1D_ACCEPTED_TIP);
  assert.equal(promotedApi.length,34);
  for(const name of new Set([...priorApi,...w1cApi,...w1dApi])){
    assert.ok(promotedApi.includes(name),`API protected path must remain protected: ${name}`);
  }
  for(const name of promotedApi){
    assert.equal(freeze.bytesMatch(
      freeze.readBaselineFile({root,baselineCommit:W1F_FREEZE_COMMIT,file:name}),
      freeze.readBaselineFile({root,baselineCommit:W1E_ACCEPTED_TIP,file:name})
    ),true,`API bytes must match at W1F anchor and W1E head: ${name}`);
  }
});

// B. Zero drift --------------------------------------------------------------
test('the Calendar workspace product frozen runtime reports zero protected drift',()=>{
  const result=freeze.verifyFreeze({root});
  assert.equal(result.baselineCommit,BASELINE_COMMIT);
  assert.deepEqual(result.drift,[]);
  assert.equal(result.ok,true);
  assert.equal(result.protected,91);
});

test('the current static manifest has exactly 91 protected files',()=>{
  assert.equal(manifest().length,91);
  assert.equal(freeze.protectedPaths({root}).length,91);
});

test('freeze protects every shipped file named by the static asset manifest',()=>{
  const shipped=manifest();
  const protectedFiles=freeze.protectedPaths({root});
  assert.ok(shipped.length>0);
  for(const name of shipped)assert.ok(protectedFiles.includes(name),`${name} must be protected`);
  const legacy=['index.html','timetable.js','timetable.css','faculty-admin.html','faculty-admin.js'];
  for(const name of legacy)assert.ok(protectedFiles.includes(name),`${name} must remain protected`);
  for(const name of ['approval-workflow.js','scheduling-core.js'])assert.ok(protectedFiles.includes(name),`${name} must be protected`);
});

test('all 91 current protected files are byte-identical to the immutable accepted product blobs',()=>{
  const protectedFiles=freeze.protectedPaths({root});
  assert.equal(protectedFiles.length,91);
  for(const name of protectedFiles){
    assert.equal(freeze.bytesMatch(
      freeze.readBaselineFile({root,file:name}),
      fs.readFileSync(repositoryPath(root,name))
    ),true,name);
  }
});

test('the CCC Schedule freeze promotion adds exactly two static files and changes exactly three',()=>{
  const apiFreeze=require('../tools/beta-api-freeze.js');
  const previous='370c30a21d99ae7227f97f1e0cb781864c674768';
  // Superseded as the live anchor by the HICC–CC / VISC directory promotion; pinned as history.
  const accepted=CCC_SCHEDULE_PRODUCT_COMMIT;
  const before=JSON.parse(execFileSync('git',['show',previous+':tools/static-assets.json'],{cwd:root,encoding:'utf8'})).sort();
  const after=JSON.parse(execFileSync('git',['show',accepted+':tools/static-assets.json'],{cwd:root,encoding:'utf8'})).sort();
  assert.equal(before.length,83);
  assert.equal(after.length,85);
  assert.deepEqual(before.filter(name=>!after.includes(name)),[],'the promotion must not remove protection');
  assert.deepEqual(after.filter(name=>!before.includes(name)),['ccc-schedule.css','ccc-schedule.js']);
  execFileSync('git',['merge-base','--is-ancestor',accepted,BASELINE_COMMIT],{cwd:root});
  const changed=before.filter(name=>{
    const oldBlob=execFileSync('git',['show',previous+':'+name],{cwd:root,maxBuffer:1<<28});
    const newBlob=execFileSync('git',['show',accepted+':'+name],{cwd:root,maxBuffer:1<<28});
    return !freeze.bytesMatch(oldBlob,newBlob);
  }).sort();
  assert.deepEqual(changed,['index.html','paws-data-client.js','timetable.js']);
  // The API promotion is additive only and keeps the shared anchor.
  const previousApi=apiFreeze.baselineRuntimeFiles({root,baselineCommit:previous});
  const acceptedApi=apiFreeze.baselineRuntimeFiles({root,baselineCommit:accepted});
  assert.deepEqual(previousApi.filter(name=>!acceptedApi.includes(name)),[]);
  assert.deepEqual(acceptedApi.filter(name=>!previousApi.includes(name)),[
    'server/src/ccc/ccc-schedule-api.js',
    'server/src/data/sql-ccc-schedule-repository.js',
    'server/src/runtime/swa-ccc-schedule-functions.js'
  ]);
});

test('the HICC–CC / VISC directory promotion adds exactly two static and four API files and changes exactly the reviewed delta',()=>{
  const apiFreeze=require('../tools/beta-api-freeze.js');
  const previous=CCC_SCHEDULE_PRODUCT_COMMIT;
  const accepted='de4d3cacb395e71677ca4088c37ef5367895bf12';
  const historicalReport=JSON.parse(execFileSync('git',['show','d8dfcada:tools/beta-baseline.json'],{cwd:root,encoding:'utf8'}));
  execFileSync('git',['merge-base','--is-ancestor',previous,accepted],{cwd:root});
  const before=JSON.parse(execFileSync('git',['show',previous+':tools/static-assets.json'],{cwd:root,encoding:'utf8'})).sort();
  const after=JSON.parse(execFileSync('git',['show',accepted+':tools/static-assets.json'],{cwd:root,encoding:'utf8'})).sort();
  assert.equal(before.length,85);
  assert.equal(after.length,87);
  assert.deepEqual(before.filter(name=>!after.includes(name)),[],'the promotion must not remove protection');
  assert.deepEqual(after.filter(name=>!before.includes(name)),['leadership-directory.css','leadership-directory.js']);
  assert.equal(historicalReport.sourceCommit,accepted);
  assert.equal(Object.keys(historicalReport.sha256).length,87);
  const changed=before.filter(name=>{
    const oldBlob=execFileSync('git',['show',previous+':'+name],{cwd:root,maxBuffer:1<<28});
    const newBlob=execFileSync('git',['show',accepted+':'+name],{cwd:root,maxBuffer:1<<28});
    return !freeze.bytesMatch(oldBlob,newBlob);
  }).sort();
  assert.deepEqual(changed,['index.html','paws-data-client.js','timetable.js']);
  const previousApi=apiFreeze.baselineRuntimeFiles({root,baselineCommit:previous});
  const acceptedApi=apiFreeze.baselineRuntimeFiles({root,baselineCommit:accepted});
  assert.equal(previousApi.length,110);assert.equal(acceptedApi.length,114);
  assert.deepEqual(previousApi.filter(name=>!acceptedApi.includes(name)),[]);
  assert.deepEqual(acceptedApi.filter(name=>!previousApi.includes(name)).sort(),[
    'server/src/data/sql-leadership-directory-repository.js',
    'server/src/roles/leadership-directory-api.js',
    'server/src/roles/role-effective-status.js',
    'server/src/runtime/swa-leadership-directory-functions.js'
  ]);
  const diff=execFileSync('git',['diff','--name-only',previous,accepted],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
  assert.deepEqual(diff.filter(name=>previousApi.includes(name)).sort(),['server/src/runtime/swa-sql-runtime.js']);
  // No SQL change relative to the main it was built on (main's own later 057 test fixture edits excepted).
  const fromMain=execFileSync('git',['diff','--name-only','924cc6761a3b2dfba4f19c2df912436cbd965b43',accepted],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
  assert.deepEqual(fromMain.filter(name=>name.startsWith('database/')),[],'no SQL migration');
});

test('AUTH-1 freeze promotion preserves coverage and permits only its reviewed role-policy delta',()=>{
  const p3Static=historicalStaticPaths(P3_PRODUCT_COMMIT);
  const auth1Static=historicalStaticPaths(AUTH1_PRODUCT_COMMIT);
  const p3Api=historicalApiPaths(P3_PRODUCT_COMMIT);
  const auth1Api=historicalApiPaths(AUTH1_PRODUCT_COMMIT);
  assert.equal(p3Static.length,56);
  assert.equal(auth1Static.length,56);
  assert.deepEqual(p3Static.filter(name=>!auth1Static.includes(name)),[]);
  assert.deepEqual(auth1Static.filter(name=>!p3Static.includes(name)),[]);
  assert.equal(p3Api.length,38);
  assert.equal(auth1Api.length,39);

  const changed=(paths,from,to)=>paths.filter(name=>{
    try{
      return !freeze.bytesMatch(
        freeze.readBaselineFile({root,baselineCommit:from,file:name}),
        freeze.readBaselineFile({root,baselineCommit:to,file:name})
      );
    }catch{return true;}
  }).sort();
  assert.deepEqual(changed(auth1Static,P3_PRODUCT_COMMIT,AUTH1_PRODUCT_COMMIT),[
    'faculty-access.js','faculty-admin.js','timetable.js'
  ]);
  assert.deepEqual(changed([...new Set([...p3Api,...auth1Api])],P3_PRODUCT_COMMIT,AUTH1_PRODUCT_COMMIT),[
    'server/src/afc/afc-approved-artifact-renderer.js',
    'server/src/afc/afc-request-api.js',
    'server/src/auth/role-policy.js',
    'server/src/data/dashboard-api.js',
    'server/src/data/data-api.js',
    'server/src/data/sql-teaching-assignment-workflow-repository.js',
    'server/src/data/sql-user-repository.js',
    'server/src/teaching-assignment/teaching-assignment-api.js'
  ]);
  assert.ok(auth1Api.includes('server/src/auth/role-policy.js'));
  assert.notEqual(AUTH1_PRODUCT_COMMIT,BASELINE_COMMIT);
});

test('DOE Calculator freeze promotion preserves coverage and permits only the reviewed calculator delta',()=>{
  const auth1Static=historicalStaticPaths(AUTH1_PRODUCT_COMMIT);
  const doeStatic=historicalStaticPaths(DOE_CALCULATOR_BASELINE_COMMIT);
  const auth1Api=historicalApiPaths(AUTH1_PRODUCT_COMMIT);
  const doeApi=historicalApiPaths(DOE_CALCULATOR_BASELINE_COMMIT);
  assert.equal(auth1Static.length,56);
  assert.equal(doeStatic.length,56);
  assert.deepEqual(auth1Static.filter(name=>!doeStatic.includes(name)),[]);
  assert.deepEqual(doeStatic.filter(name=>!auth1Static.includes(name)),[]);
  assert.equal(auth1Api.length,39);
  assert.equal(doeApi.length,41);

  const changed=(paths,from,to)=>paths.filter(name=>{
    try{
      return !freeze.bytesMatch(
        freeze.readBaselineFile({root,baselineCommit:from,file:name}),
        freeze.readBaselineFile({root,baselineCommit:to,file:name})
      );
    }catch{return true;}
  }).sort();
  assert.deepEqual(changed(doeStatic,AUTH1_PRODUCT_COMMIT,DOE_CALCULATOR_BASELINE_COMMIT),[
    'dashboard-view-model.js',
    'faculty-admin-doe-renderer.js',
    'faculty-admin.html',
    'faculty-admin.js'
  ]);
  assert.deepEqual(changed([...new Set([...auth1Api,...doeApi])],AUTH1_PRODUCT_COMMIT,DOE_CALCULATOR_BASELINE_COMMIT),[
    'server/src/data/sql-dashboard-repository.js',
    'server/src/domain/doe-calculator.js',
    'server/src/domain/doe-course-catalog-2026-27.js',
    'server/src/domain/doe-rule-book.js'
  ]);
  assert.ok(doeApi.includes('server/src/domain/doe-calculator.js'));
  assert.ok(doeApi.includes('server/src/domain/doe-course-catalog-2026-27.js'));
});

test('P4 freeze promotion preserves DOE Calculator coverage and adds only the reviewed DOE engine delta',()=>{
  const apiFreeze=require('../tools/beta-api-freeze.js');
  const calculatorStatic=historicalStaticPaths(DOE_CALCULATOR_BASELINE_COMMIT);
  const p4Static=historicalStaticPaths(P4_PRODUCT_COMMIT);
  const calculatorApi=historicalApiPaths(DOE_CALCULATOR_BASELINE_COMMIT);
  const p4Api=historicalApiPaths(P4_PRODUCT_COMMIT);
  assert.equal(calculatorStatic.length,56);
  assert.equal(p4Static.length,59);
  assert.deepEqual(calculatorStatic.filter(name=>!p4Static.includes(name)),[]);
  assert.deepEqual(p4Static.filter(name=>!calculatorStatic.includes(name)),[
    'faculty-admin-doe-edit.js','faculty-admin-doe-policy.js','faculty-admin-doe-worksheet.js'
  ]);
  assert.equal(calculatorApi.length,41);
  assert.equal(p4Api.length,58);
  assert.deepEqual(calculatorApi.filter(name=>!p4Api.includes(name)),[]);
  assert.deepEqual(p4Api.filter(name=>!calculatorApi.includes(name)),[
    'server/src/data/sql-doe-assignment-repository.js','server/src/data/sql-doe-engine-repository.js',
    'server/src/data/sql-doe-policy-repository.js','server/src/data/sql-doe-target-override-repository.js',
    'server/src/data/sql-doe-worksheet-repository.js','server/src/doe/doe-api.js',
    'server/src/doe/doe-assignment-service.js','server/src/doe/doe-calculation-service.js',
    'server/src/doe/doe-policy-service.js','server/src/doe/doe-reserve-service.js',
    'server/src/doe/doe-session-service.js','server/src/doe/doe-target-override-service.js',
    'server/src/doe/doe-workflow-preview-service.js','server/src/doe/doe-worksheet-service.js',
    'server/src/domain/doe-formula.js','server/src/domain/doe-policy-engine.js',
    'server/src/runtime/swa-doe-functions.js'
  ]);
  const changed=(paths,from,to)=>paths.filter(name=>{
    try{return !freeze.bytesMatch(
      freeze.readBaselineFile({root,baselineCommit:from,file:name}),
      freeze.readBaselineFile({root,baselineCommit:to,file:name})
    );}catch{return true;}
  }).sort();
  assert.deepEqual(changed([...new Set([...calculatorStatic,...p4Static])],DOE_CALCULATOR_BASELINE_COMMIT,P4_PRODUCT_COMMIT),[
    'faculty-admin-doe-edit.js','faculty-admin-doe-policy.js','faculty-admin-doe-worksheet.js',
    'faculty-admin-enhancements.js','faculty-admin-management.js','faculty-admin.css',
    'faculty-admin.html','faculty-admin.js','paws-data-client.js','timetable.js'
  ]);
  assert.deepEqual(changed([...new Set([...calculatorApi,...p4Api])],DOE_CALCULATOR_BASELINE_COMMIT,P4_PRODUCT_COMMIT),[
    'server/src/data/data-api.js','server/src/data/sql-doe-assignment-repository.js',
    'server/src/data/sql-doe-engine-repository.js','server/src/data/sql-doe-policy-repository.js',
    'server/src/data/sql-doe-target-override-repository.js','server/src/data/sql-doe-worksheet-repository.js',
    'server/src/data/write-gates.js','server/src/doe/doe-api.js','server/src/doe/doe-assignment-service.js',
    'server/src/doe/doe-calculation-service.js','server/src/doe/doe-policy-service.js',
    'server/src/doe/doe-reserve-service.js','server/src/doe/doe-session-service.js',
    'server/src/doe/doe-target-override-service.js','server/src/doe/doe-workflow-preview-service.js',
    'server/src/doe/doe-worksheet-service.js','server/src/domain/doe-formula.js',
    'server/src/domain/doe-policy-engine.js','server/src/runtime/swa-doe-functions.js',
    'server/src/runtime/swa-sql-runtime.js'
  ]);
  assert.equal(apiFreeze.BASELINE_COMMIT,BASELINE_COMMIT);
});
// C. New asset protection ----------------------------------------------------
test('B2B login/auth helper assets are protected runtime assets',()=>{
  for(const name of ['paws-data-client.js','paws-auth-continuity.js','paws-login-performance.js']){
    assert.ok(manifest().includes(name),name);
    assert.ok(freeze.protectedPaths({root}).includes(name),name);
    const result=freeze.verifyFreeze({root,files:[name]});
    assert.equal(result.ok,true,name);
    assert.deepEqual(result.drift,[],name);
  }
});

// D. Historical static baseline continuity and exact P3B3 delta ------------
test('P3B3 preserves all P3B2 static paths and adds only the SQL AFC workflow module',()=>{
  const previous=baselineJson(PREVIOUS_P3B2_BASELINE_COMMIT);
  const current=baselineJson(P3B3_BASELINE_COMMIT);
  assert.equal(previous.length,48);
  assert.equal(current.length,49);
  assert.deepEqual(previous.filter(name=>!current.includes(name)),[]);
  assert.deepEqual(current.filter(name=>!previous.includes(name)),['afc-workflow-sql.js']);
});

test('the P3B3 duplicate-submit fix changes only afc-workflow-sql.js from its previous candidate',()=>{
  const changed=[];
  for(const name of baselineJson(P3B3_BASELINE_COMMIT)){
    if(!freeze.bytesMatch(
      freeze.readBaselineFile({root,baselineCommit:PREVIOUS_P3B3_BASELINE_COMMIT,file:name}),
      freeze.readBaselineFile({root,baselineCommit:P3B3_BASELINE_COMMIT,file:name})
    ))changed.push(name);
  }
  assert.deepEqual(changed,['afc-workflow-sql.js']);
});

test('P3B3 changes only the reviewed AFC frontend assets from P3B2',()=>{
  const previousPaths=baselineJson(PREVIOUS_P3B2_BASELINE_COMMIT);
  const currentPaths=baselineJson(P3B3_BASELINE_COMMIT);
  const union=[...new Set([...previousPaths,...currentPaths])].sort();
  assert.equal(previousPaths.length,48);
  assert.equal(currentPaths.length,49);
  assert.equal(union.length,49);
  const changed=[];
  for(const name of union){
    let before=null,after=null;
    try{before=freeze.readBaselineFile({root,baselineCommit:PREVIOUS_P3B2_BASELINE_COMMIT,file:name});}catch{}
    try{after=freeze.readBaselineFile({root,baselineCommit:P3B3_BASELINE_COMMIT,file:name});}catch{}
    if(!before||!after||!freeze.bytesMatch(before,after))changed.push(name);
  }
  assert.deepEqual(changed,['afc-workflow-sql.js','afc-workflow.js','index.html','paws-data-client.js']);
});

test('the P3B2 frontend preserved all P2A static paths and changed only the PAWS data client',()=>{
  const previous=baselineJson(PREVIOUS_STATIC_BASELINE_COMMIT);
  const p3b2=baselineJson(PREVIOUS_P3B2_BASELINE_COMMIT);
  assert.equal(previous.length,48);
  assert.equal(p3b2.length,48);
  assert.deepEqual(previous.filter(name=>!p3b2.includes(name)),[]);
  assert.deepEqual(p3b2.filter(name=>!previous.includes(name)),[]);
  const changed=[];
  for(const name of previous){
    if(!freeze.bytesMatch(
      freeze.readBaselineFile({root,baselineCommit:PREVIOUS_STATIC_BASELINE_COMMIT,file:name}),
      freeze.readBaselineFile({root,baselineCommit:PREVIOUS_P3B2_BASELINE_COMMIT,file:name})
    ))changed.push(name);
  }
  assert.deepEqual(changed,['paws-data-client.js']);
});

test('the P3B3 static manifest preserves the frozen P2A-to-P3B2 manifest',()=>{
  assert.equal(freeze.bytesMatch(
    freeze.readBaselineFile({root,baselineCommit:PREVIOUS_STATIC_BASELINE_COMMIT,file:'tools/static-assets.json'}),
    freeze.readBaselineFile({root,baselineCommit:PREVIOUS_P3B2_BASELINE_COMMIT,file:'tools/static-assets.json'})
  ),true);
});

test('every P2A protected path is still protected under the P3B4 baseline',()=>{
  const previous=baselineJson(PREVIOUS_STATIC_BASELINE_COMMIT);
  const protectedFiles=freeze.protectedPaths({root});
  for(const name of previous)assert.ok(protectedFiles.includes(name),name+' must remain protected');
});

test('B0 runtime candidate files are protected and byte-identical to the promoted baseline',()=>{
  for(const name of ['asset-loader.js','approval-workflow.js','afc-workflow.js']){
    assert.ok(freeze.protectedPaths({root}).includes(name),`${name} must be protected`);
    assert.equal(freeze.bytesMatch(
      freeze.readBaselineFile({root,file:name}),
      fs.readFileSync(repositoryPath(root,name))
    ),true,name);
  }
});

// E. Mutable-manifest attack -------------------------------------------------
test('removing a shipped file from the mutable manifest cannot drop it from the freeze',()=>{
  const protectedFiles=freeze.protectedPaths({root,readManifest:()=>['index.html']});
  assert.ok(protectedFiles.includes('approval-workflow.js'));
  assert.ok(protectedFiles.includes('scheduling-core.js'));
  assert.ok(protectedFiles.includes('paws-data-client.js'));
  assert.ok(protectedFiles.includes('paws-auth-continuity.js'));
  assert.ok(protectedFiles.includes('paws-login-performance.js'));
  // protection must stay at the full baseline manifest, not collapse to the rigged manifest
  assert.equal(protectedFiles.length,freeze.readBaselineManifest({root}).length);
  assert.equal(protectedFiles.length,91);
});

// F. Mutable-hash attack -----------------------------------------------------
test('a runtime edit plus a matching beta-baseline.json edit cannot bypass the freeze',()=>{
  const file='approval-workflow.js';
  const baselineObject=freeze.readBaselineFile({root,file});
  const tampered=Buffer.concat([baselineObject,Buffer.from('\n// tampered by an unauthorized change\n')]);
  // The coordinated edit updates the mutable manifest so it agrees with the tampered file.
  const colludingHash=freeze.sha256Canonical(tampered);
  assert.equal(colludingHash,crypto.createHash('sha256').update(freeze.normalize(tampered),'utf8').digest('hex'));
  const result=freeze.verifyFreeze({root,files:[file],readWorking:()=>tampered});
  assert.equal(result.ok,false);
  assert.deepEqual(result.drift,[{file,reason:'content-drift'}]);
});

test('beta-baseline.json hashes are derived from the frozen baseline commit',()=>{
  for(const [name,expected] of Object.entries(baseline.sha256)){
    const baselineObject=freeze.readBaselineFile({root,file:name});
    const actual=crypto.createHash('sha256').update(freeze.normalize(baselineObject),'utf8').digest('hex');
    assert.equal(actual,expected,name);
  }
});

test('beta-baseline.json remains non-authoritative and records the stabilized Beta product baseline',()=>{
  assert.equal(baseline.sourceCommit,freeze.BASELINE_COMMIT);
  assert.equal(Object.keys(baseline.sha256).length,91);
  assert.ok(baseline.sha256['faculty-admin-management.js']);
  assert.ok(baseline.sha256['afc-workflow.js']);
  assert.ok(baseline.sha256['afc-workflow-sql.js']);
  assert.ok(baseline.sha256['paws-auth-continuity.js']);
  assert.ok(baseline.sha256['paws-login-performance.js']);
  // Verification never reads this file: a drift verdict comes from Git objects only.
  const result=freeze.verifyFreeze({root,files:['timetable.js'],readWorking:()=>Buffer.from('tampered\n')});
  assert.equal(result.ok,false);
});

// G. Dual-runtime baseline ---------------------------------------------------
test('API freeze shares the promoted HICC–CC / VISC directory static baseline and has zero runtime drift',()=>{
  const apiFreeze=require('../tools/beta-api-freeze.js');
  assert.equal(apiFreeze.BASELINE_COMMIT,BASELINE_COMMIT);
  assert.equal(apiFreeze.BASELINE_COMMIT,freeze.BASELINE_COMMIT);
  const result=apiFreeze.verifyFreeze({root});
  assert.deepEqual(result.drift,[]);
  assert.equal(result.ok,true);
  assert.equal(result.runtimeFiles.length,115);
  assert.equal(result.buildDefinitionFiles.length,1);
  assert.deepEqual(result.repositoryInputFiles,['server/package.json','server/package-lock.json']);
  assert.equal(result.protected,118);
  assert.ok(result.runtimeFiles.includes('server/src/auth/role-policy.js'));
  assert.ok(result.runtimeFiles.includes('server/src/domain/doe-calculator.js'));
  assert.ok(result.runtimeFiles.includes('server/src/domain/doe-course-catalog-2026-27.js'));
  assert.ok(result.runtimeFiles.includes('server/src/data/sql-doe-target-repository.js'));
  assert.ok(result.runtimeFiles.includes('server/src/data/sql-afc-write-repository.js'));
  assert.ok(result.runtimeFiles.includes('server/src/afc/afc-request-api.js'));
  assert.ok(result.runtimeFiles.includes('server/src/afc/afc-approval-api.js'));
  assert.ok(result.runtimeFiles.includes('server/src/runtime/swa-afc-request-functions.js'));
  assert.ok(result.runtimeFiles.includes('server/src/afc/afc-approved-artifact-api.js'));
  assert.ok(result.runtimeFiles.includes('server/src/afc/afc-approved-artifact-renderer.js'));
  assert.ok(result.runtimeFiles.includes('server/src/afc/assets/absence-from-campus-app.pdf'));
  assert.ok(result.runtimeFiles.includes('server/src/data/sql-afc-artifact-repository.js'));
  assert.ok(result.runtimeFiles.includes('server/src/runtime/swa-afc-artifact-functions.js'));
  assert.ok(result.runtimeFiles.includes('server/src/data/sql-teaching-assignment-workflow-repository.js'));
  assert.ok(result.runtimeFiles.includes('server/src/runtime/swa-teaching-assignment-functions.js'));
  assert.ok(result.runtimeFiles.includes('server/src/teaching-assignment/teaching-assignment-api.js'));
  assert.ok(result.buildDefinitionFiles.includes('deploy/aca/Dockerfile'));
});

test('API freeze imports the single static baseline constant',()=>{
  const apiFreezeSource=fs.readFileSync(repositoryPath(root,'tools/beta-api-freeze.js'),'utf8');
  assert.doesNotMatch(apiFreezeSource,/const\s+BASELINE_COMMIT\s*=/);
  assert.match(apiFreezeSource,/require\('\.\/beta-freeze'\)/);
});

test('P3B3 preserves the FC1 API runtime and adds only the reviewed AFC workflow files',()=>{
  const apiFreeze=require('../tools/beta-api-freeze.js');
  const previous=apiFreeze.baselineRuntimeFiles({root,baselineCommit:PREVIOUS_API_BASELINE_COMMIT});
  const current=apiFreeze.baselineRuntimeFiles({root,baselineCommit:P3B3_BASELINE_COMMIT});
  assert.equal(previous.length,21);
  assert.equal(current.length,27);
  assert.deepEqual(previous.filter(name=>!current.includes(name)),[]);
  assert.deepEqual(current.filter(name=>!previous.includes(name)),[
    'server/src/afc/afc-approval-api.js',
    'server/src/afc/afc-policy.js',
    'server/src/afc/afc-request-api.js',
    'server/src/data/sql-afc-approval-repository.js',
    'server/src/data/sql-afc-request-repository.js',
    'server/src/runtime/swa-afc-request-functions.js'
  ]);
});

test('P3B3 changes only the reviewed shared SQL runtime mount among pre-existing FC1 API files',()=>{
  const apiFreeze=require('../tools/beta-api-freeze.js');
  const previous=apiFreeze.baselineRuntimeFiles({root,baselineCommit:PREVIOUS_API_BASELINE_COMMIT});
  const changed=[];
  for(const name of previous){
    const same=freeze.bytesMatch(
      freeze.readBaselineFile({root,baselineCommit:PREVIOUS_API_BASELINE_COMMIT,file:name}),
      freeze.readBaselineFile({root,baselineCommit:P3B3_BASELINE_COMMIT,file:name})
    );
    if(!same)changed.push(name);
  }
  assert.deepEqual(changed,['server/src/runtime/swa-sql-runtime.js']);
});

test('P3B3 leaves swa-api and the ACA Dockerfile untouched from FC1',()=>{
  const apiFreeze=require('../tools/beta-api-freeze.js');
  const unchanged=[...apiFreeze.API_SOURCE_ROOTS,...apiFreeze.BUILD_DEFINITION_FILES];
  for(const name of unchanged){
    assert.equal(freeze.bytesMatch(
      freeze.readBaselineFile({root,baselineCommit:PREVIOUS_API_BASELINE_COMMIT,file:name}),
      freeze.readBaselineFile({root,baselineCommit:P3B3_BASELINE_COMMIT,file:name})
    ),true,`${name} must be unchanged by the P3B promotion`);
  }
});

test('P3B4 preserves the P3B3 API paths and adds exactly the approved-artifact runtime delta',()=>{
  const apiFreeze=require('../tools/beta-api-freeze.js');
  const previous=apiFreeze.baselineRuntimeFiles({root,baselineCommit:P3B3_BASELINE_COMMIT});
  const current=apiFreeze.baselineRuntimeFiles({root,baselineCommit:P3B4_BASELINE_COMMIT});
  assert.equal(previous.length,27);
  assert.equal(current.length,32);
  assert.deepEqual(previous.filter(name=>!current.includes(name)),[]);
  assert.deepEqual(current.filter(name=>!previous.includes(name)),[
    'server/src/afc/afc-approved-artifact-api.js',
    'server/src/afc/afc-approved-artifact-renderer.js',
    'server/src/afc/assets/absence-from-campus-app.pdf',
    'server/src/data/sql-afc-artifact-repository.js',
    'server/src/runtime/swa-afc-artifact-functions.js'
  ]);
  assert.deepEqual(apiFreeze.REPOSITORY_INPUT_FILES,['server/package.json','server/package-lock.json']);
  for(const name of apiFreeze.REPOSITORY_INPUT_FILES){
    assert.equal(freeze.readBaselineFile({root,baselineCommit:P3B4_BASELINE_COMMIT,file:name}).length>0,true,name);
  }
});

test('P3B4 changes only the reviewed AFC download UI and binary client among protected static files',()=>{
  const previous=baselineJson(P3B3_BASELINE_COMMIT);
  const current=baselineJson(P3B4_BASELINE_COMMIT);
  assert.equal(previous.length,49);
  assert.equal(current.length,49);
  assert.deepEqual(previous.filter(name=>!current.includes(name)),[]);
  assert.deepEqual(current.filter(name=>!previous.includes(name)),[]);
  const changed=[];
  for(const name of current){
    if(!freeze.bytesMatch(
      freeze.readBaselineFile({root,baselineCommit:P3B3_BASELINE_COMMIT,file:name}),
      freeze.readBaselineFile({root,baselineCommit:P3B4_BASELINE_COMMIT,file:name})
    ))changed.push(name);
  }
  assert.deepEqual(changed,['afc-workflow-sql.js','paws-data-client.js']);
});

test('historical P3 Beta integration added only its centralized origin asset and reviewed origin wiring to P3B4',()=>{
  const previous=baselineJson(P3B4_BASELINE_COMMIT);
  const current=baselineJson(P3_INTEGRATION_COMMIT);
  assert.equal(previous.length,49);
  assert.equal(current.length,50);
  assert.deepEqual(previous.filter(name=>!current.includes(name)),[]);
  assert.deepEqual(current.filter(name=>!previous.includes(name)),['paws-api-origin.js']);
  const changed=[];
  for(const name of previous){
    if(!freeze.bytesMatch(
      freeze.readBaselineFile({root,baselineCommit:P3B4_BASELINE_COMMIT,file:name}),
      freeze.readBaselineFile({root,baselineCommit:P3_INTEGRATION_COMMIT,file:name})
    ))changed.push(name);
  }
  assert.deepEqual(changed,['faculty-admin.html','index.html','paws-data-client.js']);
  const origin=freeze.readBaselineFile({root,baselineCommit:P3_INTEGRATION_COMMIT,file:'paws-api-origin.js'}).toString('utf8');
  assert.match(origin,/TEMPORARY BETA INGRESS/);
  assert.match(origin,/radar-languages-shopper-corporate\.trycloudflare\.com/);
});

test('the promoted API anchor carries the accepted request-timing allowlist',()=>{
  const anchored=freeze.readBaselineFile({root,file:'server/src/perf/request-timing.js'}).toString('utf8');
  assert.match(anchored,/const METRIC_NAMES = Object\.freeze\(\[/);
  for(const metric of ['firebase_verify','sql_connect','sql_user_query','profile_validate','me_total']){
    assert.match(anchored,new RegExp(`'${metric}'`),metric);
  }
  assert.match(anchored,/new Set\(\['cold', 'warm'\]\)/);
  // No persistence, logging sink, or identity material may appear in the timing module.
  assert.doesNotMatch(anchored,/require\('node:fs'\)/);
  assert.doesNotMatch(anchored,/console\./);
  assert.doesNotMatch(anchored,/token|uid|facultyId|email/i);
});

test('the timing module only emits Server-Timing for eligible authenticated requests',()=>{
  const timing=freeze.readBaselineFile({root,file:'server/src/perf/request-timing.js'}).toString('utf8');
  assert.match(timing,/if \(!eligible\) return '';/);
  const api=freeze.readBaselineFile({root,file:'server/src/data/data-api.js'}).toString('utf8');
  // Eligibility is granted only after a successful token verification.
  assert.match(api,/if \(timing\) timing\.markEligible\(\);/);
  const runtime=freeze.readBaselineFile({root,file:'server/src/runtime/swa-functions.js'}).toString('utf8');
  // The header is attached only when a non-empty Server-Timing value exists.
  assert.match(runtime,/const value = timing && timing\.serverTiming\(\);/);
  assert.match(runtime,/if \(!value\) return \{ status, jsonBody: body \};/);
  assert.match(runtime,/'Access-Control-Expose-Headers': 'Server-Timing'/);
});

// H. Corrected runtime anchoring --------------------------------------------
test('the promoted API anchor carries the corrected unfiltered AFC list query',()=>{
  const anchored=freeze.readBaselineFile({root,file:'server/src/data/sql-dashboard-repository.js'}).toString('utf8');
  // BETA-R4D-12B1D-R: an unfiltered AFC list has no predicates at all, so the
  // WHERE clause must be omitted entirely. The superseded runtime emitted a
  // bare `WHERE`, which the endpoint surfaced as 503 SQL_UNAVAILABLE.
  assert.match(anchored,/const whereClause = predicates\.length \? `WHERE \$\{predicates\.join\(' AND '\)\}` : '';/);
  const afc=anchored.slice(anchored.indexOf('FROM paws.vAfcRecordUnified u'));
  const statement=afc.slice(0,afc.indexOf('ORDER BY'));
  assert.ok(statement.length>0);
  assert.match(statement,/\$\{whereClause\}/);
  assert.doesNotMatch(statement,/WHERE \$\{predicates\.join/);
});

test('the superseded anchor is retained as historical evidence only',()=>{
  assert.notEqual(PREVIOUS_BASELINE_COMMIT,BASELINE_COMMIT);
  assert.equal(freeze.baselineCommitExists(root,PREVIOUS_BASELINE_COMMIT),true);
  // The superseded anchor is still an ancestor, so its blobs stay readable as
  // history while no longer being the verification authority.
  execFileSync('git',['merge-base','--is-ancestor',PREVIOUS_BASELINE_COMMIT,'HEAD'],{cwd:root});
});

test('AFC and LAB freeze promotion protects only the reviewed runtime delta',()=>{
  const previous=PREVIOUS_AFC_LAB_BASELINE_COMMIT;
  const oldStatic=historicalStaticPaths(previous),newStatic=historicalStaticPaths(AFC_LAB_PRODUCT_COMMIT);
  assert.equal(oldStatic.length,69);assert.equal(newStatic.length,71);
  assert.deepEqual(oldStatic.filter(f=>!newStatic.includes(f)),[]);
  assert.deepEqual(newStatic.filter(f=>!oldStatic.includes(f)).sort(),['faculty-admin-afc-records.js','lab-session-detail.js']);
  const oldApi=historicalApiPaths(previous),newApi=historicalApiPaths(AFC_LAB_PRODUCT_COMMIT);
  assert.deepEqual(oldApi,newApi);
  const changed=execFileSync('git',['diff','--name-only',previous,AFC_LAB_PRODUCT_COMMIT],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
  assert.deepEqual(changed.filter(f=>newStatic.includes(f)).sort(),['faculty-admin-afc-records.js','faculty-admin.html','faculty-admin.js','index.html','lab-session-detail.js','paws-data-client.js','timetable.css','timetable.js']);
  assert.deepEqual(changed.filter(f=>newApi.includes(f)).sort(),['server/src/data/dashboard-api.js','server/src/data/sql-afc-write-repository.js','server/src/data/sql-dashboard-repository.js','server/src/data/write-gates.js','server/src/runtime/swa-dashboard-functions.js']);
  execFileSync('git',['merge-base','--is-ancestor',previous,AFC_LAB_PRODUCT_COMMIT],{cwd:root});
});

test('Historical Dashboard presentation reset remains pinned at its independently reviewed immutable 2026-10-20 product',()=>{
 const previous='fe1fa7002ef956f02e767053fbe2f6fea8daf748',accepted='573dbe468eb23b177d92317f9a6e3ec04d2c94ec';
 const historicReset=JSON.parse(execFileSync('git',['show','1b4c3fb3be383119039ee170660c395d8e556847:tools/beta-baseline.json'],{cwd:root,encoding:'utf8'}));
 assert.equal(historicReset.sourceCommit,accepted);
 assert.ok(execFileSync('git',['show','1b4c3fb3be383119039ee170660c395d8e556847:tools/beta-freeze.js'],{cwd:root,encoding:'utf8'}).includes("const BASELINE_COMMIT='"+accepted+"'"));
 execFileSync('git',['merge-base','--is-ancestor',accepted,freeze.BASELINE_COMMIT],{cwd:root});
 const staticBefore=historicalStaticPaths(previous),staticAfter=historicalStaticPaths(accepted);
 const apiBefore=historicalApiPaths(previous),apiAfter=historicalApiPaths(accepted);
 assert.deepEqual(staticAfter,staticBefore);
 assert.deepEqual(apiAfter,apiBefore);
 assert.equal(staticAfter.length,81);assert.equal(apiAfter.length,104);
 const changed=execFileSync('git',['diff','--name-only',previous,accepted],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
 assert.deepEqual(changed.filter(file=>staticAfter.includes(file)).sort(),['change-history.css','change-history.js']);
 assert.deepEqual(changed.filter(file=>apiAfter.includes(file)).sort(),[
  'server/src/data/sql-change-history-repository.js','server/src/history/change-history-api.js']);
 assert.equal(changed.some(file=>file.startsWith('database/azure-sql/')),false);
 for(const file of staticAfter.filter(path=>!changed.includes(path)))assert.ok(freeze.bytesMatch(
  freeze.readBaselineFile({root,baselineCommit:previous,file}),
  freeze.readBaselineFile({root,baselineCommit:accepted,file})
 ),file);
 for(const file of apiAfter.filter(path=>!changed.includes(path)))assert.ok(freeze.bytesMatch(
  freeze.readBaselineFile({root,baselineCommit:previous,file}),
  freeze.readBaselineFile({root,baselineCommit:accepted,file})
 ),file);
});

test('Dashboard archive restoration promotes only one reviewed protected frontend and one API source change',()=>{
 const previous='573dbe468eb23b177d92317f9a6e3ec04d2c94ec',accepted='a3317b1d30b1caa66c81ee5f4be2932f941b565b';
 const historicArchive=JSON.parse(execFileSync('git',['show','33c4e9f4506e4632e673c2e8a462bc9987ce7e51:tools/beta-baseline.json'],{cwd:root,encoding:'utf8'}));
 assert.equal(historicArchive.sourceCommit,accepted);
 assert.ok(execFileSync('git',['show','33c4e9f4506e4632e673c2e8a462bc9987ce7e51:tools/beta-freeze.js'],{cwd:root,encoding:'utf8'}).includes("const BASELINE_COMMIT='"+accepted+"'"));
 execFileSync('git',['merge-base','--is-ancestor',accepted,freeze.BASELINE_COMMIT],{cwd:root});
 const staticBefore=historicalStaticPaths(previous),staticAfter=historicalStaticPaths(accepted);
 const apiBefore=historicalApiPaths(previous),apiAfter=historicalApiPaths(accepted);
 assert.deepEqual(staticAfter,staticBefore);
 assert.deepEqual(apiAfter,apiBefore);
 assert.equal(staticAfter.length,81);
 assert.equal(apiAfter.length,104);
 const changed=execFileSync('git',['diff','--name-only',previous,accepted],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
 assert.deepEqual(changed.filter(file=>staticAfter.includes(file)).sort(),['change-history.js']);
 assert.deepEqual(changed.filter(file=>apiAfter.includes(file)).sort(),['server/src/history/change-history-api.js']);
 assert.equal(changed.some(file=>file.startsWith('database/azure-sql/')),false);
 assert.equal(changed.some(file=>file.endsWith('write-gates.js')),false);
 for(const file of staticAfter.filter(file=>!changed.includes(file)))assert.ok(freeze.bytesMatch(
  freeze.readBaselineFile({root,baselineCommit:previous,file}),
  freeze.readBaselineFile({root,baselineCommit:accepted,file})
 ),file);
 for(const file of apiAfter.filter(file=>!changed.includes(file)))assert.ok(freeze.bytesMatch(
  freeze.readBaselineFile({root,baselineCommit:previous,file}),
  freeze.readBaselineFile({root,baselineCommit:accepted,file})
 ),file);
 const serverSource=freeze.readBaselineFile({root,baselineCommit:accepted,file:'server/src/history/change-history-api.js'}).toString('utf8');
 assert.match(serverSource,/DASHBOARD_HISTORY_ARCHIVE_START_UTC='2026-10-05T00:00:00.000Z'/);
 assert.doesNotMatch(serverSource,/DASHBOARD_HISTORY_BASELINE_UTC/);
 const ui=freeze.readBaselineFile({root,baselineCommit:accepted,file:'change-history.js'}).toString('utf8');
 assert.match(ui,/All recorded years/);
 assert.match(ui,/historyArchiveStartUtc/);
});
