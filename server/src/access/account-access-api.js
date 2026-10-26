'use strict';
const {normalizeBaseRole}=require('../auth/role-policy');
const {validateAuthorizedProfile}=require('../data/data-api');
const names=require('../domain/person-name');
const {randomUUID,createHash}=require('node:crypto');
const {normalizeAccessPatch,scope}=require('./account-access-policy');
const UID=/^[A-Za-z0-9_.:@-]{1,128}$/;
const VERSION=/^[a-f0-9]{16}$/i;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const fail=(status,code,message)=>({status,body:{error:{code,message}}});
const ok=body=>({status:200,body});
const closed=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key));
const owner=profile=>validateAuthorizedProfile(profile).role==='adfa_general';
const binding=profile=>JSON.stringify([profile?.baseRole,profile?.active,profile?.mustChangePassword,profile?.facultyId||null,profile?.version]);
function account(profile){return {uid:profile.firebaseUid,displayName:names.format(profile),email:profile.email||null,role:normalizeBaseRole(profile.baseRole)||profile.baseRole,facultyId:profile.facultyId||null,active:profile.active===true,mustChangePassword:profile.mustChangePassword===true,version:profile.version||null,editable:normalizeBaseRole(profile.baseRole)!=='developer'&&Boolean(normalizeBaseRole(profile.baseRole))&&/^[0-9a-f]{16}$/i.test(profile.version||'')};}

