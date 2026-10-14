'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const {createCalendarActivityFunctions}=require('../src/runtime/swa-calendar-activity-functions');
const ID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const paths=[['GET','/api/v1/calendar-activities?start=2026-11-01&end=2026-11-08','list'],['GET','/api/v1/calendar-activities/capabilities','capabilities'],['POST','/api/v1/calendar-activity-imports','stage'],['GET','/api/v1/calendar-activity-imports/'+ID,'getImport'],['POST','/api/v1/calendar-activity-imports/'+ID+'/preview','preview'],['POST','/api/v1/calendar-activity-imports/'+ID+'/commit','commit'],['POST','/api/v1/calendar-activities/'+ID+'/time-evidence','resolveTime']];
for(const [method,path,name] of paths){test('route '+name+' binds exact method and bearer token',async()=>{
 const calls=[];const route=createCalendarActivityFunctions({api:Object.fromEntries(paths.map(x=>[x[2],async(...args)=>{calls.push({method:x[2],args});return {status:200,body:{ok:true}};}]))});
 const request=new Request('http://local'+path,{method,headers:{authorization:'Bearer verified','content-type':'application/json'},...(method==='POST'?{body:'{"synthetic":true}'}:{})});
 assert.equal((await route(request)).status,200);assert.equal(calls[0].method,name);assert.equal(calls[0].args[0],'verified');
 const wrong=await route(new Request('http://local'+path,{method:'DELETE'}));assert.equal(wrong.status,405);assert.equal(wrong.headers.Allow,method);assert.equal(calls.length,1);
});}
test('extra/duplicate queries, malformed JSON and unknown routes are rejected before the API',async()=>{
 let calls=0;const api=new Proxy({},{get:()=>async()=>{calls++;return {status:200,body:{}};}});const route=createCalendarActivityFunctions({api});
 for(const path of ['/api/v1/calendar-activities?start=a&start=b','/api/v1/calendar-activities?actorFirebaseUid=spoof','/api/v1/calendar-activity-imports/'+ID+'?source=spoof'])assert.equal((await route(new Request('http://local'+path))).status,400);
 assert.equal((await route(new Request('http://local/api/v1/calendar-activity-imports',{method:'POST',body:'bad'}))).status,400);
 assert.equal((await route(new Request('http://local/api/v1/calendar-activity-imports/'+ID+'/recovery'))).status,404);assert.equal(calls,0);
});
