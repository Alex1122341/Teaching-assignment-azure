'use strict';
// Called only from the existing guarded, disposable SQL QA harness.
// No production configuration, credentials, or external HTTP endpoints.
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {performance}=require('node:perf_hooks');
const {once}=require('node:events');
const ms=value=>Math.round(value*10)/10;
const key=value=>String(value).toLowerCase();

async function runDoeHttpLoad({load,admin,primary,secondary,sha,policy,rule,actor,sample,count,emit,errorFacts,setStage}){
 assert.equal(process.env.GITHUB_ACTIONS,'true');
 assert.equal(sha,'343f04b06f7360d0b5ee3b1ab0c9d8bda4a6ded8');
 const {createSwaFunctions}=load('src/runtime/swa-functions');
 const {createUniversityHttpServer}=load('src/runtime/university-http-server');
 const servers=[];
 const facultyIds=['33333333-4444-4555-8666-777777777777','44444444-5555-4666-8777-888888888888'];
 const extra=Array.from({length:60},(_,i)=>({
  id:randomUUID(),date:new Date(Date.UTC(2027,0,4+i)).toISOString().slice(0,10),
  topic:'Synthetic load '+String(i+1),row:i+100
 }));
 setStage('load-fixture');
 await admin.query(`
  DECLARE @Batch uniqueidentifier,@Course uniqueidentifier;
  SELECT @Batch=SourceImportBatchId,@Course=CourseId FROM paws.Session WHERE SessionId=@sample AND CourseCode=N'BATCH171';
  IF @Batch IS NULL OR @Course IS NULL THROW 51000,'Synthetic load fixture missing',1;
  DECLARE @items TABLE(id uniqueidentifier NOT NULL PRIMARY KEY,[date] date NOT NULL,topic nvarchar(100),[row] int);
  INSERT @items SELECT id,[date],topic,[row] FROM OPENJSON(@fixture) WITH(id uniqueidentifier '$.id',[date] date '$.date',topic nvarchar(100) '$.topic',[row] int '$.row');
  IF (SELECT COUNT(*) FROM @items)<>60 THROW 51000,'Synthetic load fixture count mismatch',1;
  INSERT paws.Session(SessionId,AcademicYear,CurriculumYear,CourseId,CourseCode,CourseName,Topic,SessionType,SessionDate,StartTime,EndTime,Room,SourceImportBatchId)
  SELECT id,N'2026-27',N'2',@Course,N'BATCH171',N'Synthetic course',topic,N'LEC',[date],'09:00','10:00',N'QA room',@Batch FROM @items;
  INSERT paws.SessionAssignment(SessionAssignmentId,SessionId,FacultyId,FacultyResolutionStatus,TeachingRole,SourceImportBatchId,SourceRow)
  SELECT NEWID(),i.id,faculty.id,N'resolved',N'Lecture',@Batch,i.[row]*2+faculty.slot
  FROM @items i CROSS JOIN (VALUES(@f1,0),(@f2,1)) AS faculty(id,slot);
 `,{sample,fixture:JSON.stringify(extra),f1:facultyIds[0],f2:facultyIds[1]});
 async function endpoint(fixture){
  const server=createUniversityHttpServer({
   runtime:createSwaFunctions({api:fixture.api}),
   host:'127.0.0.1',
   env:{PAWS_API_HOST:'127.0.0.1',PAWS_API_ALLOWED_ORIGINS:'https://qa.example.test',
        PAWS_RELEASE_SHA:sha,PAWS_RUNTIME_TRUST_ANCHOR:'54a8e23cc88b628eb5cf3234c29388b7f800dfb9',
        PAWS_SESSION_EDIT_WRITE_ENABLED:'true',PAWS_SESSION_BATCH_EDIT_ENABLED:'true'},
   logger:{error:()=>emit('http-adapter-failed',{label:fixture.label})}
  });
  servers.push(server);server.listen(0,'127.0.0.1');await once(server,'listening');
  assert.equal(server.address().address,'127.0.0.1');
  return 'http://127.0.0.1:'+server.address().port+'/api/v1/sessions/batch-edit';
 }
 async function prepare(fixture,items){
  const edits=[];
  for(const item of items){
   const snapshot=(await fixture.repo.list({sessionId:item.id,includeAssignmentTargets:true,includeBatchEditToken:true}))[0];
   assert.match(snapshot?.batchEditToken||'',/^[A-F0-9]{64}$/);
   edits.push({sessionId:item.id,expectedToken:snapshot.batchEditToken,patch:{startTime:'09:00',endTime:'10:30',topic:item.topic+' edited'}});
  }
  return edits;
 }
 async function request(fixture,url,edits){
  const phaseStart=fixture.phases.length,started=performance.now();
  try{
   const response=await fetch(url,{method:'POST',headers:{authorization:'Bearer synthetic-token','content-type':'application/json',origin:'https://qa.example.test'},body:JSON.stringify({edits}),signal:AbortSignal.timeout(180000)});
   const body=await response.json(),ended=performance.now();
   const phases=fixture.phases.slice(phaseStart);
   const outcome={label:fixture.label,status:response.status,elapsedMs:ms(ended-started),requested:edits.length,
    saved:body.sessions?.length??0,errorCode:body.error?.code??null,
    timetableMs:ms(phases.filter(x=>x.phase==='timetable').reduce((sum,x)=>sum+x.ended-x.started,0)),
    doeMs:ms(phases.filter(x=>x.phase==='doe').reduce((sum,x)=>sum+x.ended-x.started,0)),
    rows:(body.sessions||[]).map((row,index)=>({id:row.id,status:body.doe?.[index]?.status??null,issueCodes:body.doe?.[index]?.issueCodes??[],calculatedCount:body.doe?.[index]?.calculatedCount??0}))};
   emit('http-batch-result',outcome);return {body,outcome,phases};
  }catch(error){emit('http-batch-failed',{label:fixture.label,elapsedMs:ms(performance.now()-started),...errorFacts(error)});throw error;}
 }
 function verifyHttp(result,items){
  const {body,outcome}=result;
  assert.equal(outcome.status,200);assert.equal(outcome.requested,items.length);
  assert.equal(body.sessions.length,items.length);assert.equal(body.doe.length,items.length);
  assert.deepEqual(body.sessions.map(row=>key(row.id)).sort(),items.map(row=>row.id).sort());
  for(const row of body.doe){assert.equal(row.status,'calculated');assert.deepEqual(row.issueCodes,[]);assert.equal(row.calculatedCount,2);}
 }
 async function readCurrent(items){
  return admin.query(`
   SELECT CONVERT(varchar(36),f.SessionId) AS [id],f.Revision AS [revision],c.ResultDoe AS [result],
   c.CalculationStatus AS [status],c.CalculationTrigger AS [calculationTrigger],c.CalculatedBy AS [actor],
   c.FactsSnapshotJson AS [facts],f.CurrentCalculationId AS [calculationId],f.SessionAssignmentId AS [assignmentId],
   f.FacultyId AS [facultyId],c.SessionId AS [calculationSessionId],c.FacultyId AS [calculationFacultyId],
   c.AssignmentId AS [calculationAssignmentId],c.SourceEntityId AS [calculationSourceId],
   a.SessionId AS [canonicalSessionId],a.FacultyId AS [canonicalFacultyId],c.RuleId AS [ruleId],c.RuleKey AS [ruleKey]
   FROM paws.DoeAssignmentFact f
   JOIN paws.DoeCalculationRecord c ON c.CalculationId=f.CurrentCalculationId
   JOIN paws.SessionAssignment a ON a.SessionAssignmentId=f.SessionAssignmentId
   WHERE f.Active=1 AND f.SessionId IN (SELECT TRY_CONVERT(uniqueidentifier,[value]) FROM OPENJSON(@sessionIds))
     AND c.PolicyVersionId=@policy
   ORDER BY f.SessionId,f.FacultyId
  `,{sessionIds:JSON.stringify(items.map(x=>x.id)),policy});
 }
 async function verifyReadback(items){
  const read=await readCurrent(items),counts=new Map(),pairs=new Set();
  for(const row of read){
   const id=key(row.id);counts.set(id,(counts.get(id)||0)+1);
   assert.ok(row.calculationId&&row.assignmentId&&row.facultyId);
   assert.equal(key(row.calculationSessionId),id);assert.equal(key(row.canonicalSessionId),id);
   assert.equal(key(row.calculationFacultyId),key(row.facultyId));assert.equal(key(row.canonicalFacultyId),key(row.facultyId));
   assert.equal(key(row.calculationAssignmentId),key(row.assignmentId));assert.equal(key(row.calculationSourceId),key(row.assignmentId));
   assert.equal(key(row.ruleId),rule);assert.equal(row.ruleKey,'synthetic_lecture');
   assert.equal(Number(row.result),3);assert.equal(row.status,'calculated');
   assert.equal(row.calculationTrigger,'session_batch_edit');assert.equal(row.actor,actor);
   assert.equal(Number(row.revision),1);
   const facts=JSON.parse(row.facts);
   assert.equal(facts.hours,1.5);assert.equal(key(facts.sessionId),id);
   assert.equal(key(facts.facultyId),key(row.facultyId));assert.equal(key(facts.assignmentId),key(row.assignmentId));
   assert.ok(facultyIds.includes(key(row.facultyId)));
   pairs.add(id+':'+key(row.facultyId));
  }
  emit('load-readback',{sessions:items.length,records:read.length,distinctSessions:counts.size,distinctCalculations:new Set(read.map(x=>key(x.calculationId))).size});
  assert.equal(read.length,items.length*2);assert.equal(counts.size,items.length);
  assert.equal(new Set(read.map(x=>key(x.calculationId))).size,items.length*2);assert.equal(pairs.size,items.length*2);
  for(const item of items)assert.equal(counts.get(item.id),2);
  const audit=await admin.query(`
   SELECT a.Action AS [action],a.ActorUid AS [actor],a.AfterJson AS [afterJson],f.CurrentCalculationId AS [calculationId],f.SessionId AS [sessionId]
   FROM paws.DoeAuditEvent a JOIN paws.DoeAssignmentFact f ON TRY_CONVERT(uniqueidentifier,a.EntityId)=f.AssignmentFactId
   WHERE a.PolicyVersionId=@policy AND a.EntityType=N'doe_assignment'
     AND f.SessionId IN (SELECT TRY_CONVERT(uniqueidentifier,[value]) FROM OPENJSON(@sessionIds))
  `,{sessionIds:JSON.stringify(items.map(x=>x.id)),policy});
  assert.equal(audit.length,items.length*2);
  for(const row of audit){
   assert.equal(row.action,'doe_assignment_created');assert.equal(row.actor,actor);
   const after=JSON.parse(row.afterJson);
   assert.equal(key(after.sessionId),key(row.sessionId));assert.equal(key(after.calculationId),key(row.calculationId));
   assert.equal(after.calculationStatus,'calculated');assert.equal(after.calculationTrigger,'session_batch_edit');
  }
  const persisted=await admin.query("SELECT CONVERT(varchar(36),SessionId) AS [id],Topic AS [topic],CONVERT(char(8),EndTime,108) AS [endTime] FROM paws.Session WHERE SessionId IN (SELECT TRY_CONVERT(uniqueidentifier,[value]) FROM OPENJSON(@sessionIds))",{sessionIds:JSON.stringify(items.map(x=>x.id))});
  assert.equal(persisted.length,items.length);
  for(const row of persisted){const item=items.find(x=>x.id===key(row.id));assert.equal(row.topic,item.topic+' edited');assert.equal(row.endTime,'10:30:00');}
 }
 try{
  const first=extra.slice(0,20),left=extra.slice(20,40),right=extra.slice(40,60);
  const url=await endpoint(primary),peerUrl=await endpoint(secondary);
  setStage('max20-http');
  const beforeMax=await count(),full=await request(primary,url,await prepare(primary,first));
  verifyHttp(full,first);await verifyReadback(first);assert.equal(await count(),beforeMax+40);
  console.log('PR171_DOE_MAX20_HTTP_OK '+JSON.stringify({elapsedMs:full.outcome.elapsedMs,timetableMs:full.outcome.timetableMs,doeMs:full.outcome.doeMs,sessions:20,calculations:40}));
  setStage('concurrent-http');
  const leftEdits=await prepare(primary,left),rightEdits=await prepare(secondary,right);
  const beforeConcurrent=await count(),started=performance.now();
  // Overlap two independent HTTP requests specifically in their post-commit
  // DOE phases. The first has already committed before the second starts.
  // Both real timetable transactions still execute; no repository writes
  // are replaced. This avoids conflating pre-commit deadlock with DOE lock
  // contention. No QA retries; bounded latch and actual phase overlap required.
  let firstReached,release;
  const firstAtDoe=new Promise(resolve=>{firstReached=resolve;});
  const bothAtDoe=new Promise(resolve=>{release=resolve;});
  const latchTimer=setTimeout(()=>{firstReached(false);release();},60000);
  primary.control.beforeDoe=async()=>{primary.control.beforeDoe=null;firstReached(true);await bothAtDoe;};
  secondary.control.beforeDoe=async()=>{secondary.control.beforeDoe=null;release();};
  const leftRequest=request(primary,url,leftEdits);
  leftRequest.then(()=>firstReached(false),()=>firstReached(false));
  const aligned=await firstAtDoe;
  const rightRequest=request(secondary,peerUrl,rightEdits);
  rightRequest.then(release,release);
  const results=await Promise.allSettled([leftRequest,rightRequest]);
  clearTimeout(latchTimer);
  primary.control.beforeDoe=null;secondary.control.beforeDoe=null;
  const bothElapsed=ms(performance.now()-started);
  const successful=results.filter(x=>x.status==='fulfilled').map(x=>x.value);
  const observedDoeOverlap=successful.length===2&&successful[0].phases.filter(x=>x.phase==='doe').some(a=>successful[1].phases.some(b=>b.phase==='doe'&&a.started<b.ended&&b.started<a.ended));
  const persisted=await readCurrent([...left,...right]);
  emit('concurrent-summary',{elapsedMs:bothElapsed,alignedAfterCommit:aligned,observedDoeOverlap,results:results.map(x=>x.status==='fulfilled'?x.value.outcome:{status:'rejected',...errorFacts(x.reason)}),persistedRecords:persisted.length,newCalculations:(await count())-beforeConcurrent,calculatedRecords:persisted.filter(x=>x.status==='calculated').length,needsReviewRecords:persisted.filter(x=>x.status==='needs_review').length});
  assert.equal(results[0].status,'fulfilled');assert.equal(results[1].status,'fulfilled');
  verifyHttp(results[0].value,left);verifyHttp(results[1].value,right);
  assert.equal(aligned,true,'First request must commit before the second starts.');
  assert.equal(observedDoeOverlap,true,'Cross-batch DOE phases must overlap to accept concurrent DOE coverage.');
  await verifyReadback([...left,...right]);assert.equal(await count(),beforeConcurrent+80);
  console.log('PR171_DOE_CONCURRENT_HTTP_OK '+JSON.stringify({elapsedMs:bothElapsed,sessions:40,calculations:80,observedDoeOverlap}));
 }finally{
  await Promise.allSettled(servers.map(server=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections?.();})));
 }
}
module.exports={runDoeHttpLoad};
