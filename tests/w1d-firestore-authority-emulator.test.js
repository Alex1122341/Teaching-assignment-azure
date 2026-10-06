'use strict';

const {test,before,after}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');

const enabled=!!process.env.FIRESTORE_EMULATOR_HOST;
let env;
const SQL_CANONICAL_PATHS=[
 'sessions','session_change_log','faculty','faculty_change_log','afc_requests','afc_requests/{id}/pdf_chunks','afc_audit','audit_events',
 'settings/faculty_index','settings/schedule_stats','settings/faculty_swap_index','settings/faculty_swap_map','settings/faculty_summary_2026_27'
];
const roleUsers={
 owner:{role:'owner'},administrator:{role:'administrator'},otherOffice:{role:'other_office'},admin:{role:'admin'},
 general:{role:'adfa_general'},regular:{role:'adfa_regular'},hicc:{role:'hicc',facultyId:'f1'},visc:{role:'visc',facultyId:'f2'},
 faculty:{role:'faculty',facultyId:'f3'},editor:{role:'editor'},viewer:{role:'viewer'},legacy:{role:'adfa_legacy'}
};

const check=(name,fn)=>test(name,{skip:!enabled},fn);

before(async()=>{
 if(!enabled)return;
 const {initializeTestEnvironment}=require('@firebase/rules-unit-testing');
 env=await initializeTestEnvironment({projectId:'demo-w1d-authority',firestore:{rules:fs.readFileSync(path.join(__dirname,'../firestore.rules'),'utf8')}});
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async context=>{
  const db=context.firestore();
  for(const [uid,profile] of Object.entries(roleUsers))await db.doc(`users/${uid}`).set({active:true,mustChangePassword:false,email:`${uid}@example.test`,...profile});
  for(const id of ['f1','f2','f3'])await db.doc(`faculty/${id}`).set({email:`${id}@example.test`,preferredFullName:id});
  await db.doc('sessions/s1').set({course:'301',topic:'Original',date:'2026-09-08',facultyIds:['f1'],assignments:[{ucid:'f1'}],updatedBy:'general'});
  await db.doc('afc_requests/request1').set({requesterUid:'faculty',requesterEmail:'faculty@example.test',facultyId:'f3',reportToUid:'hicc',status:'pending_report_to',startDate:'2026-09-10',endDate:'2026-09-11',workDays:2,reason:'vacation',contactAddress:'University',contactPhone:'403-555-0100',applicantSignature:{uid:'faculty',attested:true}});
  await db.doc('afc_requests/request1/pdf_chunks/000').set({index:0,base64:'YQ==',sha256:'hash'});
  await db.doc('settings/system_state').delete();
 });
});
after(async()=>{if(env)await env.cleanup()});

async function setMaintenanceState(kind){
 await env.withSecurityRulesDisabled(async context=>{
  const db=context.firestore(),ref=db.doc('settings/system_state');
  if(kind==='missing'){await ref.delete();return}
  if(kind==='false'){await ref.set({teachingDataWriteLocked:false,maintenanceMode:'none',activeImportId:''});return}
  if(kind==='malformed'){await ref.set({teachingDataWriteLocked:'true',maintenanceMode:[],activeImportId:null});return}
  await db.doc('bulk_import_jobs/job1').set({importId:'job1',startedBy:'owner',status:'APPLYING'});
  await ref.set({teachingDataWriteLocked:true,maintenanceMode:'bulk_import',activeImportId:'job1',maintenanceOwnerUid:'owner'});
 });
}

check('SQL-canonical sessions, Faculty and DOE values reject browser mutation for every role',async()=>{
 const {assertFails}=require('@firebase/rules-unit-testing');
 const {doc,setDoc,updateDoc,deleteDoc,serverTimestamp}=require('firebase/firestore');
 for(const state of ['missing','false','malformed','active-maintenance']){
  await setMaintenanceState(state);
  for(const uid of Object.keys(roleUsers)){
   const db=env.authenticatedContext(uid).firestore();
   await assertFails(setDoc(doc(db,'sessions/new-'+state+'-'+uid),{updatedBy:uid,updatedAt:serverTimestamp()}));
   await assertFails(updateDoc(doc(db,'sessions/s1'),{topic:'browser mutation',updatedBy:uid,updatedAt:serverTimestamp()}));
   await assertFails(deleteDoc(doc(db,'sessions/s1')));
   await assertFails(setDoc(doc(db,'faculty/new-'+state+'-'+uid),{name:'Client'}));
   await assertFails(updateDoc(doc(db,'faculty/f1'),{doeOverride2026_27:{value:100},updatedBy:uid}));
   await assertFails(deleteDoc(doc(db,'faculty/f1')));
  }
 }
});

