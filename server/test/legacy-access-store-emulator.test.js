'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {createLegacyAccessStore}=require('../src/access/legacy-access-store');
const enabled=Boolean(process.env.FIRESTORE_EMULATOR_HOST);
let app,db,store;
before(()=>{
 if(!enabled)return;
 if(!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST))throw Error('Only a loopback Firestore emulator is permitted.');
 const admin=require('firebase-admin');app=admin.initializeApp({projectId:'demo-sec01-access-store'},'sec01-access-store-'+process.pid);db=admin.firestore(app);
 store=createLegacyAccessStore({getFirestore:()=>db,serverTimestamp:()=>admin.firestore.FieldValue.serverTimestamp()});
});
after(async()=>{if(app)await app.delete();});

test('legacy adapter commits group and audit atomically with exact document versions',{skip:!enabled},async()=>{
 const id='sec01-group-'+process.pid,actor={uid:'synthetic-owner',name:'Owner, Synthetic'};
 const created=await store.createGroup({id,actor,action:'group_created',buildPatch:async()=>({name:'Synthetic collaboration',ownerUid:'synthetic-hicc',memberUids:['synthetic-hicc'],courseIds:['206']})});
 assert.match(created.version,/^\d+\.\d{9}$/);assert.equal(created.name,'Synthetic collaboration');
 const updated=await store.updateGroup({id,expectedVersion:created.version,actor,action:'group_members_updated',buildPatch:async()=>({memberUids:['synthetic-hicc','synthetic-faculty']})});
 assert.notEqual(updated.version,created.version);assert.equal(updated.name,created.name);assert.deepEqual(updated.memberUids,['synthetic-hicc','synthetic-faculty']);
 await assert.rejects(store.updateGroup({id,expectedVersion:created.version,actor,buildPatch:async()=>{throw Error('Stale callback must not run');}}),error=>error.code==='GROUP_STALE');
 await assert.rejects(store.updateGroup({id,expectedVersion:updated.version,actor,buildPatch:async()=>{throw Error('SQL authorization revoked');}}),/SQL authorization revoked/);
 const rows=await store.listGroups({ownerUid:'synthetic-hicc'});assert.equal(rows.find(row=>row.id===id).version,updated.version);
 const audits=await db.collection('account_audit').where('groupId','==',id).get();assert.equal(audits.size,2);assert.ok(audits.docs.every(doc=>doc.data().changedBy==='synthetic-owner'));
});

test('announcement publication preserves old evidence and commits one matching audit',{skip:!enabled},async()=>{
 const initial=await store.readAnnouncements();assert.deepEqual(initial.messages,[]);assert.equal(initial.version,'none');
 const actor={uid:'synthetic-owner',name:'Owner, Synthetic'};
 const saved=await store.updateAnnouncements({expectedVersion:'none',actor,buildPatch:async current=>({messages:[{id:'synthetic-message',title:'Synthetic notice',body:'Test only',createdAt:'2026-10-26T12:00:00.000Z',authorName:actor.name},...current.messages]})});
 assert.match(saved.version,/^\d+\.\d{9}$/);assert.equal(saved.messages.length,1);
 await assert.rejects(store.updateAnnouncements({expectedVersion:'none',actor,buildPatch:async()=>{throw Error('stale callback must not run');}}),error=>error.code==='ANNOUNCEMENT_STALE');
 await assert.rejects(store.updateAnnouncements({expectedVersion:saved.version,actor,buildPatch:async()=>{throw Error('SQL Owner revoked');}}),/SQL Owner revoked/);
 const current=await store.readAnnouncements();assert.equal(current.version,saved.version);assert.deepEqual(current.messages,saved.messages);
 const audits=await db.collection('account_audit').where('action','==','announcement_published').get();assert.equal(audits.size,1);assert.equal(audits.docs[0].data().changedBy,actor.uid);
});

test('legacy audit adapter pages original stored evidence with a validated cursor',{skip:!enabled},async()=>{
 const first=await store.listLegacyAudit({cursor:null});assert.equal(first.length,3);assert.ok(first.every(row=>row.id&&row.changedAt));
 const next=await store.listLegacyAudit({cursor:first[0].id});assert.equal(next.length,2);assert.ok(next.every(row=>row.id!==first[0].id));
 await assert.rejects(store.listLegacyAudit({cursor:'missing-cursor'}),error=>error.code==='LEGACY_CURSOR_STALE');
});
