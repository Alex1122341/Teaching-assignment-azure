'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createLabSessionWrites } = require('../tools/testing/firestore-session-writes');

const SESSION = 'c1111111-1111-4111-8111-111111111111';
const OTHER = 'c2222222-2222-4222-8222-222222222222';

function fakeDb({ altered=false, duplicate=false }={}) {
  const documents=new Map([
    [SESSION,{synthetic:!altered,academicYear:'2026-27',year:2,course:'VTMD 306',courseName:'Synthetic Course',
      date:'2026-11-24',start:'08:00',end:'09:00',topic:'Lab 2',type:'LAB',room:'TEST ROOM',
      timeUnknown:false,facultyIds:[],instructorNames:[],assignments:[]}],
    [OTHER,{synthetic:true,academicYear:'2026-27',year:2,course:'VTMD 304',date:'2026-11-24',
      start:duplicate?'09:00':'10:00',end:duplicate?'10:00':'11:00',
      topic:'Lab 3',type:'LAB',room:'TEST ROOM',timeUnknown:false,facultyIds:[],instructorNames:[],assignments:[]}]
  ]);
  const audit=[],names=[];
  const collection=name=>{
    if(!['paws_testing_sessions','paws_testing_audit'].includes(name))throw Error('Wrong collection '+name);
    names.push(name);
    const ref={name};
    ref.doc=id=>({kind:'doc',name,id});
    ref.where=(key,op,value)=>({
      kind:'query', name, key,op,value,limit(n){this.max=n;return this;}
    });
    return ref;
  };
  const db={
    projectId:'vista-teaching-lab',databaseId:'(default)',collection,names,documents,audit,
    async runTransaction(fn){
      const staged=[];
      const tx={
        async get(ref){
          if(ref.kind==='doc'){
            const data=documents.get(ref.id);
            return {exists:!!data,id:ref.id,data:()=>structuredClone(data)};
          }
          assert.equal(ref.kind,'query');
          return {docs:[...documents].filter(([,data])=>data[ref.key]===ref.value).slice(0,ref.max)
            .map(([id,data])=>({id,data:()=>structuredClone(data)}))};
        },
        update(ref,patch){staged.push({kind:'update',ref,patch});},
        create(ref,data){staged.push({kind:'create',ref,data});}
      };
      const result=await fn(tx);
      for(const entry of staged){
        if(entry.ref.name==='paws_testing_sessions')documents.set(entry.ref.id,{...documents.get(entry.ref.id),...entry.patch});
        else if(entry.ref.name==='paws_testing_audit')audit.push(entry.data);
        else throw Error('Cross-collection write');
      }
      return result;
    }
  };
  return db;
}

const ACTOR={actorFirebaseUid:'paws-synthetic-owner',actorName:'Owner, Synthetic'};
test('Testing session patch uses a transaction, persists fields and records synthetic audit',async()=>{
  const db=fakeDb(),write=createLabSessionWrites({db});
  const row=await write.updateSession({sessionId:SESSION,patch:{room:'SYNTHETIC ROOM 2',topic:'Lab revised'},...ACTOR});
  assert.equal(row.id,SESSION);
  assert.equal(row.room,'SYNTHETIC ROOM 2');
  assert.equal(db.documents.get(SESSION).room,'SYNTHETIC ROOM 2');
  assert.equal(db.documents.get(SESSION).revision,1);
  assert.equal(db.audit.length,1);
  assert.equal(db.audit[0].actorFirebaseUid,ACTOR.actorFirebaseUid);
  assert.equal(db.audit[0].synthetic,true);
  assert.ok(db.names.every(x=>x.startsWith('paws_testing_')));
});
test('Testing write adapter cannot use Production or non-synthetic documents',async()=>{
  const foreign=fakeDb();foreign.projectId='tester-teaching';
  assert.throws(()=>createLabSessionWrites({db:foreign}),/Testing Firestore/);
  const db=fakeDb({altered:true});
  await assert.rejects(()=>createLabSessionWrites({db}).updateSession({sessionId:SESSION,patch:{room:'bad'},...ACTOR}),/synthetic/i);
  assert.equal(db.audit.length,0);
  assert.equal(db.documents.get(SESSION).room,'TEST ROOM');
});
test('Testing session edits reject a cross-year move and a duplicate timetable block atomically',async()=>{
  const db=fakeDb(),write=createLabSessionWrites({db});
  await assert.rejects(()=>write.updateSession({sessionId:SESSION,patch:{date:'2028-01-01'},...ACTOR}),e=>e.number===51245);
  await assert.rejects(()=>write.updateSession({sessionId:SESSION,
    patch:{courseCode:'VTMD 304',startTime:'10:00',endTime:'11:00',topic:'Lab 3'},...ACTOR}),e=>e.number===51246);
  assert.equal(db.audit.length,0);
  assert.equal(db.documents.get(SESSION).course,'VTMD 306');
});
test('session patch returns null for absent UUID without creating a record',async()=>{
  const db=fakeDb(),write=createLabSessionWrites({db});
  const result=await write.updateSession({sessionId:'f3333333-3333-4333-8333-333333333333',
    patch:{room:'NEW'},...ACTOR});
  assert.equal(result,null);
  assert.equal(db.audit.length,0);
});