check('AFC requests, decisions, approved artifacts and canonical audit paths reject browser writes',async()=>{
 const {assertFails}=require('@firebase/rules-unit-testing');
 const {doc,setDoc,updateDoc,deleteDoc,serverTimestamp}=require('firebase/firestore');
 const member=env.authenticatedContext('faculty').firestore(),admin=env.authenticatedContext('general').firestore();
 const validRequest={requesterUid:'faculty',requesterEmail:'faculty@example.test',facultyId:'f3',reportToUid:'',status:'pending_admin',contactAddress:'University',contactPhone:'403-555-0100',applicantSignature:{uid:'faculty',attested:true},submittedAt:serverTimestamp(),updatedAt:serverTimestamp()};
 await assertFails(setDoc(doc(member,'afc_requests/new'),validRequest));
 await assertFails(updateDoc(doc(admin,'afc_requests/request1'),{status:'approved',adminSignature:{uid:'general'},pdfChunkCount:1,pdfSha256:'hash',pdfByteLength:1,approvedAt:serverTimestamp(),updatedAt:serverTimestamp()}));
 await assertFails(deleteDoc(doc(admin,'afc_requests/request1')));
 await assertFails(setDoc(doc(admin,'afc_requests/request1/pdf_chunks/001'),{index:1,base64:'YQ==',sha256:'hash'}));
 await assertFails(setDoc(doc(admin,'session_change_log/new'),{changedBy:'general',changedAt:serverTimestamp()}));
 await assertFails(updateDoc(doc(admin,'session_change_log/new'),{changes:[]}));
 await assertFails(setDoc(doc(admin,'faculty_change_log/new'),{changedBy:'general',changedAt:serverTimestamp()}));
 await assertFails(setDoc(doc(admin,'afc_audit/new'),{changedBy:'general',changedAt:serverTimestamp()}));
 await assertFails(setDoc(doc(admin,'audit_events/new'),{changedBy:'general'}));
 for(const id of ['faculty_index','schedule_stats','faculty_swap_index','faculty_swap_map','faculty_summary_2026_27'])await assertFails(setDoc(doc(admin,`settings/${id}`),{source:'browser'}));
});

check('approval workflow cannot apply a session mutation even when it also writes an audit record',async()=>{
 const {assertFails}=require('@firebase/rules-unit-testing');
 const {doc,writeBatch,serverTimestamp}=require('firebase/firestore');
 const db=env.authenticatedContext('general').firestore(),batch=writeBatch(db);
 batch.update(doc(db,'sessions/s1'),{topic:'approved directly',updatedBy:'general',updatedAt:serverTimestamp()});
 batch.set(doc(db,'session_change_log/approval'),{action:'approved_session_edit',changedBy:'general',changedAt:serverTimestamp()});
 await assertFails(batch.commit());
});

check('retained User, Group, account audit, and public information features retain their intended Firestore scope',async()=>{
 const {assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
 const {doc,setDoc,updateDoc,deleteDoc,serverTimestamp}=require('firebase/firestore');
 const owner=env.authenticatedContext('owner').firestore(),hicc=env.authenticatedContext('hicc').firestore();
 await assertSucceeds(setDoc(doc(owner,'users/new-user'),{name:'New User',email:'new@example.test',role:'faculty',facultyId:'f3',active:true,mustChangePassword:true,updatedBy:'owner',updatedByName:'Owner',updatedAt:serverTimestamp(),createdAt:serverTimestamp()}));
 await assertSucceeds(setDoc(doc(owner,'faculty_groups/new-group'),{name:'Group',ownerUid:'hicc',courseIds:['301'],memberUids:['hicc'],createdAt:serverTimestamp(),updatedBy:'owner',updatedAt:serverTimestamp()}));
 await assertSucceeds(updateDoc(doc(hicc,'faculty_groups/new-group'),{memberUids:['hicc','faculty'],updatedBy:'hicc',updatedAt:serverTimestamp()}));
 await assertSucceeds(setDoc(doc(owner,'account_audit/new'),{action:'group_members_updated',changedBy:'owner',changedAt:serverTimestamp()}));
 await assertFails(updateDoc(doc(owner,'account_audit/new'),{action:'rewritten'}));
 await assertFails(deleteDoc(doc(owner,'account_audit/new')));
 await assertSucceeds(setDoc(doc(owner,'public_info/information_center'),{messages:[{id:'m1',title:'Notice',body:'Message'}],updatedBy:'owner',updatedAt:serverTimestamp()}));
 await assertFails(setDoc(doc(owner,'public_schedule/ccc_events'),{events:[],updatedBy:'owner',updatedAt:serverTimestamp()}));
});

module.exports={SQL_CANONICAL_PATHS};
