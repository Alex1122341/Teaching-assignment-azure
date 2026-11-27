'use strict';
// Review-only integration harness, outside the frozen runtime. It must run
// after the existing batch171 runner seeded the labeled disposable container.
// No configurable external endpoint, production identity, or real data.
const assert=require('node:assert/strict');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {randomBytes}=require('node:crypto');
const {performance}=require('node:perf_hooks');
const {runDoeHttpLoad}=require('./test-pr171-doe-http-load.cjs');
const product=process.env.PAWS_QA_PRODUCT_ROOT;
const sha=process.env.PRODUCT_SHA;
const marker=process.env.PAWS_BATCH_TEST_MARKER;
const saPassword=process.env.PAWS_SQL_TEST_PASSWORD;
if(process.env.GITHUB_ACTIONS!=='true'||!product||!saPassword||!(/^[a-f0-9]{40}$/.test(sha||''))||!(/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(marker||'')))throw Error('Disposable GitHub QA environment and exact product SHA required.');
assert.equal(execFileSync('git',['-C',product,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),sha);
const docker=JSON.parse(execFileSync('docker',['inspect','paws-calendar-batch171'],{encoding:'utf8'}))[0];
assert.equal(docker.Config.Labels['paws.calendar-test'],'1');
assert.equal(docker.State.Running,true);
assert.deepEqual(docker.NetworkSettings.Ports['1433/tcp'],[{HostIp:'127.0.0.1',HostPort:'14337'}]);
const load=file=>require(path.join(product,'server',file));
const sql=load('node_modules/mssql');
const {createSqlConnection}=load('src/data/sql-connection');
const {createSqlSessionRepository}=load('src/data/sql-session-repository');
const {createDataApi}=load('src/data/data-api');
const {createSqlDoeEngineRepository}=load('src/data/sql-doe-engine-repository');
const {createSqlDoeAssignmentRepository}=load('src/data/sql-doe-assignment-repository');
const {createDoeCalculationService}=load('src/doe/doe-calculation-service');
const {createDoeSessionService}=load('src/doe/doe-session-service');
const ids=['11111111-2222-4333-8444-555555555555','22222222-3333-4444-8555-666666666666'];
const actor='batch171-synthetic-actor';
const policy='77777777-7777-4777-8777-777777777777';
const rule='88888888-8888-4888-8888-888888888888';
function connection(user,password){
 return createSqlConnection({sql,requestTimeoutMs:45000,config:{
  server:'127.0.0.1',port:14337,database:'VetMed-Ops',user,password,
  options:{encrypt:true,trustServerCertificate:true},pool:{min:0,max:4}
 }});
}
const admin=connection('sa',saPassword);
let runtime,peer,stage='marker';
// Synthetic fixture diagnostics only; never emit SQL text, connection
// configuration, raw SQL messages, tokens, or production identities.
const emit=(event,details)=>console.log('PR171_DOE_DIAGNOSTIC '+JSON.stringify({stage,event,...details}));
const errorFacts=error=>({code:error?.code||null,number:error?.number??error?.originalError?.info?.number??null,precedingNumbers:(error?.precedingErrors||[]).map(e=>e?.number??e?.originalError?.info?.number??null),name:error?.name||null});
const factSummary=facts=>({sessionId:facts.sessionId,assignmentId:facts.assignmentId,facultyId:facts.facultyId,academicYear:facts.academicYear,courseCode:facts.courseCode,activityType:facts.activityType,role:facts.role,hours:facts.hours??null});

async function main(){
 const mark=await admin.query('SELECT CONVERT(varchar(36),Marker) AS marker FROM dbo.Batch171DisposableMarker WHERE Marker=@marker',{marker});
 assert.equal(mark.length,1);assert.equal(mark[0].marker.toLowerCase(),marker.toLowerCase());
 stage='readback-alias-probe';
 try{await admin.query('SELECT 1 AS trigger');emit('legacy-alias-accepted',{});}
 catch(error){emit('legacy-alias-rejected',errorFacts(error));}
 stage='fixture';
 const existing=await admin.query("SELECT COUNT(*) AS total FROM paws.Session WHERE SessionId IN (@s1,@s2) AND CourseCode=N'BATCH171'",{s1:ids[0],s2:ids[1]});
 assert.equal(Number(existing[0].total),2);
 // A deliberately artificial rule (2 credits/hour) exercises the real engine.
 // This is not the University annual rulebook or a reconciliation fixture.
 const password=randomBytes(24).toString('hex')+'!Aa1';
 await admin.query("CREATE LOGIN batch171_doe_qa WITH PASSWORD='"+password+"';");
 await admin.query(`
 CREATE USER batch171_doe_qa FOR LOGIN batch171_doe_qa;
 ALTER ROLE paws_runtime_read ADD MEMBER batch171_doe_qa;
 ALTER ROLE paws_runtime_session_edit_write ADD MEMBER batch171_doe_qa;
 GRANT SELECT ON OBJECT::paws.SessionAssignment(SourceFacultyName) TO batch171_doe_qa;
 GRANT SELECT ON OBJECT::paws.Session(SessionId,AcademicYear,CurriculumYear,CourseCode,SessionType,Topic,SessionDate,StartTime,EndTime) TO batch171_doe_qa;
 GRANT SELECT ON OBJECT::paws.DoePolicyVersion(PolicyVersionId,AcademicYear,VersionLabel,SourceReference,Status,Revision,UpdatedBy,ValidatedRevision,ValidatedChecksum,ImpactRevision,ImpactChecksum,CreatedAtUtc,UpdatedAtUtc) TO batch171_doe_qa;
 UPDATE paws.DoePolicyVersion SET Active=0,Status=N'archived' WHERE AcademicYear=N'2026-27' AND Status=N'active';
 INSERT paws.DoePolicyVersion(PolicyVersionId,AcademicYear,VersionLabel,SourceReference,Active,Status,Revision)
 VALUES(@policy,N'2026-27',N'Synthetic batch QA only',N'PR171 synthetic fixture',1,N'active',1);
 INSERT paws.DoePolicyRule(RuleId,PolicyVersionId,AcademicYear,RuleKey,Category,ActivityType,RuleLabel,CalculationMode,ReviewStatus)
 VALUES(@rule,@policy,N'2026-27',N'synthetic_lecture',N'teaching',N'LEC',N'Synthetic lecture',N'per_hour',N'approved');
 INSERT paws.DoeRuleParameter(ParameterId,RuleId,Name,ValueNumber) VALUES(NEWID(),@rule,N'rate',2);
 INSERT paws.DoeRuleSelector(SelectorId,RuleId,FieldName,Operator,ValueType,ValueText)
 VALUES(NEWID(),@rule,N'activityType',N'equals',N'text',N'LEC');
 INSERT paws.DoeRuleInput(RuleInputId,RuleId,InputName,Required) VALUES(NEWID(),@rule,N'hours',1);
 UPDATE paws.SessionAssignment SET CreditedHours=NULL WHERE SessionId IN (@s1,@s2);
 `,{policy,rule,s1:ids[0],s2:ids[1]});
 runtime=connection('batch171_doe_qa',password);
 function fixtureApi(db,label){
 const repo=createSqlSessionRepository(db);
 const engine=createSqlDoeEngineRepository(db);
 const assignments=createSqlDoeAssignmentRepository(db);
 const calculator=createDoeCalculationService({repository:engine});
 const phases=[],control={};
 const tracedRepository={...engine,...assignments,
  async loadSessionDoeFacts(id){
   try{
    const loaded=await assignments.loadSessionDoeFacts(id);
    emit('facts',{sessionId:id,academicYear:loaded?.academicYear,courseCode:loaded?.courseCode,sessionType:loaded?.sessionType,startTime:loaded?.startTime,endTime:loaded?.endTime,assignments:(loaded?.assignments||[]).map(a=>({assignmentId:a.sessionAssignmentId,facultyId:a.facultyId,role:a.teachingRole,creditedHours:a.creditedHours,revision:a.doeRevision}))});
    return loaded;
   }catch(error){emit('load-failed',{sessionId:id,...errorFacts(error)});throw error;}
  },
  async saveSessionDoeCalculations(input){
   const sessionIds=[...new Set(input.rows.map(row=>row.sessionId))];
   emit('persist-start',{sessionIds,rows:input.rows.map(row=>({facts:factSummary(row.factsSnapshot),status:row.calculationStatus,resultDoe:row.resultDoe,ruleKey:row.ruleKey}))});
   try{const saved=await assignments.saveSessionDoeCalculations(input);emit('persist-complete',{sessionIds,count:saved.length});return saved;}
   catch(error){emit('persist-failed',{sessionIds,...errorFacts(error)});throw error;}
  }
 };
 const tracedCalculator={async preview(input){
  const facts=factSummary(input.facts);
  try{const outcome=await calculator.preview(input);emit('rule-preview',{facts,status:outcome.status,ruleKey:outcome.ruleKey,resultDoe:outcome.resultDoe});return outcome;}
  catch(error){emit('rule-preview-failed',{facts,...errorFacts(error)});throw error;}
 }};
 const service=createDoeSessionService({repository:tracedRepository,calculationService:tracedCalculator});
 const api=createDataApi({
  verifyToken:async token=>{if(token!=='synthetic-token')throw Error('Synthetic token required');return {uid:actor};},
  findUser:async()=>({active:true,baseRole:'adfa_regular',displayName:'Synthetic ADFAD'}),
  listSessions:repo.list,
  updateSessionBatch:async input=>{
   const started=performance.now();
   try{const saved=await repo.updateBatch(input);phases.push({phase:'timetable',label,started,ended:performance.now(),status:'committed'});return saved;}
   catch(error){phases.push({phase:'timetable',label,started,ended:performance.now(),status:'rejected'});emit('timetable-failed',{label,...errorFacts(error)});throw error;}
  },
  recalculateSessionDoe:async input=>{
   if(control.beforeDoe)await control.beforeDoe();
   const started=performance.now();
   try{const result=await service.recalculate(input);emit('service-outcome',{label,sessionId:input.sessionId,...result});return result;}
   catch(error){emit('service-failed',{label,sessionId:input.sessionId,...errorFacts(error)});throw error;}
   finally{phases.push({phase:'doe',label,sessionId:input.sessionId,started,ended:performance.now()});}
  },writeGates:{sessionEdit:true,sessionBatchEdit:true}
 });
 return {repo,engine,api,phases,label,control};
 }
 const primary=fixtureApi(runtime,'primary');
 const {repo,engine,api}=primary;
 const get=async id=>{
  const result=await repo.list({sessionId:id,includeAssignmentTargets:true,includeBatchEditToken:true});
  assert.equal(result.length,1);return result[0];
 };
 const edit=async(id,patch)=>({sessionId:id,expectedToken:(await get(id)).batchEditToken,patch});
 const submit=edits=>api.updateExistingSessionBatch('synthetic-token', {edits});
 const count=async()=>Number((await admin.query('SELECT COUNT(*) AS total FROM paws.DoeCalculationRecord WHERE PolicyVersionId=@policy',{policy}))[0].total);
 stage='deny-doe-write';
 const bundle=await engine.loadActivePolicy('2026-27');
 assert.equal(String(bundle.version.policyVersionId).toLowerCase(),policy);
 const permission=(await runtime.query("SELECT IS_ROLEMEMBER('db_owner') AS owner,HAS_PERMS_BY_NAME('paws.DoeCalculationRecord','OBJECT','INSERT') AS doeInsert,HAS_PERMS_BY_NAME('paws.Session','OBJECT','UPDATE') AS sessionUpdate"))[0];
 assert.equal(permission.owner,0);assert.equal(permission.doeInsert,0);assert.equal(permission.sessionUpdate,0);
 assert.equal(await count(),0);
 // The existing API contract confirms a committed timetable even if the
 // post-commit DOE write is denied. A failed calculation must not fake credit.
 const denied=await submit([await edit(ids[0],{topic:'DOE denied A'}),await edit(ids[1],{topic:'DOE denied B'})]);
 assert.equal(denied.status,200);assert.equal(denied.body.sessions.length,2);
 assert.equal(denied.body.doe.length,2);
 assert.ok(denied.body.doe.every(d=>d.status==='needs_review'&&d.issueCodes.includes('DOE_RECALCULATION_FAILED')));
 assert.equal((await get(ids[0])).topic,'DOE denied A');assert.equal((await get(ids[1])).topic,'DOE denied B');
 assert.equal(await count(),0);
 console.log('PR171_DOE_DENIED_PERSISTENCE_AFTER_COMMIT_OK');
 stage='allow-fixture-only-doe-write';
 // Grant only the needed synthetic calculation operations. These do not
 // assert or alter the actual University service identity's permissions.
 await admin.query(`
 GRANT INSERT ON OBJECT::paws.DoeAssignmentFact TO batch171_doe_qa;
 GRANT UPDATE (Category,RoleType,ActivityType,ScopeText,CourseCode,SessionId,CurrentCalculationId,Revision,Active,UpdatedBy,UpdatedAtUtc) ON OBJECT::paws.DoeAssignmentFact TO batch171_doe_qa;
 GRANT INSERT ON OBJECT::paws.DoeCalculationRecord TO batch171_doe_qa;
 GRANT INSERT ON OBJECT::paws.DoeAuditEvent TO batch171_doe_qa;
 `);
 stage='real-postcommit';
 const committed=await submit([
  await edit(ids[0],{startTime:'08:00',endTime:'09:30',topic:'DOE calculated A'}),
  await edit(ids[1],{startTime:'10:00',endTime:'12:00',topic:'DOE calculated B'})
 ]);
 assert.equal(committed.status,200);
 emit('batch-outcomes',{rows:committed.body.sessions.map((row,index)=>({sessionId:row.id,doe:committed.body.doe[index]}))});
 assert.deepEqual(committed.body.doe.map(d=>d.status),['calculated','calculated']);
 assert.deepEqual(committed.body.doe.map(d=>d.issueCodes),[[],[]]);
 assert.deepEqual(committed.body.doe.map(d=>d.calculatedCount),[2,1]);
 stage="real-postcommit-readback";
 const rows=await admin.query(`
 SELECT CONVERT(varchar(36),f.SessionId) AS id,f.Revision AS revision,c.ResultDoe AS result,
 c.CalculationStatus AS status,c.CalculationTrigger AS [calculationTrigger],c.CalculatedBy AS actor,c.FactsSnapshotJson AS facts,
 f.SessionAssignmentId AS assignmentId,f.FacultyId AS facultyId,f.CurrentCalculationId AS calculationId,
 c.SessionId AS calculationSessionId,c.FacultyId AS calculationFacultyId,c.AssignmentId AS calculationAssignmentId,c.SourceEntityId AS calculationSourceId,
 a.SessionId AS canonicalSessionId,a.FacultyId AS canonicalFacultyId
 FROM paws.DoeAssignmentFact f JOIN paws.DoeCalculationRecord c ON c.CalculationId=f.CurrentCalculationId
 JOIN paws.SessionAssignment a ON a.SessionAssignmentId=f.SessionAssignmentId
 WHERE f.Active=1 AND f.SessionId IN (@s1,@s2) AND c.PolicyVersionId=@policy
 ORDER BY f.SessionId,f.FacultyId
 `,{s1:ids[0],s2:ids[1],policy});
 assert.equal(rows.length,3);assert.equal(await count(),3);
 for(const row of rows){
  const first=String(row.id).toLowerCase()===ids[0];
  assert.equal(Number(row.result),first?3:4);
  assert.equal(row.status,'calculated');assert.equal(row.calculationTrigger,'session_batch_edit');assert.equal(row.actor,actor);
  assert.equal(Number(row.revision),1);
  assert.equal(JSON.parse(row.facts).hours,first?1.5:2);
  const same=(a,b)=>assert.equal(String(a).toLowerCase(),String(b).toLowerCase());
  assert.ok(row.assignmentId&&row.facultyId&&row.calculationId);
  same(row.id,row.calculationSessionId);same(row.id,row.canonicalSessionId);
  same(row.facultyId,row.calculationFacultyId);same(row.facultyId,row.canonicalFacultyId);
  same(row.assignmentId,row.calculationAssignmentId);same(row.assignmentId,row.calculationSourceId);
  same(row.id,JSON.parse(row.facts).sessionId);same(row.facultyId,JSON.parse(row.facts).facultyId);same(row.assignmentId,JSON.parse(row.facts).assignmentId);
 }
 assert.equal(rows.filter(row=>String(row.id).toLowerCase()===ids[0]).length,2);
 assert.equal(rows.filter(row=>String(row.id).toLowerCase()===ids[1]).length,1);
 assert.equal(new Set(rows.map(row=>String(row.calculationId).toLowerCase())).size,3);
 emit('readback-verified',{rows:rows.length,calculationIds:rows.map(row=>row.calculationId),revision:1,calculationTrigger:'session_batch_edit'});
 console.log('PR171_DOE_REAL_CALCULATION_AND_PERSISTENCE_OK');
 stage='rejected-batch';
 const before=await count(),firstTopic=(await get(ids[0])).topic,secondTopic=(await get(ids[1])).topic,phaseStart=primary.phases.length;
 const rejected=await submit([await edit(ids[0],{topic:'Must not save'}),await edit(ids[1],{courseCode:'BATCH171_MISSING'})]);
 assert.equal(rejected.status,400);assert.equal((await get(ids[0])).topic,firstTopic);assert.equal((await get(ids[1])).topic,secondTopic);assert.equal(await count(),before);
 assert.equal(primary.phases.slice(phaseStart).filter(x=>x.phase==='doe').length,0);
 console.log('PR171_DOE_REJECTED_BATCH_NO_CALCULATIONS_OK');
 console.log('PR171_DOE_SYNTHETIC_SQL_ACCEPTANCE_OK; production role bindings, annual policy reconciliation and Firebase/browser are not tested');
 stage='http-load';
 peer=connection('batch171_doe_qa',password);
 const secondary=fixtureApi(peer,'secondary');
 await runDoeHttpLoad({load,admin,primary,secondary,sha,policy,rule,actor,sample:ids[0],count,emit,errorFacts,setStage:value=>{stage=value;}});
 console.log('PR171_DOE_FULL_REVIEW_QA_OK');
}
main().catch(error=>{
 console.error('PR171_DOE_QA_FAILED '+JSON.stringify({stage,...errorFacts(error)}));
 if(error?.code==='ERR_ASSERTION')console.error(error.message);
 process.exitCode=1;
}).finally(async()=>{await Promise.allSettled([runtime?.close(),peer?.close(),admin.close()]);});
