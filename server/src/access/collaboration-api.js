'use strict';
const {normalizeBaseRole,isSelfServiceRole}=require('../auth/role-policy');
const {validateAuthorizedProfile}=require('../data/data-api');
const names=require('../domain/person-name');
const {randomUUID}=require('node:crypto');
const professionalName=value=>{const label=names.format(value);return label&&!label.includes('@')?label:'Name unavailable';};
const dateText=value=>{try{if(typeof value==='string'&&value.length<=64)return value;if(typeof value?.toDate==='function')return value.toDate().toISOString();if(value instanceof Date)return value.toISOString();}catch(_){/* retain missing timestamp */}return null;};
const fail=(status,code,message)=>({status,body:{error:{code,message}}});
const ok=body=>({status:200,body});
const owner=auth=>auth.role==='adfa_general';
const scope=auth=>JSON.stringify([auth.uid,auth.role,auth.profile.facultyId||null,auth.profile.version]);
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const GROUP=/^[A-Za-z0-9_-]{1,128}$/,VERSION=/^[0-9]{1,12}\.[0-9]{9}$/;
const closed=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key));
class PublicFailure extends Error{constructor(result){super('Collaboration request rejected');this.result=result;}}
const reject=result=>{throw new PublicFailure(result);};
function failure(error){
 if(error instanceof PublicFailure)return error.result;
 if(error?.code==='GROUP_NOT_FOUND')return fail(404,'GROUP_NOT_FOUND','The collaboration group was not found.');
 const conflicts={GROUP_ALREADY_EXISTS:'This creation identifier already exists. Reload groups to confirm the outcome.',GROUP_STALE:'This group changed. Reload it before saving.',ANNOUNCEMENT_STALE:'Updates changed. Reload before publishing again.',LEGACY_CURSOR_STALE:'This history page changed. Reload history from the beginning.'};
 if(conflicts[error?.code])return fail(409,error.code,conflicts[error.code]);
 return fail(503,'COLLABORATION_UNAVAILABLE','The collaboration request could not be confirmed. Reload before making another change.');
}

function directory(rows){
 if(!Array.isArray(rows)||rows.length>1000)throw Error('Invalid collaborator source');
 const byUid=new Map(),byFaculty=new Map(),ambiguous=new Set();
 for(const row of rows){
  if(typeof row.firebaseUid!=='string'||byUid.has(row.firebaseUid))throw Error('Invalid collaborator identity');
  const person={...row,baseRole:normalizeBaseRole(row.baseRole)};byUid.set(row.firebaseUid,person);
  if(!UUID.test(person.facultyId||'')||!isSelfServiceRole(person.baseRole))continue;
  if(byFaculty.has(person.facultyId))ambiguous.add(person.facultyId);else byFaculty.set(person.facultyId,person);
 }
 for(const id of ambiguous)byFaculty.delete(id);
 const available=person=>person.active===true&&person.mustChangePassword!==true&&person.facultyActive!==false;
 const publicPerson=person=>({facultyId:person.facultyId,displayName:professionalName(person),role:person.baseRole,available:available(person)});
 const resolve=uid=>{const person=byUid.get(uid);return person&&byFaculty.get(person.facultyId)?.firebaseUid===uid?person:null;};
 return {byUid,byFaculty,available,publicPerson,resolve,candidates:[...byFaculty.values()].filter(available).map(publicPerson).sort((a,b)=>a.displayName.localeCompare(b.displayName,'en'))};
}
function groupDto(group,auth,people){
 if(typeof group.id!=='string'||typeof group.name!=='string'||!Array.isArray(group.courseIds)||!Array.isArray(group.memberUids)||group.memberUids.length>1000||typeof group.version!=='string')throw Error('Invalid group source');
 const members=[],unresolved=new Set(),seen=new Set();
 for(const uid of group.memberUids){if(seen.has(uid))continue;seen.add(uid);const person=people.resolve(uid);if(person)members.push(people.publicPerson(person));else unresolved.add(uid);}
 const leader=people.resolve(group.ownerUid);
 return {id:group.id,name:group.name,courseIds:group.courseIds.map(value=>String(value)),ownerFacultyId:leader?.facultyId||null,ownerName:leader?professionalName(leader):'Not provided',members,unresolvedMemberships:unresolved.size,version:group.version,canManageMembers:owner(auth)||group.ownerUid===auth.uid,canManageDetails:owner(auth)};
}
function announcementDto(state){
 if(!state||typeof state.version!=='string'||!Array.isArray(state.messages)||state.messages.length>10)throw Error('Invalid announcement source');
 return {version:state.version,messages:state.messages.map(item=>{
  if(typeof item.id!=='string'||typeof item.title!=='string'||item.title.length>80||typeof item.body!=='string'||item.body.length>500)throw Error('Invalid announcement');
  return {id:item.id,title:item.title,body:item.body,authorName:typeof item.authorName==='string'&&!item.authorName.includes('@')?names.format(item.authorName):'UCVM',createdAt:dateText(item.createdAt)};
 })};
}

