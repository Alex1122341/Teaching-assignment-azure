'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('Beta AFC scripts load the SQL workflow before its facade and omit Firestore decisions',()=>{
 const html=read('index.html'),sql=html.indexOf('afc-workflow-sql.js'),facade=html.indexOf('afc-workflow.js');
 assert.ok(sql>=0&&facade>sql);
 assert.equal(html.includes('afc-actions.js'),false);
 assert.match(html,/afc-timetable-panel\.js/);
});

test('VetMed-Ops AFC facade delegates reads and actions to the SQL workflow',()=>{
 const events=new Map(),loads=[];
 const sql={load:async force=>loads.push(force),submit:async()=>({ok:true})};
 const context={UCVM_PAWS_DATA:{sessionBackend:()=> 'vetmed-ops'},UCVM_AFC_SQL:sql,addEventListener:(name,fn)=>events.set(name,fn)};context.window=context;
 vm.runInNewContext(read('afc-workflow.js'),context);
 assert.equal(context.window.UCVM_AFC,sql);
 events.get('ucvm:afc-open')({ucvmForce:true});
 assert.deepEqual(loads,[true]);
});

test('Firestore AFC fallback is unavailable without initializing Firebase or touching Firestore',async()=>{
 let firebaseReads=0,html='';
 const context={
  UCVM_PAWS_DATA:{sessionBackend:()=> 'firestore'},
  addEventListener(){},
  document:{getElementById:()=>({innerHTML:''})},
  FirebaseSentinel:new Proxy({}, {get(){firebaseReads++;throw new Error('Firebase must not be touched')}})
 };
 Object.defineProperty(context,'firebase',{get(){firebaseReads++;throw new Error('Firebase must not be touched')}});
 context.window=context;
 vm.runInNewContext(read('afc-workflow.js'),context);
 assert.equal(context.window.UCVM_AFC.unavailable,true);
 await assert.rejects(context.window.UCVM_AFC.submit({}),/PAWS University API; browser Firestore submission is disabled/);
 context.window.UCVM_AFC.mount({panelId:'afc-panel'});
 assert.equal(firebaseReads,0);
});
