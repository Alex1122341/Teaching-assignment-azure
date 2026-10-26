'use strict';
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const enabled=Boolean(process.env.FIRESTORE_EMULATOR_HOST);let env;
const roles=['owner','administrator','hicc','visc','faculty','adfa_general'];
before(async()=>{
 if(!enabled)return;
 const {initializeTestEnvironment}=require('@firebase/rules-unit-testing');
 env=await initializeTestEnvironment({projectId:'demo-sec01-client-boundary',firestore:{rules:fs.readFileSync('firestore.rules','utf8')}});
 await env.clearFirestore();await env.withSecurityRulesDisabled(async context=>{
  const db=context.firestore();for(const role of roles)await db.doc('users/'+role).set({name:'Synthetic '+role,role,active:true,facultyId:'faculty-'+role,mustChangePassword:true,email:role+'@example.test'});
  for(const path of ['sessions/legacy','faculty/legacy','faculty_groups/legacy','public_info/information_center','settings/faculty_index','settings/system_state','public_schedule/ccc_events','account_audit/legacy','audit_events/legacy','session_change_log/legacy','faculty_change_log/legacy','afc_audit/legacy','afc_requests/legacy','bulk_import_jobs/legacy','change_requests/legacy'])await db.doc(path).set({ownerUid:'hicc',memberUids:['hicc','faculty'],requesterUid:'faculty',changedBy:'owner',role:'faculty',messages:[],private:'RETAINED-EVIDENCE'});
  // Stale compatibility profiles claim full readiness; SQL revocation must still
  // leave no independent client business authority in this database.
  for(const role of roles)await db.doc('users/'+role).update({mustChangePassword:false});
 });
});
after(async()=>{if(env)await env.cleanup();});
const check=(name,work)=>test(name,{skip:!enabled},work);
check('stale Firestore roles cannot independently read business, directory, collaboration or audit data',async()=>{
 const {assertFails,assertSucceeds}=require('@firebase/rules-unit-testing'),{doc,getDoc,collection,getDocs}=require('firebase/firestore');
 const paths=['sessions/legacy','faculty/legacy','faculty_groups/legacy','public_info/information_center','settings/faculty_index','settings/system_state','public_schedule/ccc_events','account_audit/legacy','audit_events/legacy','session_change_log/legacy','faculty_change_log/legacy','afc_audit/legacy','afc_requests/legacy','bulk_import_jobs/legacy','change_requests/legacy'];
 for(const role of roles){const db=env.authenticatedContext(role).firestore();await assertSucceeds(getDoc(doc(db,'users/'+role)));await assertFails(getDocs(collection(db,'users')));await assertFails(getDoc(doc(db,'users/'+(role==='owner'?'faculty':'owner'))));for(const path of paths)await assertFails(getDoc(doc(db,path)));}
 await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'users/owner')));
});
check('all direct account, group, information and audit writes stay denied for every compatibility role',async()=>{
 const {assertFails}=require('@firebase/rules-unit-testing'),{doc,setDoc,updateDoc,deleteDoc,serverTimestamp}=require('firebase/firestore');
 for(const role of roles){const db=env.authenticatedContext(role).firestore();await assertFails(updateDoc(doc(db,'users/'+role),{role:'owner',updatedBy:role,updatedAt:serverTimestamp()}));await assertFails(setDoc(doc(db,'users/new'),{name:'New',email:'new@example.test',role:'faculty',facultyId:'legacy',active:true,updatedBy:role,updatedAt:serverTimestamp(),createdAt:serverTimestamp()}));await assertFails(updateDoc(doc(db,'faculty_groups/legacy'),{memberUids:['hicc'],updatedBy:role,updatedAt:serverTimestamp()}));await assertFails(deleteDoc(doc(db,'faculty_groups/legacy')));await assertFails(setDoc(doc(db,'public_info/information_center'),{messages:[],updatedBy:role,updatedAt:serverTimestamp()}));await assertFails(setDoc(doc(db,'account_audit/forged'),{changedBy:role,changedAt:serverTimestamp()}));}
 let evidence;await env.withSecurityRulesDisabled(async context=>{evidence=(await context.firestore().doc('faculty_groups/legacy').get()).data();});assert.equal(evidence.private,'RETAINED-EVIDENCE');
});
check('compatibility password completion permits only self timestamps and flag, never roles or active changes',async()=>{
 const {assertFails,assertSucceeds}=require('@firebase/rules-unit-testing'),{doc,updateDoc,serverTimestamp}=require('firebase/firestore');
 const db=env.authenticatedContext('faculty').firestore(),patch={mustChangePassword:false,passwordChangedAt:serverTimestamp(),updatedAt:serverTimestamp()};
 await assertFails(updateDoc(doc(db,'users/owner'),patch));await assertFails(updateDoc(doc(db,'users/faculty'),{...patch,role:'owner'}));await assertFails(updateDoc(doc(db,'users/faculty'),{...patch,active:false}));await assertSucceeds(updateDoc(doc(db,'users/faculty'),patch));
});