function createCollaborationApi({verifyToken,findUser,repository,store,writeEnabled=false,randomId=randomUUID,clock=Date.now}){
 writeEnabled=writeEnabled===true;
 async function authorize(token){
  let decoded;try{decoded=token&&await verifyToken(token);}catch(_){/* fixed response below */}
  if(typeof decoded?.uid!=='string'||!decoded.uid||decoded.uid.length>128)return {response:fail(401,'UNAUTHENTICATED','A valid sign-in is required.')};
  try{
   const profile=await findUser(decoded.uid),validated=validateAuthorizedProfile(profile);if(validated.status)return {response:validated};
   const auth={uid:decoded.uid,profile:{...profile},role:validated.role};auth.binding=scope(auth);return auth;
  }catch(_){return {response:fail(503,'COLLABORATION_UNAVAILABLE','Effective access could not be checked.')};}
 }
 async function groupActor(token){const auth=await authorize(token);if(auth.response)return auth;if(!owner(auth)&&auth.role!=='hicc')return {response:fail(403,'COLLABORATION_ROLE_DENIED','Owner or HICC access is required for collaboration groups.')};return auth;}
 async function recheck(token,auth){const current=await authorize(token);if(current.response)return current.response;if(scope(current)!==auth.binding)return fail(403,'ACCESS_CHANGED','Your effective access changed. Refresh before continuing.');return null;}
 return Object.freeze({
  async groups(token){
   const auth=await groupActor(token);if(auth.response)return auth.response;
   try{
    const [rows,profiles]=await Promise.all([store.listGroups({ownerUid:owner(auth)?null:auth.uid}),repository.collaborators()]);
    if(!Array.isArray(rows)||rows.length>1000)throw Error('Invalid group source');
    const people=directory(profiles),groups=rows.filter(row=>owner(auth)||row.ownerUid===auth.uid).map(row=>groupDto(row,auth,people));
    const changed=await recheck(token,auth);if(changed)return changed;
    return ok({groups,candidates:people.candidates,collaborationOnly:true,writeEnabled});
   }catch(_){return fail(503,'COLLABORATION_UNAVAILABLE','Collaboration groups could not be loaded.');}
  },
  async updateMembers(token,id,input){
   const auth=await groupActor(token);if(auth.response)return auth.response;
   if(!writeEnabled)return fail(503,'WRITE_DISABLED','Collaboration changes are disabled.');
   if(typeof id!=='string'||!GROUP.test(id)||!closed(input,['expectedVersion','memberFacultyIds'])||typeof input.expectedVersion!=='string'||!VERSION.test(input.expectedVersion)||!Array.isArray(input.memberFacultyIds)||!input.memberFacultyIds.length||input.memberFacultyIds.length>500||input.memberFacultyIds.some(value=>typeof value!=='string'||!UUID.test(value))||new Set(input.memberFacultyIds).size!==input.memberFacultyIds.length)return fail(400,'INVALID_GROUP_CHANGE','Provide the group version and distinct canonical faculty members.');
   try{
    const group=await store.updateGroup({id,expectedVersion:input.expectedVersion,actor:{uid:auth.uid,name:names.format(auth.profile)},action:'group_members_updated',buildPatch:async current=>{
     const fresh=await groupActor(token);if(fresh.response)reject(fresh.response);
     if(scope(fresh)!==auth.binding)reject(fail(403,'ACCESS_CHANGED','Your effective access changed. Reload before continuing.'));
     if(!owner(fresh)&&current.ownerUid!==fresh.uid)reject(fail(403,'GROUP_SCOPE_DENIED','Only your own collaboration group can be changed.'));
     const people=directory(await repository.collaborators()),leader=people.resolve(current.ownerUid);
     if(!leader)reject(fail(409,'GROUP_REVIEW_REQUIRED','This legacy group owner needs identity review before editing.'));
     if(!input.memberFacultyIds.includes(leader.facultyId))reject(fail(400,'INVALID_GROUP_CHANGE','The group owner must remain a member.'));
     const memberUids=input.memberFacultyIds.map(facultyId=>{
      const person=people.byFaculty.get(facultyId);
      if(!person||!people.available(person))reject(fail(400,'INVALID_GROUP_CHANGE','A selected member is unavailable or ambiguous. Reload the choices.'));
      return person.firebaseUid;
     });
     for(const uid of current.memberUids||[])if((!people.resolve(uid)||!people.available(people.resolve(uid)))&&!memberUids.includes(uid))memberUids.push(uid);
     if(memberUids.length>1000)reject(fail(413,'GROUP_LIMIT','The group exceeds the membership limit.'));
     const changed=await recheck(token,auth);if(changed)reject(changed);
     return {memberUids};
    }});
    const people=directory(await repository.collaborators());
    const changed=await recheck(token,auth);if(changed)return changed;
    return ok({group:groupDto(group,auth,people),collaborationOnly:true});
   }catch(error){return failure(error);}
  },
  async saveGroup(token,id,input){
   const auth=await authorize(token);if(auth.response)return auth.response;if(!owner(auth))return fail(403,'OWNER_REQUIRED','Only a SQL Owner can change group details.');
   if(!writeEnabled)return fail(503,'WRITE_DISABLED','Collaboration changes are disabled.');
   if(id!==null&&(typeof id!=='string'||!GROUP.test(id))||!closed(input,['creationId','expectedVersion','name','ownerFacultyId','courseIds','memberFacultyIds'])||typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>200||/[\x00-\x1f\x7f]/.test(input.name)||typeof input.ownerFacultyId!=='string'||!UUID.test(input.ownerFacultyId)||!Array.isArray(input.courseIds)||input.courseIds.length>20||input.courseIds.some(value=>typeof value!=='string'||!value.trim()||value.trim().length>32||/[\x00-\x1f\x7f]/.test(value))||!Array.isArray(input.memberFacultyIds)||!input.memberFacultyIds.length||input.memberFacultyIds.length>500||input.memberFacultyIds.some(value=>typeof value!=='string'||!UUID.test(value))||new Set(input.memberFacultyIds).size!==input.memberFacultyIds.length||id!==null&&(typeof input.expectedVersion!=='string'||!VERSION.test(input.expectedVersion))||id!==null&&input.creationId!==undefined||id===null&&(input.expectedVersion!==undefined||typeof input.creationId!=='string'||!UUID.test(input.creationId)))return fail(400,'INVALID_GROUP_CHANGE','Provide exact collaboration details and canonical faculty choices.');
   try{
    const groupId=id||input.creationId;if(!GROUP.test(groupId))throw Error('Invalid generated group identifier');
    const command={id:groupId,expectedVersion:input.expectedVersion,actor:{uid:auth.uid,name:names.format(auth.profile)},action:id?'group_updated':'group_created',buildPatch:async current=>{
     const fresh=await authorize(token);if(fresh.response)reject(fresh.response);
     if(!owner(fresh)||scope(fresh)!==auth.binding)reject(fail(403,'ACCESS_CHANGED','Your Owner access changed. Reload before continuing.'));
     const people=directory(await repository.collaborators()),leader=people.byFaculty.get(input.ownerFacultyId);
     if(!leader||leader.baseRole!=='hicc'||!people.available(leader))reject(fail(400,'INVALID_GROUP_CHANGE','Choose an active unambiguous SQL HICC as group owner.'));
     if(!input.memberFacultyIds.includes(leader.facultyId))reject(fail(400,'INVALID_GROUP_CHANGE','The group owner must remain a member.'));
     const memberUids=input.memberFacultyIds.map(facultyId=>{const person=people.byFaculty.get(facultyId);if(!person||!people.available(person))reject(fail(400,'INVALID_GROUP_CHANGE','A selected member is unavailable or ambiguous.'));return person.firebaseUid;});
     for(const uid of current?.memberUids||[])if((!people.resolve(uid)||!people.available(people.resolve(uid)))&&!memberUids.includes(uid))memberUids.push(uid);
     if(memberUids.length>1000)reject(fail(413,'GROUP_LIMIT','The group exceeds the membership limit.'));
     const changed=await recheck(token,auth);if(changed)reject(changed);
     return {name:input.name.trim(),ownerUid:leader.firebaseUid,courseIds:[...new Set(input.courseIds.map(value=>value.trim()))],memberUids};
    }};
    const group=await (id?store.updateGroup(command):store.createGroup(command));
    const people=directory(await repository.collaborators()),changed=await recheck(token,auth);if(changed)return changed;
    return ok({group:groupDto(group,auth,people),collaborationOnly:true});
   }catch(error){return failure(error);}
  },
  async announcements(token){
   const auth=await authorize(token);if(auth.response)return auth.response;
   try{const data=announcementDto(await store.readAnnouncements()),changed=await recheck(token,auth);return changed||ok({...data,canPublish:owner(auth)&&writeEnabled});}catch(error){return failure(error);}
  },
  async publishAnnouncement(token,input){
   const auth=await authorize(token);if(auth.response)return auth.response;if(!owner(auth))return fail(403,'OWNER_REQUIRED','Only a SQL Owner can publish an update.');
   if(!writeEnabled)return fail(503,'WRITE_DISABLED','Announcement publication is disabled.');
   if(!closed(input,['expectedVersion','title','body'])||typeof input.expectedVersion!=='string'||input.expectedVersion!=='none'&&!VERSION.test(input.expectedVersion)||typeof input.title!=='string'||!input.title.trim()||input.title.trim().length>80||typeof input.body!=='string'||!input.body.trim()||input.body.trim().length>500)return fail(400,'INVALID_ANNOUNCEMENT','Provide a title (1–80 characters), message (1–500) and current version.');
   try{
    const state=await store.updateAnnouncements({expectedVersion:input.expectedVersion,actor:{uid:auth.uid,name:names.format(auth.profile)},buildPatch:async current=>{
     const fresh=await authorize(token);if(fresh.response)reject(fresh.response);
     if(!owner(fresh)||scope(fresh)!==auth.binding)reject(fail(403,'ACCESS_CHANGED','Your Owner access changed. Reload before continuing.'));
     announcementDto(current);
     return {messages:[{id:randomId(),title:input.title.trim(),body:input.body.trim(),authorUid:fresh.uid,authorName:names.format(fresh.profile),createdAt:new Date(clock()).toISOString()},...current.messages].slice(0,10)};
    }});
    const data=announcementDto(state),changed=await recheck(token,auth);return changed||ok({...data,canPublish:true});
   }catch(error){return failure(error);}
  },
  async legacyAudit(token,input={}){
   const auth=await authorize(token);if(auth.response)return auth.response;if(!owner(auth))return fail(403,'OWNER_REQUIRED','Only a SQL Owner can view legacy account activity.');
   if(!closed(input,['cursor'])||input.cursor!==undefined&&(typeof input.cursor!=='string'||!GROUP.test(input.cursor)))return fail(400,'INVALID_ACCESS_QUERY','Provide a valid history cursor.');
   try{
    const source=await store.listLegacyAudit({cursor:input.cursor||null});if(!Array.isArray(source)||source.length>51)throw Error('Invalid legacy activity source');
    const rows=source.slice(0,50).map(row=>({id:row.id,source:row.authority==='sql-authorized-collaboration'?'sql_authorized_collaboration':'legacy_compatibility',action:typeof row.action==='string'?row.action:'not_recorded',actorName:professionalName(row.changedByName||'Unknown'),targetName:professionalName(row.targetName||row.groupName||'Legacy record'),beforeRole:typeof row.beforeRole==='string'?row.beforeRole:null,role:typeof row.role==='string'?row.role:null,active:typeof row.active==='boolean'?row.active:null,changedAt:dateText(row.changedAt)}));
    const changed=await recheck(token,auth);return changed||ok({rows,nextCursor:source.length>50?rows.at(-1).id:null,pageSize:50});
   }catch(error){return failure(error);}
  }
 });
}
module.exports={createCollaborationApi};