function createAccountAccessApi({verifyToken,findUser,repository,writeEnabled=false,clock=Date.now,randomId=randomUUID}){
 const previews=new Map();
 async function identity(token){
  for(const [id,preview] of previews)if(preview.expiresAt<=clock())previews.delete(id);
  let decoded;try{decoded=token&&await verifyToken(token);}catch(_){/* fixed identity response */}
  if(typeof decoded?.uid!=='string'||!decoded.uid||decoded.uid.length>128)return {response:fail(401,'UNAUTHENTICATED','A valid sign-in is required.')};
  try{return {uid:decoded.uid,profile:await findUser(decoded.uid)};}catch(_){return {response:fail(503,'ACCESS_UNAVAILABLE','Effective access could not be checked.')};}
 }
 async function authorize(token){const auth=await identity(token);if(auth.response)return auth;if(!owner(auth.profile))return {response:fail(403,'OWNER_REQUIRED','An active SQL Owner account is required.')};return {...auth,profile:{...auth.profile},binding:binding(auth.profile)};}
 async function recheck(token,auth,operation){
  const current=await authorize(token);if(current.response)return current.response;
  if(current.uid===auth.uid&&current.binding===auth.binding)return null;
  if(current.uid===auth.uid&&operation?.actorUid===auth.uid&&operation?.targetUid===auth.uid){
   const persisted=await repository.read(auth.uid);
   if(owner(persisted)&&persisted.version===operation.profile.version&&JSON.stringify(scope(persisted))===JSON.stringify(operation.after))return null;
  }
  return fail(403,'ACCESS_CHANGED','Your effective access changed. Refresh before continuing.');
 }
 return Object.freeze({
  async self(token){
   const auth=await identity(token);if(auth.response)return auth;const profile=auth.profile;
   if(!profile)return ok({access:{authority:'University SQL',allowed:false,status:'not_provisioned',role:null,canManageAccounts:false,canManageGroups:false}});
   const validated=validateAuthorizedProfile(profile),allowed=!validated.status;
   const status=profile.active!==true?'inactive':profile.mustChangePassword?'password_required':validated.status?'needs_review':'ready';
   return ok({access:{authority:'University SQL',allowed,status,displayName:names.format(profile),role:normalizeBaseRole(profile.baseRole),facultyId:profile.facultyId||null,canManageAccounts:allowed&&owner(profile),canManageGroups:allowed&&(owner(profile)||validated.role==='hicc')}});
  },
  async list(token,input={}){
   const auth=await authorize(token);if(auth.response)return auth.response;
   if(!closed(input,['search','offset'])||input.search!==undefined&&(typeof input.search!=='string'||input.search.length>120)||input.offset!==undefined&&(!Number.isSafeInteger(input.offset)||input.offset<0||input.offset%50))return fail(400,'INVALID_ACCESS_QUERY','Provide a search and a valid page offset.');
   try{
    const profiles=await repository.list();if(!Array.isArray(profiles))throw Error('Invalid account source');
    if(profiles.length>1000)return fail(413,'ACCESS_LIMIT','The account directory exceeds its bounded limit.');
    const query=(input.search||'').trim().toLowerCase(),rows=profiles.map(account).filter(row=>!query||[row.displayName,row.email,row.role].some(value=>String(value||'').toLowerCase().includes(query))).sort((a,b)=>a.displayName.localeCompare(b.displayName,'en')||a.uid.localeCompare(b.uid));
    const changed=await recheck(token,auth);if(changed)return changed;const offset=input.offset||0;
    return ok({authority:'University SQL',total:rows.length,offset,pageSize:50,accounts:rows.slice(offset,offset+50)});
   }catch(_){return fail(503,'ACCESS_UNAVAILABLE','Accounts could not be loaded. No permissions were changed.');}
  },
  async preview(token,input){
   const auth=await authorize(token);if(auth.response)return auth.response;
   if(!closed(input,['targetUid','expectedVersion','changes','reason'])||typeof input.targetUid!=='string'||!UID.test(input.targetUid)||typeof input.expectedVersion!=='string'||!VERSION.test(input.expectedVersion)||typeof input.reason!=='string'||!input.reason.trim()||input.reason.trim().length>1000)return fail(400,'INVALID_ACCESS_CHANGE','Provide a target version, exact change and reason (1–1000 characters).');
   try{
    const target=await repository.read(input.targetUid),actor=await repository.read(auth.uid);
    if(!target)return fail(404,'ACCOUNT_NOT_FOUND','The account was not found.');
    if(!owner(actor))return fail(403,'OWNER_REQUIRED','An active SQL Owner account is required.');
    if(!VERSION.test(actor.version||'')||!VERSION.test(target.version||''))throw Error('Access version unavailable');
    if(target.version.toLowerCase()!==input.expectedVersion.toLowerCase())return fail(409,'ACCESS_STALE','Access changed. Refresh and preview again.');
    if(normalizeBaseRole(target.baseRole)==='developer')return fail(403,'PROTECTED_ACCOUNT','Developer accounts are protected from this editor.');
    if(!normalizeBaseRole(target.baseRole))return fail(409,'ACCESS_REVIEW_REQUIRED','This legacy role requires explicit review.');
    const after=normalizeAccessPatch(input.changes,target),before=scope(target),reason=input.reason.trim();
    if(target.firebaseUid===auth.uid&&(!after.active||after.role!=='adfa_general'))return fail(409,'SELF_LOCKOUT','You cannot disable or demote your own Owner access.');
    if(JSON.stringify(before)===JSON.stringify(after))return fail(409,'ACCESS_NO_CHANGE','The requested access is already current.');
    if(after.facultyId&&after.active){
     const faculty=await repository.eligibleFaculty();if(!Array.isArray(faculty))throw Error('Invalid faculty source');
     if(faculty.length>5000)return fail(413,'ACCESS_LIMIT','The faculty identity list exceeds its bounded limit.');
     if(!faculty.some(row=>row.facultyId===after.facultyId&&row.active===true))return fail(400,'INVALID_ACCESS_CHANGE','Choose an active canonical faculty record.');
    }
    const changed=await recheck(token,auth);if(changed)return changed;
    const previewId=randomId(),expiresAt=clock()+600000;
    if(!UUID.test(previewId)||previews.has(previewId))throw Error('Invalid preview identifier');
    const own=[...previews].filter(([,preview])=>preview.uid===auth.uid);
    while(own.length>=2)previews.delete(own.shift()[0]);
    while(previews.size>=8)previews.delete(previews.keys().next().value);
    const intentHash=createHash('sha256').update(JSON.stringify([auth.uid,actor.version,target.firebaseUid,target.version,after,reason])).digest('hex');
    previews.set(previewId,{uid:auth.uid,actorVersion:actor.version,targetUid:target.firebaseUid,targetVersion:target.version,before,after,reason,intentHash,binding:auth.binding,expiresAt});
    return ok({previewId,expiresAt:new Date(expiresAt).toISOString(),target:{uid:target.firebaseUid,displayName:names.format(target)},before:{...before},after:{...after},reason});
   }catch(error){return error?.code==='INVALID_ACCESS_CHANGE'?fail(400,error.code,error.message):fail(503,'ACCESS_UNAVAILABLE','The change could not be previewed. No permissions were changed.');}
  },
  async commit(token,input){
   const auth=await authorize(token);if(auth.response)return auth.response;
   if(!writeEnabled)return fail(503,'WRITE_DISABLED','Account access changes are disabled. No permissions were changed.');
   if(!closed(input,['previewId','operationId'])||typeof input.previewId!=='string'||!UUID.test(input.previewId)||typeof input.operationId!=='string'||!UUID.test(input.operationId))return fail(400,'INVALID_ACCESS_CHANGE','Provide the exact preview and operation identifiers.');
   try{
    let operation=await repository.operation(input.operationId),replayed=Boolean(operation);
    if(operation&&(operation.actorUid!==auth.uid||operation.previewId!==input.previewId))return fail(409,'ACCESS_OPERATION_CONFLICT','This operation identifier belongs to a different intent.');
    if(!operation){
     const preview=previews.get(input.previewId);
     if(!preview||preview.expiresAt<=clock())return fail(409,'ACCESS_PREVIEW_EXPIRED','The preview expired. Refresh and preview again.');
     if(preview.uid!==auth.uid||preview.binding!==auth.binding)return fail(403,'ACCESS_PREVIEW_DENIED','This preview belongs to another effective access context.');
     const changed=await recheck(token,auth);if(changed)return changed;
     operation=await repository.commit({actorUid:auth.uid,actorVersion:preview.actorVersion,targetUid:preview.targetUid,expectedVersion:preview.targetVersion,before:{...preview.before},after:{...preview.after},reason:preview.reason,intentHash:preview.intentHash,previewId:input.previewId,operationId:input.operationId});
    }
    const changed=await recheck(token,auth,operation);if(changed)return changed;
    const current=await repository.read(operation.targetUid);if(!current)throw Error('Saved account unavailable');
    return ok({profile:account(current),replayed,superseded:current.version!==operation.profile.version,operation:{operationId:operation.operationId,actorUid:operation.actorUid,targetUid:operation.targetUid,reason:operation.reason,before:{...operation.before},after:{...operation.after},savedVersion:operation.profile.version,createdAtUtc:operation.createdAtUtc}});
   }catch(error){
    const number=error.number||error.originalError?.info?.number;
    const known={54001:[403,'OWNER_REQUIRED','Your Owner access changed. Refresh before continuing.'],54002:[404,'ACCOUNT_NOT_FOUND','The account was not found.'],54003:[409,'ACCESS_STALE','Access changed after this preview. Refresh and preview again.'],54004:[409,'LAST_OWNER','At least one ready Owner must remain.'],54005:[403,'PROTECTED_ACCOUNT','Developer accounts are protected.'],54006:[400,'INVALID_ACCESS_CHANGE','Choose an active canonical faculty record.'],54007:[400,'INVALID_ACCESS_CHANGE','The access change is invalid.'],54008:[409,'ACCESS_OPERATION_CONFLICT','The operation identifier has a different intent.'],54009:[409,'SELF_LOCKOUT','You cannot disable or demote your own Owner access.'],54010:[409,'ACCESS_NO_CHANGE','The requested access is already current.']};
    return known[number]?fail(...known[number]):{status:503,body:{error:{code:'ACCESS_CONFIRMATION_REQUIRED',message:'The outcome could not be confirmed. Retry the same operation identifier before making another change.'},operationId:input.operationId}};
   }
  },
  async history(token,input={}){
   const auth=await authorize(token);if(auth.response)return auth.response;
   if(!closed(input,['targetUid','offset'])||input.targetUid!==undefined&&(typeof input.targetUid!=='string'||!UID.test(input.targetUid))||input.offset!==undefined&&(!Number.isSafeInteger(input.offset)||input.offset<0||input.offset%50))return fail(400,'INVALID_ACCESS_QUERY','Provide a target account and valid page offset.');
   try{
    const result=await repository.history({targetUid:input.targetUid||null,offset:input.offset||0});
    if(!Number.isSafeInteger(result?.total)||result.total<0||!Array.isArray(result.rows)||result.rows.length>50)throw Error('Invalid history source');
    const changed=await recheck(token,auth);if(changed)return changed;
    const rows=result.rows.map(row=>({operationId:row.operationId,actorUid:row.actorUid,targetUid:row.targetUid,actorName:names.format(row.actorName||row.actorUid),targetName:names.format(row.targetName||row.targetUid),reason:row.reason,before:{...row.before},after:{...row.after},createdAtUtc:row.createdAtUtc}));
    return ok({total:result.total,offset:input.offset||0,pageSize:50,rows});
   }catch(_){return fail(503,'ACCESS_UNAVAILABLE','Account history could not be loaded.');}
  }
 });
}
module.exports={createAccountAccessApi};
