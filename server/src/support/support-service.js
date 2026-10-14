'use strict';
const { AsyncLocalStorage } = require('node:async_hooks');
const { randomUUID } = require('node:crypto');
const {isSupportedRole,normalizeBaseRole}=require('../auth/role-policy');
// Persona privilege ranks. A Testing operator can never assume a persona ranked above itself.
const RANK=Object.freeze({developer:4,adfa_general:3,adfa_regular:2});
const rankOf=role=>RANK[normalizeBaseRole(role)]||1;
const PRODUCTION_OPERATOR_ROLES=Object.freeze(['developer']);
// Testing personas are available to developers and ADFAD administrators, and only when the
// server itself runs as the Testing environment (never selectable by a client).
const TESTING_OPERATOR_ROLES=Object.freeze(['developer','owner','adfa_general','administrator','adfa_regular','admin']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const response=(status,jsonBody)=>({status,jsonBody});
const fail=(status,code,message)=>Object.assign(new Error(message),{status,code});

function createSupportService({db,verifyToken,findUser,environment={name:'production',testing:false}}){
 const testing=environment&&environment.testing===true;
 const operatorRoles=testing?TESTING_OPERATOR_ROLES:PRODUCTION_OPERATOR_ROLES;
 const isOperator=role=>operatorRoles.includes(String(role||'').trim().toLowerCase());
 // Production keeps the original rule (a developer may support any supported account).
 const mayAssume=(actor,target)=>!testing||rankOf(target.baseRole)<=rankOf(actor.baseRole);
 const scope=new AsyncLocalStorage();
 async function payload(request){try{const value=await request.json();if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value;}catch{throw fail(400,'INVALID_JSON','Provide a valid support action.');}}
 const realToken=request=>String(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 async function developer(request){
  let decoded;try{decoded=await verifyToken(realToken(request));}catch{throw fail(401,'UNAUTHENTICATED','Sign in required.');}
  const actor=await findUser(decoded.uid);
  if(!actor||!actor.active||actor.mustChangePassword||!isOperator(actor.baseRole))throw fail(403,'DEVELOPER_REQUIRED',testing?'An active Developer or ADFAD administrator account is required.':'An active Developer account is required.');
  return {decoded,actor};
 }
 async function context(id,uid,actor){
  if(!UUID.test(id))throw fail(403,'SUPPORT_CONTEXT_INVALID','Support context is invalid. Return to your own account.');
  const rows=await db.query(`SELECT c.ContextId AS id,c.TargetUid AS targetUid,c.Reason AS reason,c.ExpiresAtUtc AS expiresAtUtc FROM paws.SupportContext c WHERE c.ContextId=@id AND c.ActorUid=@uid AND c.EndedAtUtc IS NULL AND c.ExpiresAtUtc>SYSUTCDATETIME()`,{id,uid});
  if(!rows[0])throw fail(403,'SUPPORT_CONTEXT_EXPIRED','Support session ended or expired. Return to your own account.');
  const target=await findUser(rows[0].targetUid);
  if(!target||!target.active||target.mustChangePassword||!isSupportedRole(target.baseRole))throw fail(403,'SUPPORT_TARGET_UNAVAILABLE','The selected account is unavailable.');
  if(actor&&!mayAssume(actor,target))throw fail(403,'SUPPORT_ESCALATION_DENIED','This persona has more privileges than your own account.');
  return {...rows[0],target};
 }
 async function api(request){
  const {actor}=await developer(request),path=new URL(request.url).pathname;
  if(request.method==='GET'&&path==='/api/v1/support'){
   const accounts=await db.query(`SELECT FirebaseUid AS uid,DisplayName AS name,BaseRole AS role FROM paws.UserProfile WHERE Active=1 AND MustChangePassword=0 ORDER BY BaseRole,DisplayName`);
   const operations=await db.query(`SELECT TOP(50) o.OperationId AS id,o.Route AS route,o.CreatedAtUtc AS createdAtUtc,o.UndoneAtUtc AS undoneAtUtc,c.Reason AS reason,u.DisplayName AS targetName,u.BaseRole AS targetRole,(SELECT COUNT_BIG(*) FROM paws.SupportChange ch WHERE ch.OperationId=o.OperationId) AS changeCount FROM paws.SupportOperation o JOIN paws.SupportContext c ON c.ContextId=o.ContextId LEFT JOIN paws.UserProfile u ON u.FirebaseUid=o.TargetUid WHERE o.ActorUid=@uid ORDER BY o.CreatedAtUtc DESC`,{uid:actor.firebaseUid});
   return response(200,{accounts:accounts.filter(a=>isSupportedRole(a.role)&&mayAssume(actor,{baseRole:a.role})),operations,actor:{name:actor.displayName,role:actor.baseRole},environment:{name:environment.name,testing},mode:testing?'testing_persona':'developer_support'});
  }
  if(request.method==='POST'&&path==='/api/v1/support/start'){
   const body=await payload(request);const reason=String(body.reason||'').trim(),targetUid=String(body.targetUid||'');
   if(!reason||reason.length>1000)throw fail(400,'SUPPORT_REASON_REQUIRED','Provide a support or test reason (up to1000 characters).');
   const target=await findUser(targetUid);if(!target||!target.active||target.mustChangePassword||!isSupportedRole(target.baseRole))throw fail(400,'SUPPORT_TARGET_UNAVAILABLE','Choose an active SQL account.');
   if(!mayAssume(actor,target))throw fail(403,'SUPPORT_ESCALATION_DENIED','This persona has more privileges than your own account.');
   const id=randomUUID();
   await db.query(`SET XACT_ABORT ON; BEGIN TRANSACTION; IF NOT EXISTS(SELECT 1 FROM paws.UserProfile WITH(UPDLOCK,HOLDLOCK) WHERE FirebaseUid=@actor AND LOWER(LTRIM(RTRIM(BaseRole))) IN (SELECT [value] FROM OPENJSON(@operatorRoles)) AND Active=1 AND MustChangePassword=0) THROW 53303,'Developer identity required.',1; IF NOT EXISTS(SELECT 1 FROM paws.UserProfile WITH(UPDLOCK,HOLDLOCK) WHERE FirebaseUid=@target AND Active=1 AND MustChangePassword=0) THROW 53303,'Target account unavailable.',1; INSERT paws.SupportContext(ContextId,ActorUid,TargetUid,Reason,ExpiresAtUtc) VALUES(@id,@actor,@target,@reason,DATEADD(minute,30,SYSUTCDATETIME())); INSERT paws.AuditEvent(AuditEventId,EventType,EntityType,EntityId,ActorFirebaseUid,OccurredAtUtc,MetadataJson) VALUES(NEWID(),@eventType,N'support_context',@id,@actor,SYSUTCDATETIME(),(SELECT @target AS targetUid,@environment AS environment FOR JSON PATH,WITHOUT_ARRAY_WRAPPER)); COMMIT;`,{id,actor:actor.firebaseUid,target:targetUid,reason,operatorRoles:JSON.stringify(operatorRoles),eventType:testing?'testing_persona_start':'developer_support_start',environment:environment.name});
   return response(201,{contextId:id});
  }
  if(request.method==='POST'&&path==='/api/v1/support/end'){
   const body=await payload(request);if(!UUID.test(String(body.contextId||'')))throw fail(400,'SUPPORT_CONTEXT_INVALID','Context identifier required.');
   await db.query(`UPDATE paws.SupportContext SET EndedAtUtc=SYSUTCDATETIME() WHERE ContextId=@id AND ActorUid=@uid AND EndedAtUtc IS NULL`,{id:body.contextId,uid:actor.firebaseUid});return response(200,{ended:true});
  }
  if(request.method==='POST'&&path==='/api/v1/support/undo'){
   const body=await payload(request);if(!UUID.test(String(body.operationId||'')))throw fail(400,'SUPPORT_OPERATION_INVALID','Operation identifier required.');
   await db.query(`EXEC paws_api.UndoSupportOperation @OperationId=@id,@ActorUid=@uid`,{id:body.operationId,uid:actor.firebaseUid});return response(200,{undone:true});
  }
  return response(405,{error:{code:'METHOD_NOT_ALLOWED',message:'Support action not available.'}});
 }
 async function handle(request,next){
  try{
   const path=new URL(request.url).pathname;
   if(path==='/api/v1/support'||path.startsWith('/api/v1/support/'))return await api(request);
   const id=request.headers.get('x-paws-support-context');
   if(!id)return await next(request);
   // Identity is always resolved from the real Firebase credential, then from SQL.
   const {decoded,actor}=await developer(request),selected=await context(id,decoded.uid,actor);
   if(!/^\/api\/v1\/(me|sessions(?:\/|$)|dashboard(?:\/|$)|swaps(?:\/|$)|teaching-assignments(?:\/|$)|doe(?:\/|$)|afc-requests(?:\/|$))/.test(path)||/approved-artifact/.test(path))throw fail(403,'SUPPORT_ROUTE_DENIED','This operation is unavailable in support mode. Return to yourself.');
   const state={decoded:{...decoded,uid:selected.targetUid},contextId:id,targetName:selected.target.displayName,targetRole:selected.target.baseRole,actorName:actor.displayName,actorRole:actor.baseRole};
   const invoke=()=>scope.run(state,()=>next(request));
   if(request.method==='GET'){
    const result=await invoke();if(path==='/api/v1/me'&&result.status===200)result.jsonBody.support={id,actorName:state.actorName,actorRole:state.actorRole,targetName:state.targetName,targetRole:state.targetRole,expiresAtUtc:selected.expiresAtUtc,mode:testing?'testing_persona':'developer_support'};return result;
   }
   const operationId=randomUUID();
   return await db.transaction(async()=>{
    // Revalidate both profiles and context inside the mutation transaction.
    await context(id,decoded.uid,(await developer(request)).actor);
    await db.query(`INSERT paws.SupportOperation(OperationId,ContextId,ActorUid,TargetUid,Route) VALUES(@op,@context,@actor,@target,@route); EXEC sys.sp_set_session_context @key=N'paws_support_operation',@value=@op`,{op:operationId,context:id,actor:decoded.uid,target:selected.targetUid,route:request.method+' '+path});
    const result=await invoke();
    if(result.status>=400)throw Object.assign(fail(result.status,result.jsonBody?.error?.code||'SUPPORT_WRITE_FAILED',result.jsonBody?.error?.message||'Support operation failed.'),{outcome:result});
    await db.query(`EXEC sys.sp_set_session_context @key=N'paws_support_operation',@value=NULL; INSERT paws.AuditEvent(AuditEventId,EventType,EntityType,EntityId,ActorFirebaseUid,OccurredAtUtc,MetadataJson) VALUES(NEWID(),N'developer_support_operation',N'support_operation',@op,@actor,SYSUTCDATETIME(),(SELECT @target AS targetUid,@context AS contextId FOR JSON PATH,WITHOUT_ARRAY_WRAPPER))`,{op:operationId,actor:decoded.uid,target:selected.targetUid,context:id});
    if(result.jsonBody)result.jsonBody.supportOperationId=operationId;return result;
   },{supportOperationId:operationId});
  }catch(error){
   if(error.outcome)return error.outcome;
   const number=error.number||error.originalError?.info?.number;
   if(number===53305)return response(409,{error:{code:'SUPPORT_UNDO_CONFLICT',message:'Records changed since this action. Nothing was restored.'}});
   if(number===53302)return response(409,{error:{code:'SUPPORT_WRITE_UNSUPPORTED',message:'This data cannot be safely restored in support mode. Nothing was saved.'}});
   return response(error.status||([53302,53304].includes(number)?409:503),{error:{code:error.code||'SUPPORT_UNAVAILABLE',message:error.status?error.message:'Support operation could not complete. No partial recovery was applied.'}});
  }
 }
 return {handle,verify:async token=>{const original=await verifyToken(token);const current=scope.getStore();return current?{...original,uid:current.decoded.uid}:original;}};
}
module.exports={createSupportService};
