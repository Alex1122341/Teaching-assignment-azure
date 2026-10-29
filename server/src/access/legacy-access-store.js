'use strict';
const invalid=code=>Object.assign(Error('Legacy collaboration state changed.'),{code});
function version(snapshot){return snapshot.exists?`${snapshot.updateTime.seconds}.${String(snapshot.updateTime.nanoseconds).padStart(9,'0')}`:'none';}
function group(snapshot){return snapshot.exists?{...snapshot.data(),id:snapshot.id,version:version(snapshot)}:null;}
function announcements(snapshot){return {version:version(snapshot),messages:snapshot.exists?snapshot.data().messages:[]};}
const evidence=value=>value?{name:value.name||null,ownerUid:value.ownerUid||null,courseIds:value.courseIds||[],memberUids:value.memberUids||[]}:null;

function createLegacyAccessStore({getFirestore,serverTimestamp}){
 const groupRef=(db,id)=>{if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(id))throw invalid('GROUP_NOT_FOUND');return db.collection('faculty_groups').doc(id);};
 async function saveGroup(command,create){
  const db=getFirestore(),ref=groupRef(db,command.id),audit=db.collection('account_audit').doc();
  if(typeof command.actor?.uid!=='string'||!command.actor.uid)throw Error('Trusted actor is required.');
  await db.runTransaction(async transaction=>{
   const snapshot=await transaction.get(ref),current=group(snapshot);
   if(create&&snapshot.exists)throw invalid('GROUP_ALREADY_EXISTS');
   if(!create&&!snapshot.exists)throw invalid('GROUP_NOT_FOUND');
   if(!create&&version(snapshot)!==command.expectedVersion)throw invalid('GROUP_STALE');
   // The service rechecks SQL authority and scope inside this transaction callback,
   // including every Firestore conflict retry; client JSON never supplies this function.
   const patch=await command.buildPatch(current);
   if(!patch||Object.keys(patch).some(key=>!['name','ownerUid','courseIds','memberUids'].includes(key)))throw Error('Unsupported group fields');
   const after={...current,...patch},stamp=serverTimestamp();
   const saved={...patch,updatedBy:command.actor.uid,updatedByName:command.actor.name||'',updatedAt:stamp};
   if(create)transaction.create(ref,{...saved,createdAt:stamp});else transaction.update(ref,saved);
   transaction.create(audit,{action:command.action||'group_updated',groupId:command.id,changedBy:command.actor.uid,changedByName:command.actor.name||'',changedAt:stamp,before:evidence(current),after:evidence(after),authority:'sql-authorized-collaboration'});
  });
  return group(await ref.get());
 }
 return Object.freeze({
  async listGroups({ownerUid}){let query=getFirestore().collection('faculty_groups');if(ownerUid)query=query.where('ownerUid','==',ownerUid);return (await query.limit(1001).get()).docs.map(group);},
  createGroup:command=>saveGroup(command,true),
  updateGroup:command=>saveGroup(command,false),
  async readAnnouncements(){return announcements(await getFirestore().doc('public_info/information_center').get());},
  async updateAnnouncements(command){
   const db=getFirestore(),ref=db.doc('public_info/information_center'),audit=db.collection('account_audit').doc();
   if(typeof command.actor?.uid!=='string'||!command.actor.uid)throw Error('Trusted actor is required.');
   await db.runTransaction(async transaction=>{
    const snapshot=await transaction.get(ref),current=announcements(snapshot);
    if(current.version!==command.expectedVersion)throw invalid('ANNOUNCEMENT_STALE');
    const patch=await command.buildPatch(current);
    if(!patch||Object.keys(patch).some(key=>key!=='messages')||!Array.isArray(patch.messages)||patch.messages.length>10)throw Error('Invalid announcement update');
    const stamp=serverTimestamp();transaction.set(ref,{messages:patch.messages,updatedBy:command.actor.uid,updatedAt:stamp},{merge:true});
    transaction.create(audit,{action:'announcement_published',changedBy:command.actor.uid,changedByName:command.actor.name||'',changedAt:stamp,before:{messages:current.messages},after:{messages:patch.messages},authority:'sql-authorized-collaboration'});
   });
   return announcements(await ref.get());
  },
  async listLegacyAudit({cursor}){
   const db=getFirestore();let query=db.collection('account_audit').orderBy('changedAt','desc');
   if(cursor){
    if(typeof cursor!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(cursor))throw invalid('LEGACY_CURSOR_STALE');
    const snapshot=await db.collection('account_audit').doc(cursor).get();if(!snapshot.exists||!snapshot.data().changedAt)throw invalid('LEGACY_CURSOR_STALE');query=query.startAfter(snapshot);
   }
   return (await query.limit(51).get()).docs.map(snapshot=>({...snapshot.data(),id:snapshot.id}));
  }
 });
}
module.exports={createLegacyAccessStore};
