'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const sourceFunction=require('../test-support/source-function');
const {createPawsDataClient}=require('../frontend/scripts/paws-data-client');
const id='session-1',f1='faculty-1',f2='faculty-2';
const base={id,date:'2026-11-25',course:'315',type:'LEC',start:'09:00',end:'10:00',topic:'Old',room:'Room',batchEditToken:'A'.repeat(64),assignmentManagementAvailable:true,assignments:[{facultyId:f1,role:'Lead'}]};
function read(original=base,changes={},ids=null){
 const values={...original,...changes};
 const tr={dataset:{sessionEditId:id},querySelector:selector=>selector==='.selection-faculty-picker'?(ids===null?null:{querySelectorAll:()=>ids.map(value=>({value}))}):{value:values[selector.match(/"([^"]+)"/)[1]]}};
 const context={document:{querySelectorAll:()=>[tr]},selectedSessionOriginals:new Map([[id,original]]),facultyDirectory:[{__id:f1},{__id:f2}],defaultTeachingRole:()=> 'Lecture'};
 const script=['buildSqlSessionEditPatch','canReplaceSelectionAssignments','readSelectionRows'].map(name=>sourceFunction('timetable.js',name)).join('\n');
 return JSON.parse(JSON.stringify(vm.runInNewContext(script+'\nreadSelectionRows()',context)));
}
test('batch sends only changed facts and both interval bounds without client DOE',()=>{
 const result=read(base,{start:'09:15',year:4,topic:'New'},[f1]);
 assert.deepEqual(result,{edits:[{sessionId:id,expectedToken:base.batchEditToken,patch:{topic:'New',startTime:'09:15',endTime:'10:00'}}],errors:[],rowNumbers:[1]});
});
test('batch assignment change retains existing teaching role and sends only canonical ids',()=>{
 assert.deepEqual(read(base,{},[f1,f2]).edits[0].assignments,[{facultyId:f1,teachingRole:'Lead'},{facultyId:f2,teachingRole:'Lecture'}]);
 assert.equal(read(base,{},[f1]).edits.length,0);
 assert.equal(read({...base,assignmentManagementAvailable:false},{},[f2]).errors.length,1);
 assert.equal(read({...base,batchEditToken:''},{topic:'New'}).errors.length,1);
 assert.equal(read(base,{start:'11:00'}).errors.length,1);
});
test('batch client capability requires both exact true flags and posts one API request',async()=>{
 let caps={sessionEdit:true,sessionBatchEdit:'true'},calls=[];
 const client=createPawsDataClient({tokenProvider:async()=> 'token',fetchImpl:async(url,init)=>{calls.push({url,init});return {ok:true,json:async()=>new URL(url).pathname.endsWith('write-capabilities')?{writeCapabilities:caps}:{sessions:[{id}]}}}});
 await client.refreshWriteCapabilities();assert.equal(client.sessionBatchEditEnabled(),false);
 caps={sessionEdit:true,sessionBatchEdit:true};await client.refreshWriteCapabilities();assert.equal(client.sessionBatchEditEnabled(),true);
 assert.equal(client.sessionWritesEnabled(),false);
 const edits=read(base,{topic:'New'}).edits;await client.patchSessionBatch(edits);
 assert.equal(new URL(calls.at(-1).url).pathname,'/api/v1/sessions/batch-edit');
 assert.equal(calls.at(-1).init.method,'POST');assert.deepEqual(JSON.parse(calls.at(-1).init.body),{edits});
});
