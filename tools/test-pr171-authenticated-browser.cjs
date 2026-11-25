'use strict';
// Ephemeral end-to-end acceptance only. No production identity, network,
// SQL server configuration, or private University source data.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {once}=require('node:events');
const {execFileSync}=require('node:child_process');
const {randomUUID,randomBytes}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const originalSha='343f04b06f7360d0b5ee3b1ab0c9d8bda4a6ded8';
const sha='b318b33627c42cef342e130046edd88e73365c07';
const baselineRoot=process.env.PAWS_BASELINE_ROOT;
const project='demo-paws-pr171';
const marker=process.env.PAWS_BROWSER_TEST_MARKER;
const sa=process.env.PAWS_SQL_TEST_PASSWORD;
const out=process.env.PAWS_BROWSER_EVIDENCE;
const tooling=process.env.PAWS_BROWSER_TOOLS;
assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:9099');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8080');
assert.equal(process.env.GCLOUD_PROJECT,project);
assert.match(marker||'',/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i);
assert.ok(sa&&out&&tooling);
assert.equal(process.env.PRODUCT_SHA,sha);
assert.equal(process.env.ORIGINAL_PRODUCT_SHA,originalSha);
assert.ok(baselineRoot&&path.isAbsolute(baselineRoot)&&baselineRoot!==root);
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:baselineRoot,encoding:'utf8'}).trim(),originalSha);
assert.equal(execFileSync('git',['merge-base','--is-ancestor',sha,'HEAD'],{cwd:root}).length,0);
const container=JSON.parse(execFileSync('docker',['inspect','paws-calendar-pr171-browser'],{encoding:'utf8'}))[0];
assert.equal(container.Config.Labels['paws.calendar-test'],'1');
assert.equal(container.State.Running,true);
assert.deepEqual(container.NetworkSettings.Ports['1433/tcp'],[{HostIp:'127.0.0.1',HostPort:'14339'}]);
const sql=require('../server/node_modules/mssql');
const admin=require('../server/node_modules/firebase-admin');
const {createSqlConnection}=require('../server/src/data/sql-connection');
const {createSqlUserRepository}=require('../server/src/data/sql-user-repository');
const {createSqlAccountAccessRepository}=require('../server/src/data/sql-account-access-repository');
const {createSqlTeachingAccessRepository}=require('../server/src/data/sql-teaching-access-repository');
const {createEffectiveTeachingIdentity}=require('../server/src/access/effective-teaching-identity');
const {calgaryDate}=require('../server/src/roles/role-effective-status');
const {createSwaSqlRuntime}=require('../server/src/runtime/swa-sql-runtime');
const {createUniversityHttpServer}=require('../server/src/runtime/university-http-server');
const {chromium}=require(path.join(tooling,'playwright'));
const {runAnnualReference}=require('./test-pr171-annual-reference.cjs');
const db=createSqlConnection({sql,config:{server:'127.0.0.1',port:14339,database:'VetMed-Ops',user:'sa',password:sa,options:{encrypt:true,trustServerCertificate:true}}});
const roles=['developer','adfa_general','adfa_regular','faculty','faculty','hicc','visc','adc','lab'];
const scoped=new Set(['faculty','hicc','visc']);
const admins=new Set(['developer','adfa_general','adfa_regular']);
const identities=roles.map((role,i)=>({role,uid:'pr171-qa-'+i,email:'paws-pr171-synthetic-'+i+'@ucalgary.ca',facultyId:scoped.has(role)?randomUUID():null,sessionId:scoped.has(role)?randomUUID():null}));
const password=randomBytes(24).toString('hex')+'!Aa1';
const runtimePassword=randomBytes(24).toString('hex')+'!Aa1';
const servers=[];
const receipt={product:sha,originalProduct:originalSha,frozenAnchor:originalSha,qa:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),project,environment:'ephemeral runner; synthetic data and emulator auth',roles:[],failures:[],limits:['No University Staging or live identity','SDK configuration and API origin adapted in QA response only','HICC/VISC base-role checks do not establish appointment/package scope','Mobile is a Chromium viewport, not a physical device','Four generic annual rule previews only; complete annual reconciliation is not covered']};
let stage='marker',browser,runtime;
// Only fixed endpoint labels, request methods, status codes and sanitized
// error identifiers leave the test. No bodies, URLs/queries, raw exceptions,
// authorization header values, email/password fields, tokens or storage dumps.
const safeCode=value=>typeof value==='string'&&/^(?:auth\/[a-z][a-z0-9-]{1,70}|[A-Z][A-Z0-9_]{1,70}|net::ERR_[A-Z0-9_]{1,50})$/.test(value)?value:null;
const safeName=value=>['Error','TypeError','ReferenceError','TimeoutError','AssertionError','FirebaseError','RequestError','ConnectionError'].includes(value)?value:'Error';
const fail=error=>({stage,name:safeName(error?.name),code:safeCode(error?.code),number:Number.isInteger(error?.number??error?.originalError?.info?.number)?(error.number??error.originalError.info.number):null});
const apiLabels=new Map([
 ['/api/v1/me','me'],['/api/v1/access/self','access-self'],
 ['/api/v1/afc-requests/write-capabilities','write-capabilities'],
 ['/api/v1/sessions','sessions'],['/api/v1/sessions/batch-edit','batch-edit']
]);
function endpointLabel(url){
 const u=new URL(url);
 if(u.pathname.startsWith('/api/'))return apiLabels.get(u.pathname)||'other-api';
 if(u.origin==='http://127.0.0.1:9099'){
  if(u.pathname.endsWith('/accounts:signInWithPassword'))return 'firebase-password';
  if(u.pathname.endsWith('/accounts:lookup'))return 'firebase-lookup';
  if(u.pathname.endsWith('/token'))return 'firebase-token';
  return 'firebase-other';
 }
 return null;
}
function traceEvent(trace,event,details={}){
 if(!trace||trace.length>=240)return;
 const entry={event,ms:Date.now()-trace.startedAt,...details};
 trace.push(entry);
 console.log('BROWSER_QA_LOGIN_TRACE '+JSON.stringify(entry));
}
async function responseCode(response){
 if(response.status()<400)return null;
 try{
  const body=await response.json();
  return safeCode(body?.error?.code)||safeCode(body?.error?.message);
 }catch(_){return null;}
}
async function waitTrace(predicate,timeout=20000){
 const until=Date.now()+timeout;
 while(Date.now()<until){const value=predicate();if(value)return value;await new Promise(resolve=>setTimeout(resolve,75));}
 throw Object.assign(Error('Diagnostic event not observed'),{code:'QA_EVENT_TIMEOUT'});
}
async function browserState(page){
 return page.evaluate(()=>{
  const observed=window.__pawsQaLoginTrace||{};
  const user=window.firebase?.apps?.length?firebase.auth().currentUser:null;
  const gate=document.getElementById('gate-status');
  const status=(gate?.textContent||'').toLowerCase();
  const category=status.includes('sign in required')?'signed-out':status.includes('checking')?'checking':status.includes('still connecting')?'retrying':status.includes('denied')?'denied':status.includes('password change')?'password-change':status.includes('could not')?'unverified':status.includes('temporarily unavailable')?'unavailable':'other';
  return {formSubmits:observed.formSubmits||0,sessionEstablished:!!user,profileEvents:observed.profileEvents||0,invalidated:observed.invalidated||null,
   gateLocked:document.body?.classList.contains('auth-locked')===true,gateCategory:category,accountControlPresent:!!document.getElementById('account-toggle'),
   sessionGuardBlocked:window.__ucvmSessionGuard?.blocked===true,loginSubmitDisabled:document.getElementById('email-login-submit')?.disabled===true};
 }).catch(()=>({stateUnavailable:true}));
}
async function listen(server){servers.push(server);server.listen(0,'127.0.0.1');await once(server,'listening');assert.equal(server.address().address,'127.0.0.1');return 'http://127.0.0.1:'+server.address().port;}
const origin='https://paws-pr171-qa.invalid';
async function main(){
 const mark=await db.query('SELECT CONVERT(varchar(36),Marker) AS marker FROM dbo.PawsBrowserDisposableMarker WHERE Marker=@marker',{marker});
 assert.equal(mark.length,1);assert.equal(mark[0].marker.toLowerCase(),marker.toLowerCase());
 stage='synthetic-principals';
 // Actual SQL login, not dbo. Existing runtime roles, plus the same narrowly
 // scoped fixture-only reads/exec used in the accepted batch SQL harness.
 await db.query("CREATE LOGIN paws_browser_qa WITH PASSWORD='"+runtimePassword+"';");
 await db.query(`
 CREATE USER paws_browser_qa FOR LOGIN paws_browser_qa;
 ALTER ROLE paws_runtime_read ADD MEMBER paws_browser_qa;
 ALTER ROLE paws_runtime_calendar_read ADD MEMBER paws_browser_qa;
 ALTER ROLE paws_runtime_swap_read ADD MEMBER paws_browser_qa;
 ALTER ROLE paws_runtime_history_read ADD MEMBER paws_browser_qa;
 ALTER ROLE paws_runtime_trainee_read ADD MEMBER paws_browser_qa;
 ALTER ROLE paws_runtime_account_access ADD MEMBER paws_browser_qa;
 ALTER ROLE paws_runtime_session_edit_write ADD MEMBER paws_browser_qa;
 GRANT SELECT ON OBJECT::paws.SessionAssignment(SourceFacultyName) TO paws_browser_qa;
 GRANT EXECUTE ON OBJECT::paws_api.ReplaceCalendarSessionAssignments TO paws_browser_qa;
 `);
 const runtimeProbe=createSqlConnection({sql,config:{server:'127.0.0.1',port:14339,database:'VetMed-Ops',user:'paws_browser_qa',password:runtimePassword,options:{encrypt:true,trustServerCertificate:true}}});
 try{
  const [p]=await runtimeProbe.query("SELECT IS_ROLEMEMBER('db_owner') AS [owner], HAS_PERMS_BY_NAME('paws.Session','OBJECT','UPDATE') AS directUpdate,HAS_PERMS_BY_NAME('paws.SessionAssignment','OBJECT','DELETE') AS directDelete");
  assert.equal(p.owner,0);assert.equal(p.directUpdate,0);assert.equal(p.directDelete,0);
 }finally{await runtimeProbe.close();}
 const authApp=admin.initializeApp({projectId:project},'paws-browser-fixture');
 const auth=admin.auth(authApp);
 const batch=randomUUID(),course=randomUUID();
 stage='synthetic-data';
 await db.query(`
 INSERT staging.ImportBatch(ImportBatchId,StartedAtUtc,Status,SourceManifestSha256,ImporterVersion,ValidationSummaryJson)
 VALUES(@batch,SYSUTCDATETIME(),N'synthetic',REPLICATE('B',64),N'pr171-browser',N'{}');
 INSERT paws.Course(CourseId,CourseCode,CourseName,SourceImportBatchId) VALUES(@course,N'BROWSER171',N'Synthetic Browser QA',@batch);
 `,{batch,course});
 for(const [i,user] of identities.entries()){
  await auth.createUser({uid:user.uid,email:user.email,password,displayName:'Synthetic QA '+i,emailVerified:true});
  if(user.facultyId){
   await db.query(`
    INSERT paws.Faculty(FacultyId,RecordType,DisplayName,Active,SourceImportBatchId)
    VALUES(@facultyId,N'faculty',@name,1,@batch);
    INSERT paws.Session(SessionId,AcademicYear,CurriculumYear,CourseId,CourseCode,CourseName,Topic,SessionType,SessionDate,StartTime,EndTime,Room,SourceImportBatchId)
    VALUES(@sessionId,N'2026-27',N'2',@course,N'BROWSER171',N'Synthetic Browser QA',@topic,N'LEC','2026-11-25','09:00','10:00',N'QA room',@batch);
    INSERT paws.SessionAssignment(SessionAssignmentId,SessionId,FacultyId,FacultyResolutionStatus,TeachingRole,SourceImportBatchId,SourceRow)
    VALUES(NEWID(),@sessionId,@facultyId,N'resolved',N'Lecture',@batch,@sourceRow);
   `,{batch,course,facultyId:user.facultyId,sessionId:user.sessionId,name:'Synthetic Faculty '+i,topic:'Synthetic session '+i,sourceRow:i+1});
  }
  await db.query(`
   INSERT paws.UserProfile(FirebaseUid,Email,DisplayName,BaseRole,FacultyId,Active,MustChangePassword)
   VALUES(@uid,@email,@name,@role,@facultyId,1,0);
  `,{uid:user.uid,email:user.email,name:'Synthetic QA '+i,role:user.role,facultyId:user.facultyId});
 }
 stage='annual-generic-reference';
 try{receipt.annualReference=await runAnnualReference(db);}
 catch(error){receipt.annualReference={status:'failed',...fail(error)};receipt.failures.push(receipt.annualReference);console.error('ANNUAL_REFERENCE_FAILED '+JSON.stringify(receipt.annualReference));}
 // The stage-only service has no production environment inheritance.
 stage='api-start';
 const env={FIREBASE_PROJECT_ID:project,
  PAWS_SQL_DRIVER:'tedious',
  PAWS_SQL_CONNECTION_STRING:'Server=127.0.0.1,14339;Database=VetMed-Ops;User Id=paws_browser_qa;Password='+runtimePassword+';Encrypt=true;TrustServerCertificate=true',
  PAWS_RELEASE_SHA:receipt.qa,PAWS_RUNTIME_TRUST_ANCHOR:originalSha,PAWS_API_HOST:'127.0.0.1',
  PAWS_SESSION_EDIT_WRITE_ENABLED:'true',PAWS_SESSION_BATCH_EDIT_ENABLED:'true'};
 // Diagnostic only: identical driver, connection string and least-privilege
 // login to the actual API. No SQL grants, migration changes, admin fallback,
 // account changes, or substitution of the production identity reader.
 stage='sql-access-preflight';
 const accessDiagnostics={probes:[]};receipt.sqlAccessDiagnostics=accessDiagnostics;
 const diagnosticDb=createSqlConnection({sql,driver:env.PAWS_SQL_DRIVER,connectionString:env.PAWS_SQL_CONNECTION_STRING});
 const record=entry=>{
  accessDiagnostics.probes.push(entry);
  console.log('BROWSER_QA_SQL_ACCESS '+JSON.stringify(entry));
 };
 const sqlError=error=>{
  // Error numbers plus an allowlisted column classification. Do not emit
  // the message, SQL statement, row values, login/password or connection URI.
  const numbers=[error?.number,error?.originalError?.info?.number,...(error?.precedingErrors||[]).map(e=>e?.number??e?.originalError?.info?.number)].filter(Number.isInteger);
  const messages=[error?.message,...(error?.precedingErrors||[]).map(e=>e?.message)].filter(x=>typeof x==='string');
  const columnLabels=['Email','FirebaseUid','BaseRole','DisplayName','FacultyId','Active','MustChangePassword','AccessVersion','ActivationDate','PreferredFirstName','PreferredLastName'];
  return {name:safeName(error?.name),code:safeCode(error?.code),numbers:[...new Set(numbers)],columns:columnLabels.filter(column=>messages.some(message=>message.includes("'"+column+"'")||message.includes('"'+column+'"')))};
 };
 async function probe(phase,run,shape=value=>value){
  try{
   const value=await run();
   const facts=shape(value);
   record({phase,status:'passed',facts});
   return value;
  }catch(error){
   const failure={phase,status:'failed',...sqlError(error)};
   record(failure);receipt.failures.push({stage:'sql-access-preflight:'+phase,name:failure.name,code:failure.code,numbers:failure.numbers});
   return null;
  }
 }
 async function expectEmailDenied(phase,run){
  return probe(phase,async()=>{
   let denied;
   try{await run();}catch(error){denied=sqlError(error);}
   assert.ok(denied,'Email must remain unreadable to the same QA identity');
   assert.ok(denied.numbers.includes(230));assert.ok(denied.columns.includes('Email'));
   return {expectedDenial:true,...denied};
  });
 }
 try{
  const uid=identities[0].uid,facultyUid=identities.find(u=>u.role==='faculty').uid;
  const asOfDate=calgaryDate(new Date()),year=Number(asOfDate.slice(0,4))-(asOfDate.slice(5,10)<'05-01'?1:0);
  const context={academicYear:String(year)+'-'+String((year+1)%100).padStart(2,'0'),asOfDate};
  const loginFacts=await probe('runtime-identity',async()=>{
   const [row]=await diagnosticDb.query(`
    SELECT CASE WHEN ORIGINAL_LOGIN()=N'paws_browser_qa' AND USER_NAME()=N'paws_browser_qa' THEN 1 ELSE 0 END AS expectedIdentity,
      CASE WHEN DB_NAME()=N'VetMed-Ops' THEN 1 ELSE 0 END AS expectedDatabase,
      IS_ROLEMEMBER(N'db_owner') AS dbOwner,IS_SRVROLEMEMBER(N'sysadmin') AS sysAdmin,
      IS_ROLEMEMBER(N'paws_runtime_read') AS baseRead,IS_ROLEMEMBER(N'paws_runtime_account_access') AS accountAccess,
      HAS_PERMS_BY_NAME(N'paws.UserProfile',N'OBJECT',N'UPDATE') AS directUpdate
   `);
   assert.equal(row.expectedIdentity,1);assert.equal(row.expectedDatabase,1);assert.equal(row.dbOwner,0);assert.equal(row.sysAdmin,0);
   assert.equal(row.baseRead,1);assert.equal(row.accountAccess,1);assert.equal(row.directUpdate,0);
   return row;
  });
  // A failed identity guard must never be followed by any access probe.
  if(!loginFacts)throw Object.assign(Error('QA runtime identity was not verified'),{code:'QA_RUNTIME_IDENTITY_UNVERIFIED'});
  await probe('schema-060-061-065',async()=>{
   // This metadata-only query uses the already marker-verified fixture
   // administrator; all actual business reads below use diagnosticDb.
   const [row]=await db.query(`
    SELECT CASE WHEN COL_LENGTH(N'paws.UserProfile',N'AccessVersion') IS NOT NULL THEN 1 ELSE 0 END AS accessVersionPresent,
     CASE WHEN COL_LENGTH(N'paws.Faculty',N'ActivationDate') IS NOT NULL THEN 1 ELSE 0 END AS activationDatePresent,
     CASE WHEN OBJECT_ID(N'paws_api.TeachingAuthorityState') IS NOT NULL THEN 1 ELSE 0 END AS authorityFunctionPresent,
     CASE WHEN OBJECT_ID(N'paws_api.EffectiveTeachingAssignments') IS NOT NULL THEN 1 ELSE 0 END AS assignmentsFunctionPresent,
     (SELECT COUNT(*) FROM paws.LeadershipAccessState WHERE SingletonId=1) AS authoritySingletonCount
   `);
   assert.deepEqual(row,{accessVersionPresent:1,activationDatePresent:1,authorityFunctionPresent:1,assignmentsFunctionPresent:1,authoritySingletonCount:1});
   return row;
  });
  await probe('reviewed-column-permissions',async()=>{
   // Only these enumerated contract fields and the two TVFs are inspected.
   // A 0 or NULL is evidence, not authorization to issue a GRANT.
   const [row]=await diagnosticDb.query(`
    SELECT HAS_PERMS_BY_NAME(N'paws.UserProfile',N'OBJECT',N'SELECT',N'FirebaseUid',N'COLUMN') AS firebaseUid,
     HAS_PERMS_BY_NAME(N'paws.UserProfile',N'OBJECT',N'SELECT',N'Email',N'COLUMN') AS profileEmail,
     HAS_PERMS_BY_NAME(N'paws.UserProfile',N'OBJECT',N'SELECT',N'AccessVersion',N'COLUMN') AS accessVersion,
     HAS_PERMS_BY_NAME(N'paws.Faculty',N'OBJECT',N'SELECT',N'PreferredFirstName',N'COLUMN') AS preferredFirstName,
     HAS_PERMS_BY_NAME(N'paws.Faculty',N'OBJECT',N'SELECT',N'PreferredLastName',N'COLUMN') AS preferredLastName,
     HAS_PERMS_BY_NAME(N'paws.Faculty',N'OBJECT',N'SELECT',N'ActivationDate',N'COLUMN') AS activationDate,
     HAS_PERMS_BY_NAME(N'paws_api.TeachingAuthorityState',N'OBJECT',N'SELECT') AS authorityFunction,
     HAS_PERMS_BY_NAME(N'paws_api.EffectiveTeachingAssignments',N'OBJECT',N'SELECT') AS assignmentsFunction
   `);
   assert.ok(row);
   assert.deepEqual(row,{firebaseUid:1,profileEmail:0,accessVersion:1,preferredFirstName:1,preferredLastName:1,activationDate:1,authorityFunction:1,assignmentsFunction:1});
   return row;
  });
  await probe('profile-seed-exists',async()=>{
   const rows=await diagnosticDb.query('SELECT FirebaseUid AS uid,BaseRole AS role,Active AS active,MustChangePassword AS mustChangePassword FROM paws.UserProfile WHERE FirebaseUid=@uid',{uid});
   assert.equal(rows.length,1);assert.equal(rows[0].uid,uid);assert.equal(rows[0].role,'developer');assert.equal(rows[0].active,true);assert.equal(rows[0].mustChangePassword,false);
   return {rowCount:rows.length,expectedRole:true,active:true,passwordChangeRequired:false};
  });
  // The original diagnostic sought a readable Email column and reproduced
  // SQL 230. It is now a mandatory negative security assertion, not a grant.
  await expectEmailDenied('profile-email-column-stays-denied',()=>diagnosticDb.query('SELECT Email FROM paws.UserProfile WHERE FirebaseUid=@uid',{uid}));
  const original=file=>require(path.join(baselineRoot,'server','src',file));
  const oldUsers=original('data/sql-user-repository').createSqlUserRepository(diagnosticDb);
  const oldAccounts=original('data/sql-account-access-repository').createSqlAccountAccessRepository(diagnosticDb);
  const oldTeaching=original('data/sql-teaching-access-repository').createSqlTeachingAccessRepository(diagnosticDb);
  const oldEffective=original('access/effective-teaching-identity').createEffectiveTeachingIdentity({readProfile:oldAccounts.read,repository:oldTeaching});
  await expectEmailDenied('original-user-repository-developer',()=>oldUsers.findByUid(uid));
  await expectEmailDenied('original-account-repository-developer',()=>oldAccounts.read(uid));
  await expectEmailDenied('original-account-repository-faculty',()=>oldAccounts.read(facultyUid));
  await expectEmailDenied('original-effective-identity-developer',()=>oldEffective(uid));
  await expectEmailDenied('original-effective-identity-faculty',()=>oldEffective(facultyUid));
  await probe('calgary-timezone',async()=>{
   const rows=await diagnosticDb.query("SELECT CONVERT(date,SYSDATETIMEOFFSET() AT TIME ZONE 'Mountain Standard Time') AS localDate");
   assert.equal(rows.length,1);assert.ok(rows[0].localDate);
   return {rowCount:rows.length};
  });
  const users=createSqlUserRepository(diagnosticDb);
  const accounts=createSqlAccountAccessRepository(diagnosticDb);
  const teaching=createSqlTeachingAccessRepository(diagnosticDb);
  const effective=createEffectiveTeachingIdentity({readProfile:accounts.read,repository:teaching});
  const profileShape=profile=>({present:!!profile,role:profile?.baseRole||null,active:profile?.active===true,versionPresent:/^[0-9a-f]{16}$/i.test(profile?.version||''),emailPresent:Object.hasOwn(profile||{},'email')});
  const checkProfile=(profile,userId,role,versionRequired)=>{
   assert.ok(profile);assert.equal(profile.firebaseUid,userId);assert.equal(profile.baseRole,role);assert.equal(profile.active,true);
   if(versionRequired)assert.match(profile.version,/^[0-9a-f]{16}$/i);
   assert.equal(Object.hasOwn(profile,'email'),false);
   return profile;
  };
  await probe('sql-user-repository-developer',async()=>checkProfile(await users.findByUid(uid),uid,'developer',false),profileShape);
  await probe('sql-account-repository-developer',async()=>checkProfile(await accounts.read(uid),uid,'developer',true),profileShape);
  await probe('sql-account-repository-faculty',async()=>checkProfile(await accounts.read(facultyUid),facultyUid,'faculty',true),profileShape);
  await probe('teaching-authority-state',async()=>{
   const rows=await diagnosticDb.query('SELECT authorityVersion FROM paws_api.TeachingAuthorityState()');
   assert.equal(rows.length,1);assert.match(rows[0].authorityVersion,/^[0-9a-f]{16}$/i);
   return {rowCount:rows.length,versionValid:true};
  });
  await probe('teaching-assignments-faculty',async()=>{
   const rows=await teaching.listAssignments(facultyUid,context);
   assert.equal(rows.length,0);return {rowCount:rows.length};
  });
  await probe('teaching-snapshot-faculty',async()=>{
   const snapshot=await teaching.snapshot(facultyUid,context);
   assert.match(snapshot.authorityVersion,/^[0-9a-f]{16}$/i);assert.equal(snapshot.assignments.length,0);
   return {versionValid:true,assignmentCount:snapshot.assignments.length};
  });
  await expectEmailDenied('owner-directory-existing-contact-read-stays-denied',()=>accounts.list());
  for(const [userId,role] of [[uid,'developer'],[facultyUid,'faculty']]){
   await probe('effective-identity-'+role,async()=>{
    const profile=checkProfile(await effective(userId),userId,role,true);
    assert.ok(profile.teachingAccess.effectiveRoles.includes(role));
    return {role,active:profile.active,effectiveRolePresent:true,scopeVersionPresent:!!profile.teachingAccess.scopeVersion};
   });
  }
 }finally{await diagnosticDb.close();}
 accessDiagnostics.failedCount=accessDiagnostics.probes.filter(p=>p.status==='failed').length;
 const denialCount=accessDiagnostics.probes.filter(p=>p.status==='passed'&&p.facts?.expectedDenial===true).length;
 accessDiagnostics.expectedEmailDenials=denialCount;
 assert.equal(denialCount,7);
 receipt.releaseBlockers=['Owner directory still requires a separately reviewed controlled Email read; no release or freeze approval for this product'];
 console.log('BROWSER_QA_SQL_ACCESS_SUMMARY '+JSON.stringify({probes:accessDiagnostics.probes.length,failed:accessDiagnostics.failedCount}));
 // Still run the original first browser gate even if a read probe failed,
 // so the actual API/transport error is independently correlated. A failed
 // SQL diagnostic or browser gate cannot unlock full-matrix acceptance.
 const staticRoot=path.join(root,'.deploy-static');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'tools/static-assets.json'),'utf8'));
 assert.equal(manifest.length,97);const allowed=new Set(manifest);
 const sdkRoot=path.join(tooling,'firebase');
 const sdkFiles=new Set(['firebase-app-compat.js','firebase-auth-compat.js','firebase-firestore-compat.js']);
 const emulatorBoot=`
 ;(function(){
 if(firebase.apps.length)throw new Error('Unexpected preinitialized Firebase app');
 firebase.initializeApp({apiKey:'demo-api-key',projectId:'demo-paws-pr171',authDomain:'localhost',appId:'1:123456789:web:synthetic'});
 firebase.auth().useEmulator('http://127.0.0.1:9099');
 firebase.firestore().useEmulator('127.0.0.1',8080);
 })();
 `;
 const mime={'.js':'application/javascript; charset=utf-8','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.pdf':'application/pdf'};
 const staticServer=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1');
  const asset=u.pathname==='/'?'index.html':u.pathname.slice(1);
  if(!allowed.has(asset)){res.writeHead(404).end();return;}
  // Only an ephemeral browser response adapter, never a source/artifact
  // modification. The browser cannot send anything to the production origin.
  if(asset==='paws-api-origin.js'){
   res.writeHead(200,{'content-type':mime['.js'],'cache-control':'no-store'}).end("window.PAWS_API_ORIGIN_CONFIG=Object.freeze({apiOrigin:'"+origin+"',releaseLabel:'ISOLATED QA ONLY'});");return;
  }
  res.writeHead(200,{'content-type':mime[path.extname(asset)]||'application/octet-stream','cache-control':'no-store'});
  fs.createReadStream(path.join(staticRoot,asset)).pipe(res);
 });
 const site=await listen(staticServer);
 env.PAWS_API_ALLOWED_ORIGINS=site;
 runtime=createSwaSqlRuntime({env,admin});
 const apiServer=createUniversityHttpServer({runtime,env,logger:{error:()=>console.log('BROWSER_QA_HTTP_ERROR')}});
 let activeTrace=null;
 apiServer.on('request',(request,response)=>{
  const trace=activeTrace;if(!trace)return;
  const label=endpointLabel(new URL(request.url,'http://127.0.0.1').href);
  if(!label)return;
  const method=request.method;
  const originMatches=request.headers.origin===site;
  const bearerPresent=typeof request.headers.authorization==='string'&&request.headers.authorization.startsWith('Bearer ');
  traceEvent(trace,'api-arrived',{endpoint:label,method,originMatches,bearerPresent});
  response.once('finish',()=>traceEvent(trace,'api-finished',{endpoint:label,method,status:response.statusCode,corsMatches:response.getHeader('access-control-allow-origin')===site}));
 });
 const api=await listen(apiServer);
 const noAuth=await fetch(api+'/api/v1/me');assert.equal(noAuth.status,401);
 const invalid=await fetch(api+'/api/v1/access/self',{headers:{authorization:'Bearer invalid-synthetic-token'}});
 assert.equal(invalid.status,401);assert.equal((await invalid.json()).error.code,'UNAUTHENTICATED');
 // Direct HTTP role/security checks use actual emulator-issued Firebase tokens,
 // the product verifier and the same SQL runtime. No injected profile/token.
 stage='http-authorization-matrix';
 const httpChecks=[];
 receipt.httpAuthorization=httpChecks;
 async function emulatorToken(user){
  const response=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key',{
   method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:user.email,password,returnSecureToken:true})
  });
  assert.equal(response.status,200);
  const token=(await response.json()).idToken;assert.equal(typeof token,'string');return token;
 }
 async function call(token,route,method='GET',body){
  const response=await fetch(api+route,{method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  return {status:response.status,body:await response.json()};
 }
 const allIds=identities.filter(x=>x.sessionId).map(x=>x.sessionId.toLowerCase()).sort();
 for(const user of identities){
  stage='http-authorization:'+user.uid;
  const token=await emulatorToken(user);
  const self=await call(token,'/api/v1/access/self'),me=await call(token,'/api/v1/me');
  console.log('BROWSER_QA_HTTP_PHASE '+JSON.stringify({role:user.role,phase:'identity',accessSelf:self.status,me:me.status,accessCode:safeCode(self.body.error?.code),meCode:safeCode(me.body.error?.code)}));
  assert.equal(self.status,200);assert.equal(self.body.access.allowed,true);assert.equal(self.body.access.role,user.role);
  assert.equal(Object.hasOwn(self.body.access,'email'),false);
  assert.equal(me.status,200);assert.equal(me.body.profile.role,user.role);assert.equal(me.body.profile.email,null);
  const sessions=await call(token,'/api/v1/sessions');
  console.log('BROWSER_QA_HTTP_PHASE '+JSON.stringify({role:user.role,phase:'sessions',status:sessions.status,code:safeCode(sessions.body.error?.code)}));
  const ids=sessions.body.sessions?.map(row=>String(row.id).toLowerCase()).sort();
  assert.equal(sessions.status,200);
  assert.deepEqual(ids,scoped.has(user.role)?[user.sessionId.toLowerCase()]:allIds);
  assert.equal(sessions.body.sessions.filter(row=>row.batchEditToken).length,admins.has(user.role)?allIds.length:0);
  const directory=await call(token,'/api/v1/access/accounts');
  console.log('BROWSER_QA_HTTP_PHASE '+JSON.stringify({role:user.role,phase:'owner-directory',status:directory.status,code:safeCode(directory.body.error?.code)}));
  // Preserve and expose the known owner-only directory blocker. It is NOT a
  // passed directory feature. No contact permission is changed.
  assert.equal(directory.status,user.role==='adfa_general'?503:403);
  assert.equal(directory.body.error.code,user.role==='adfa_general'?'ACCESS_UNAVAILABLE':'OWNER_REQUIRED');
  assert.equal(Object.hasOwn(directory.body,'accounts'),false);
  if(!admins.has(user.role)){
   const denied=await call(token,'/api/v1/sessions/batch-edit','POST',{edits:[]});
   assert.equal(denied.status,403);assert.equal(denied.body.error.code,'ROLE_DENIED');
  }
  const checked={role:user.role,account:user.uid,accessSelf:self.status,me:me.status,sessions:sessions.status,scopeVerified:true,batchTokensVerified:true,ownerDirectory:user.role==='adfa_general'?'BLOCKED_EXISTING_EMAIL_CONTRACT':'DENIED',nonAdminWrite:admins.has(user.role)?'not-requested':'DENIED'};
  httpChecks.push(checked);console.log('BROWSER_QA_HTTP_AUTHORIZATION '+JSON.stringify(checked));
 }
 // Additional ephemeral negative identity fixtures, outside the 9 x 2
 // browser matrix. No active identities are modified and no permissions added.
 for(const kind of ['missing-profile','inactive-profile','password-required','unlinked-faculty']){
  stage='http-authorization-negative:'+kind;
  const user={uid:'pr171-negative-'+kind,email:'paws-pr171-negative-'+kind+'@ucalgary.ca'};
  await auth.createUser({uid:user.uid,email:user.email,password,emailVerified:true});
  if(kind!=='missing-profile')await db.query('INSERT paws.UserProfile(FirebaseUid,Email,DisplayName,BaseRole,Active,MustChangePassword) VALUES(@uid,@email,N\'Synthetic negative account\',@role,@active,@mustChangePassword)',{
   uid:user.uid,email:user.email,role:kind==='unlinked-faculty'?'faculty':'adfa_regular',active:kind!=='inactive-profile',mustChangePassword:kind==='password-required'
  });
  const token=await emulatorToken(user),self=await call(token,'/api/v1/access/self'),me=await call(token,'/api/v1/me'),sessions=await call(token,'/api/v1/sessions');
  assert.equal(self.status,200);assert.equal(self.body.access.allowed,false);
  assert.equal(me.status,403);assert.equal(sessions.status,403);assert.equal(Object.hasOwn(sessions.body,'sessions'),false);
  const checked={negative:kind,accessAllowed:false,me:me.status,sessions:sessions.status,code:me.body.error.code};
  httpChecks.push(checked);console.log('BROWSER_QA_HTTP_AUTHORIZATION '+JSON.stringify(checked));
 }
 console.log('BROWSER_QA_HTTP_AUTHORIZATION_OK '+JSON.stringify({positive:9,negative:4,anonymous:401,invalid:401,ownerDirectory:'separate blocker'}));
 const health=await fetch(api+'/api/health/sql');assert.equal(health.status,200);
 receipt.isolation={browser:site,api,sql:'127.0.0.1:14339 / disposable container',auth:'127.0.0.1:9099',firestore:'127.0.0.1:8080',markerVerified:true,anonymousDenied:true,sqlHealthy:true};
 console.log('BROWSER_QA_ISOLATION '+JSON.stringify(receipt.isolation));
 browser=await chromium.launch({headless:true,args:['--disable-background-networking']});
 const expectedAll=identities.filter(x=>x.sessionId).map(x=>x.sessionId.toLowerCase()).sort();
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  // Fresh context for every account, with actual SDK sign-in through the app.
  for(const user of identities){
   const result={role:user.role,account:user.uid,viewport:viewport.width,checks:{}};
   receipt.roles.push(result);
   const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:viewport.width===390,hasTouch:viewport.width===390,serviceWorkers:'block'});
   const page=await context.newPage();
   page.setDefaultTimeout(30000);
   const blocked=new Set();
   const trace=[];trace.startedAt=Date.now();result.loginTrace=trace;activeTrace=trace;
   const browserResponses=[];
   await page.addInitScript(()=>{
    const t={formSubmits:0,profileEvents:0,invalidated:null};window.__pawsQaLoginTrace=t;
    document.addEventListener('submit',event=>{if(event.target?.id==='email-login-form')t.formSubmits++;},true);
    window.addEventListener('paws-profile',()=>{t.profileEvents++;});
    window.addEventListener('paws-access-invalidated',event=>{
     const reason=event.detail?.reason;
     t.invalidated=['unverified','changed','password_required'].includes(reason)?reason:'other';
    });
   });
   page.on('request',request=>{
    const label=endpointLabel(request.url());
    if(label)traceEvent(trace,'browser-request',{endpoint:label,method:request.method()});
   });
   page.on('response',async response=>{
    const label=endpointLabel(response.url());if(!label)return;
    const entry={endpoint:label,method:response.request().method(),status:response.status()};
    const code=await responseCode(response);
    browserResponses.push({...entry,code});traceEvent(trace,'browser-response',{...entry,code});
   });
   page.on('requestfailed',request=>{
    const label=endpointLabel(request.url());if(label)traceEvent(trace,'browser-request-failed',{endpoint:label,method:request.method(),code:safeCode(request.failure()?.errorText)});
   });
   page.on('pageerror',error=>traceEvent(trace,'page-error',{name:safeName(error?.name),code:safeCode(error?.code)}));
   page.on('console',message=>{
    if(!['error','warning'].includes(message.type()))return;
    const text=message.text();
    const category=text.includes('[Email sign-in]')?'email-sign-in':text.includes('[SQL access profile]')?'sql-access-profile':text.includes('[write capabilities]')?'write-capabilities':/CORS|Access-Control-Allow-Origin/i.test(text)?'cors':/failed to fetch|networkerror|network request failed/i.test(text)?'network':/firebase/i.test(text)?'firebase':'other';
    const match=text.match(/\bauth\/[a-z][a-z0-9-]{1,70}\b|\bnet::ERR_[A-Z0-9_]+\b|\b(?:SQL_UNAVAILABLE|SERVICE_UNAVAILABLE|PROFILE_REQUIRED|ROLE_DENIED|FACULTY_LINK_REQUIRED|ACCESS_CHANGED|SESSION_REAUTH_REQUIRED|TOKEN_REFRESH_FAILED|UNAUTHENTICATED|PASSWORD_CHANGE_REQUIRED|CORS_ORIGIN_DENIED|CORS_PREFLIGHT_DENIED)\b/);
    traceEvent(trace,'browser-console',{level:message.type(),category,code:safeCode(match?.[0])});
   });
   try{
    await context.route('**/*',async route=>{
     const u=new URL(route.request().url());
     if(u.origin===site||u.origin==='http://127.0.0.1:9099'||u.origin==='http://127.0.0.1:8080'){await route.continue();return;}
     if(u.origin===origin&&u.pathname.startsWith('/api/')){
      const label=endpointLabel(u.href)||'other-api';
      traceEvent(trace,'proxy-forward',{endpoint:label,method:route.request().method(),target:'isolated-api'});
      try{
       // Keep the existing proxy behavior while diagnosing, including the
       // original request/response headers. Observe rather than repair blindly.
       const response=await route.fetch({url:api+u.pathname+u.search,maxRedirects:0});
       const headers=response.headers();
       traceEvent(trace,'proxy-response',{endpoint:label,method:route.request().method(),status:response.status(),corsMatches:headers['access-control-allow-origin']===site,corsPresent:!!headers['access-control-allow-origin'],code:await responseCode(response)});
       await route.fulfill({response});return;
      }catch(error){
       traceEvent(trace,'proxy-failed',{endpoint:label,method:route.request().method(),name:safeName(error?.name),code:safeCode(error?.code)});
       await route.abort('failed').catch(()=>{});return;
      }
     }
     if(u.origin==='https://www.gstatic.com'&&u.pathname.startsWith('/firebasejs/9.23.0/')){
      const name=path.basename(u.pathname);
      if(sdkFiles.has(name)){
       let body=fs.readFileSync(path.join(sdkRoot,name),'utf8');
       if(name==='firebase-firestore-compat.js')body+=emulatorBoot;
       await route.fulfill({status:200,contentType:mime['.js'],body});return;
      }
     }
     blocked.add(u.origin==='https://www.gstatic.com'?'unapproved-sdk-asset':u.origin===origin?'unapproved-api-path':'non-isolated-origin');await route.abort('blockedbyclient');
    });
    stage='browser-login-page:'+user.uid+':'+viewport.width;
    await page.goto(site+'/',{waitUntil:'domcontentloaded'});
    await page.locator('#gate-sign-in').waitFor({state:'visible'});
    await page.locator('#gate-sign-in').click();
    await page.locator('#choose-email').click();
    await page.locator('#login-email').fill(user.email);
    await page.locator('#login-password').fill(password);
    stage='browser-form-submit:'+user.uid+':'+viewport.width;
    await page.locator('#email-login-submit').click();
    await page.waitForFunction(()=>window.__pawsQaLoginTrace?.formSubmits===1,null,{timeout:10000});
    traceEvent(trace,'phase-complete',{phase:'form-submit',...await browserState(page)});
    stage='browser-firebase-response:'+user.uid+':'+viewport.width;
    const firebaseResponse=await waitTrace(()=>browserResponses.find(r=>r.endpoint==='firebase-password'&&r.method==='POST'));
    traceEvent(trace,'phase-complete',{phase:'firebase-password-response',status:firebaseResponse.status,code:firebaseResponse.code});
    assert.equal(firebaseResponse.status,200);
    stage='browser-firebase-session:'+user.uid+':'+viewport.width;
    await page.waitForFunction(uid=>window.firebase?.apps?.length&&firebase.auth().currentUser?.uid===uid,user.uid,{timeout:20000});
    traceEvent(trace,'phase-complete',{phase:'firebase-session',...await browserState(page)});
    stage='browser-effective-access:'+user.uid+':'+viewport.width;
    const access=await waitTrace(()=>trace.find(e=>e.event==='api-finished'&&e.endpoint==='access-self'&&e.method==='GET'&&e.status===200),25000);
    traceEvent(trace,'phase-complete',{phase:'sql-access-self-response',status:access.status});
    assert.equal(access.status,200);
    stage='browser-sql-profile:'+user.uid+':'+viewport.width;
    const me=await waitTrace(()=>trace.find(e=>e.event==='api-finished'&&e.endpoint==='me'&&e.method==='GET'&&e.status===200),25000);
    traceEvent(trace,'phase-complete',{phase:'sql-me-response',status:me.status,corsMatches:me.corsMatches});
    assert.equal(me.status,200);
    stage='browser-me-delivered:'+user.uid+':'+viewport.width;
    const received=await waitTrace(()=>browserResponses.find(r=>r.endpoint==='me'&&r.method==='GET'&&r.status===200),15000);
    traceEvent(trace,'phase-complete',{phase:'browser-me-response',status:received.status});
    stage='browser-profile-accepted:'+user.uid+':'+viewport.width;
    // Product dispatches paws-profile only after its real authenticated
    // client has accepted the /me response and effective-access guard.
    await page.waitForFunction(()=>window.__pawsQaLoginTrace?.profileEvents>0,null,{timeout:15000});
    traceEvent(trace,'phase-complete',{phase:'client-profile-accepted',...await browserState(page)});
    stage='browser-account-ui:'+user.uid+':'+viewport.width;
    await page.waitForFunction(role=>document.getElementById('account-toggle')?.textContent.trim().endsWith(' - '+role),user.role,{timeout:30000});
    stage='browser-ui-unlock:'+user.uid+':'+viewport.width;
    await page.waitForFunction(()=>!document.body.classList.contains('auth-locked'),null,{timeout:30000});
    traceEvent(trace,'phase-complete',{phase:'ui-unlock',...await browserState(page)});
    result.checks.actualSdkLogin=true;
    stage='role-read:'+user.uid+':'+viewport.width;
    const view=await page.evaluate(async()=>{
     const profile=await window.UCVM_PAWS_DATA.currentUser();
     const rows=await window.UCVM_PAWS_DATA.listSessions();
     const sessions=Array.isArray(rows)?rows:rows.sessions;
     return {role:profile.role,facultyId:profile.facultyId||null,ids:sessions.map(r=>String(r.id).toLowerCase()).sort(),
      tokens:sessions.filter(r=>r.batchEditToken).length,selection:!document.getElementById('selection-controls')?.classList.contains('hidden'),
      firebaseProject:firebase.app().options.projectId,viewportWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth};
    });
    assert.equal(view.firebaseProject,project);assert.equal(view.role,user.role);
    assert.equal(String(view.facultyId||'').toLowerCase(),String(user.facultyId||'').toLowerCase());
    assert.deepEqual(view.ids,scoped.has(user.role)?[user.sessionId.toLowerCase()]:expectedAll);
    assert.equal(view.tokens,admins.has(user.role)?expectedAll.length:0);
    assert.equal(view.selection,admins.has(user.role));
    result.checks.roleAndSessionScope=true;result.checks.batchTokenAndControls=true;
    result.viewportWidth=view.viewportWidth;result.scrollWidth=view.scrollWidth;
    result.checks.viewportNoPageOverflow=view.scrollWidth<=view.viewportWidth+1;
    assert.equal(result.checks.viewportNoPageOverflow,true);
    // Anonymous and role-denied writes are verified against the actual API,
    // using the browser-issued emulator token. No synthetic write occurs here.
    if(!admins.has(user.role)){
     const denied=await page.evaluate(async()=>{
      const token=await firebase.auth().currentUser.getIdToken();
      const response=await fetch('https://paws-pr171-qa.invalid/api/v1/sessions/batch-edit',{method:'POST',headers:{Authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({edits:[]})});
      return {status:response.status,code:(await response.json()).error?.code};
     });
     assert.deepEqual(denied,{status:403,code:'ROLE_DENIED'});result.checks.forbiddenWrite=true;
    }
    // Sign out through the real SDK and verify product auth-state cleanup.
    await page.screenshot({path:path.join(out,user.uid+'-'+viewport.width+'.png')});
    await page.evaluate(()=>firebase.auth().signOut());
    await page.locator('#gate-sign-in').waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>firebase.auth().currentUser),null);
    result.checks.signOutCleanup=true;
    result.status='passed';
   }catch(error){
    result.status='failed';result.failure=fail(error);receipt.failures.push(result.failure);
    result.lastBrowserState=await browserState(page);
    traceEvent(trace,'phase-failed',{failure:result.failure,state:result.lastBrowserState});
    // Do not capture a failed login page: it may still contain a password.
    console.error('BROWSER_QA_ROLE_FAILED '+JSON.stringify({role:user.role,account:user.uid,viewport:viewport.width,...result.failure}));
   }finally{
    // Only known categories are reported, not arbitrary URL components.
    result.blockedOrigins=[...blocked].sort();await context.close();activeTrace=null;
    const {loginTrace,...summary}=result;
    console.log('BROWSER_QA_ROLE '+JSON.stringify(summary));
   }
   // The first desktop Developer case is the diagnostic gate. It must pass
   // the original login, role, viewport and sign-out assertions before the
   // other 17 cases run. A failed gate is a failed run, never full acceptance.
   if(receipt.roles.length===1){
    if(result.status!=='passed'||accessDiagnostics.failedCount!==0){
     receipt.diagnosticGate={status:'failed',completedCases:1,remainingCases:17};
     console.error('BROWSER_QA_DIAGNOSTIC_GATE_FAILED');
     throw Object.assign(Error('First browser diagnostic failed'),{code:'QA_FIRST_CASE_FAILED'});
    }
    receipt.diagnosticGate={status:'passed',completedCases:1,remainingCases:17};
    console.log('BROWSER_QA_DIAGNOSTIC_GATE_OK');
   }
  }
 }
 assert.equal(receipt.roles.length,18);
 assert.equal(receipt.failures.length,0,'One or more browser role/viewport checks failed.');
 console.log('PR171_ISOLATED_AUTHENTICATED_BROWSER_OK');
 console.log('PR171_OWNER_DIRECTORY_BLOCKED: original contact-read permission gap; no release approval');
}
main().catch(error=>{
 receipt.failure=fail(error);console.error('BROWSER_QA_FAILED '+JSON.stringify(receipt.failure));process.exitCode=1;
}).finally(async()=>{
 await browser?.close().catch(()=>{});
 await Promise.allSettled(servers.map(server=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections?.();})));
 await Promise.allSettled([runtime?.close(),db.close(),...admin.apps.map(app=>app.delete())]);
 fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
});
