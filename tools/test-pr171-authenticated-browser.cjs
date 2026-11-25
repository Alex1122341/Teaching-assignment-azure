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
const sha='6410015768aea742dfd992a1be8428f4d06dfc54';
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
const {createSqlSchedulingTaskRepository}=require('../server/src/data/sql-scheduling-task-repository');
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
const officeOnly=new Set(['adc','lab']);
const officeCapabilities=Object.freeze({sessionEdit:false,sessionBatchEdit:false,sessionCreate:false,afcSingle:false,afcBatch:false,requestLifecycle:false,decisions:false,approvedArtifactCreation:false,dateChange:false});
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
 ['/api/v1/sessions','sessions'],['/api/v1/sessions/batch-edit','batch-edit'],
 ...[
  'access/accounts','access/announcements','access/catalog','access/commit','access/groups',
  'access/history','access/leadership/catalog','access/leadership/commit','access/leadership/history',
  'access/leadership/preview','access/legacy-audit','access/preview','afc-forms','afc-forms/capabilities',
  'afc-requests','calendar-activities','calendar-activities/capabilities','calendar-activity-imports',
  'ccc-replacements','ccc-replacements/capabilities','ccc-replacements/template','ccc-schedule',
  'change-history','change-history/export','change-history/page','dashboard/afc-records',
  'dashboard/afc-records/batch','dashboard/afc-records/write-capabilities','dashboard/doe-overview',
  'dashboard/faculty','dashboard/faculty-admin/write-capabilities','dashboard/leadership-directory',
  'dashboard/roles','dashboard/summary','dashboard/teaching-summary','dashboard/trainees',
  'dashboard/trainees/export','doe/assignments','doe/history','doe/manual-assignments',
  'doe/manual-scope-suggestions','doe/policies','doe/policies/copy','doe/policies/draft',
  'doe/policy','doe/policy-version','doe/preview','doe/recalculate','doe/targets',
  'doe/workflow-preview','doe/worksheet','doe/worksheets','doe/write-capabilities',
  'faculty/availability/common-time','faculty/availability/common-time/details','faculty/availability/export',
  'faculty/availability/page','faculty/availability/query','faculty/availability/roster',
  'reports/catalog','reports/export','reports/page','reports/query','scheduling-tasks','sessions/batch',
  'support','swaps','swaps/capabilities','swaps/context','swaps/faculty-preview','swaps/queue',
  'teaching-assignments/contribution-targets','teaching-assignments/packages',
  'teaching-assignments/publications','teaching-assignments/publications/history',
  'teaching-assignments/published','teaching-assignments/work-queue','teaching-assignments/write-capabilities'
 ].map(name=>['/api/v1/'+name,name]),
 ['/api/health/sql','health-sql'],['/api/health/runtime','health-runtime']
]);
const dynamicApiLabels=[
 [/^\/api\/v1\/dashboard\/faculty\/[^/]+\/special-leave\/(?:source|evaluation)$/,'dashboard/faculty/special-leave'],
 [/^\/api\/v1\/dashboard\/faculty\/[^/]+$/,'dashboard/faculty/detail'],
 [/^\/api\/v1\/faculty\/[^/]+\/availability$/,'faculty/availability/detail'],
 [/^\/api\/v1\/sessions\/[^/]+(?:\/assignments)?$/,'sessions/detail'],
 [/^\/api\/v1\/afc-requests\/[^/]+(?:\/[^/]+)?$/,'afc-requests/detail'],
 [/^\/api\/v1\/dashboard\/afc-records\/[^/]+(?:\/[^/]+)?$/,'dashboard/afc-records/detail'],
 [/^\/api\/v1\/access\/groups\/[^/]+(?:\/members)?$/,'access/groups/detail'],
 [/^\/api\/v1\/swaps\/[^/]+(?:\/[^/]+)?$/,'swaps/detail']
];
function endpointLabel(url){
 const u=new URL(url);
 if(u.pathname.startsWith('/api/'))return apiLabels.get(u.pathname)||dynamicApiLabels.find(([pattern])=>pattern.test(u.pathname))?.[1]||'unclassified-api';
 if(u.origin==='http://127.0.0.1:9099'){
  if(u.pathname.endsWith('/accounts:signInWithPassword'))return 'firebase-password';
  if(u.pathname.endsWith('/accounts:lookup'))return 'firebase-lookup';
  if(u.pathname.endsWith('/token'))return 'firebase-token';
  return 'firebase-other';
 }
 return null;
}
function traceEvent(trace,event,details={}){
 if(!trace)return;
 if(trace.length>=2000){
  if(!trace.overflow){trace.overflow=true;console.error('BROWSER_QA_TRACE_LIMIT_EXCEEDED');}
  return;
 }
 const entry={event,sequence:trace.length+1,ms:Date.now()-trace.startedAt,stage,...details};
 trace.push(entry);
 console.log('BROWSER_QA_LOGIN_TRACE '+JSON.stringify(entry));
}
// The exact frozen frontend is unchanged. Map known source lines to fixed
// branch labels; stack strings, paths, query values and error text never leave
// the local diagnostic parser.
const invalidationBranches=new Map([
 [33,'firebase-signed-out'],[37,'auth-state-identity-changed'],[50,'access-not-ready'],[51,'access-version-invalid'],
 [52,'scope-version-invalid'],[54,'access-profile-binding-changed'],
 [55,'access-signature-changed'],[60,'access-check-rejected'],
 [64,'profile-inactive-or-password-required'],[66,'profile-access-binding-changed'],
 [67,'profile-signature-changed'],[70,'api-revocation-error']
]);
function safeFrames(stack,allowed){
 if(typeof stack!=='string')return [];
 return [...stack.matchAll(/\/([A-Za-z0-9_-]+\.js):(\d+):(\d+)/g)]
  .filter(match=>allowed.has(match[1]))
  .slice(0,8).map(match=>({script:match[1],line:Number(match[2]),column:Number(match[3])}));
}
function errorCategory(error){
 const message=typeof error?.message==='string'?error.message:'';
 if(/Cannot read propert(?:y|ies) of null/i.test(message))return 'null-property-read';
 if(/Cannot set propert(?:y|ies) of null/i.test(message))return 'null-property-write';
 if(/Cannot read propert(?:y|ies) of undefined/i.test(message))return 'undefined-property-read';
 if(/Cannot set propert(?:y|ies) of undefined/i.test(message))return 'undefined-property-write';
 if(/is not a function/i.test(message))return 'not-a-function';
 if(/failed to fetch|networkerror|network request failed/i.test(message))return 'network';
 return 'other';
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
  // Independent zero-result SQL contract comparison. Keep identity counts
  // separate; use the immutable original adapter and the same actual SQL
  // identity. No grant, procedure, write gate or scope change.
  const taskDiagnostics=[];
  receipt.schedulingTaskDiagnostics={sql:taskDiagnostics,http:[]};
  async function taskProbe(phase,run){
   try{
    const facts=await run(),record={phase,status:'passed',facts};
    taskDiagnostics.push(record);console.log('BROWSER_QA_TASKS_DIAGNOSTIC '+JSON.stringify(record));
   }catch(error){
    const record={phase,status:'blocked',...sqlError(error)};
    taskDiagnostics.push(record);console.log('BROWSER_QA_TASKS_DIAGNOSTIC '+JSON.stringify(record));
   }
  }
  await taskProbe('reviewed-list-execute-permission',async()=>{
   const [row]=await diagnosticDb.query("SELECT HAS_PERMS_BY_NAME(N'paws_api.ListSchedulingTasks',N'OBJECT',N'EXECUTE') AS listExecute,HAS_PERMS_BY_NAME(N'paws_api.ReviewSchedulingTask',N'OBJECT',N'EXECUTE') AS reviewExecute");
   assert.equal(row.listExecute,1);assert.equal(row.reviewExecute,0);
   return {listExecute:row.listExecute,reviewExecute:row.reviewExecute};
  });
  for(const [actor,role] of [[uid,'developer'],[facultyUid,'faculty']]){
   const query={academicYear:'2026-27',limit:50};
   await taskProbe('raw-list-procedure-'+role,async()=>{
    const rows=await diagnosticDb.query('EXEC paws_api.ListSchedulingTasks @ActorFirebaseUid=@actor,@QueryJson=@query',{actor,query:JSON.stringify(query)});
    const raw=rows[0]?.responseJson;
    const facts={rows:rows.length,jsonPresent:typeof raw==='string',validJson:false,taskFieldPresent:false,taskArrayPresent:false,taskFieldKind:'unknown',total:null,snapshotValid:false};
    try{
     const body=JSON.parse(raw);facts.validJson=true;facts.taskFieldPresent=Object.hasOwn(body,'tasks');facts.taskArrayPresent=Array.isArray(body.tasks);
     facts.taskFieldKind=!facts.taskFieldPresent?'omitted':body.tasks===null?'null':facts.taskArrayPresent?'array':typeof body.tasks;
     facts.total=Number.isInteger(body.total)?body.total:null;facts.snapshotValid=typeof body.snapshotVersion==='string'&&/^[a-f0-9]{64}$/i.test(body.snapshotVersion);
    }catch(_){}
    // Explicitly prove the precise zero-row shape before accepting it.
    console.log('BROWSER_QA_TASKS_RAW_SHAPE '+JSON.stringify({role,...facts}));
    assert.equal(rows.length,1);assert.equal(facts.validJson,true);assert.equal(facts.taskFieldKind,'omitted');assert.equal(facts.total,0);assert.equal(facts.snapshotValid,true);
    return facts;
   });
   await taskProbe('original-task-repository-empty-'+role,async()=>{
    const oldRepository=original('data/sql-scheduling-task-repository').createSqlSchedulingTaskRepository(diagnosticDb);
    await assert.rejects(oldRepository.list({actorFirebaseUid:actor,query}),{code:'INVALID_SCHEDULING_RESPONSE'});
    return {originalRejected:true};
   });
   await taskProbe('product-task-repository-'+role,async()=>{
    const queue=await createSqlSchedulingTaskRepository(diagnosticDb).list({actorFirebaseUid:actor,query});
    assert.deepEqual(queue.tasks,[]);assert.equal(queue.total,0);assert.equal(queue.nextCursor,null);assert.match(queue.snapshotVersion,/^[a-f0-9]{64}$/i);
    return {taskCount:queue.tasks.length,total:queue.total};
   });
  }
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
 if(receipt.schedulingTaskDiagnostics.sql.some(row=>row.status==='blocked'))receipt.releaseBlockers.push('Scheduling Tasks read: independent SQL diagnostic blocked');
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
 window.__pawsQaObserveAuth?.(firebase.auth());
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
 receipt.officeCapabilityChecks=[];
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
  if(officeOnly.has(user.role)){
   const caps=await call(token,'/api/v1/afc-requests/write-capabilities');
   assert.equal(caps.status,200);assert.deepEqual(caps.body,{writeCapabilities:officeCapabilities});
   const target=allIds[0],afc='/api/v1/afc-requests',session='/api/v1/sessions';
   const deniedRoutes=[
    ['GET',afc],['POST',afc,{}],...['withdraw','dates','date-change','recommend','reject','approve'].map(action=>['POST',afc+'/'+target+'/'+action,{}]),
    ['POST',session,{}],['POST',session+'/batch',{}],['POST',session+'/batch-edit',{edits:[]}],
    ['PATCH',session+'/'+target,{}],['PATCH',session+'/'+target+'/assignments',{}]
   ];
   for(const [method,route,body] of deniedRoutes){
    const response=await call(token,route,method,body);
    assert.equal(response.status,403);assert.equal(response.body.error.code,'ROLE_DENIED');
   }
   const record={role:user.role,capabilityStatus:200,allNineFalse:true,deniedRouteCount:deniedRoutes.length,calendarRows:sessions.body.sessions.length};
   receipt.officeCapabilityChecks.push(record);console.log('BROWSER_QA_OFFICE_CAPABILITIES '+JSON.stringify(record));
  }
  const directory=await call(token,'/api/v1/access/accounts');
  console.log('BROWSER_QA_HTTP_PHASE '+JSON.stringify({role:user.role,phase:'owner-directory',status:directory.status,code:safeCode(directory.body.error?.code)}));
  // Preserve and expose the known owner-only directory blocker. It is NOT a
  // passed directory feature. No contact permission is changed.
  assert.equal(directory.status,user.role==='adfa_general'?503:403);
  assert.equal(directory.body.error.code,user.role==='adfa_general'?'ACCESS_UNAVAILABLE':'OWNER_REQUIRED');
  assert.equal(Object.hasOwn(directory.body,'accounts'),false);
  if(user.uid===identities[0].uid||user.uid===identities.find(item=>item.role==='faculty').uid){
   const tasks=await call(token,'/api/v1/scheduling-tasks?academicYear=2026-27&limit=50');
   const facts={role:user.role,status:tasks.status,code:safeCode(tasks.body.error?.code),readPassed:tasks.status===200,reviewEnabled:tasks.body.capabilities?.canReview===true};
   receipt.schedulingTaskDiagnostics.http.push(facts);
   console.log('BROWSER_QA_TASKS_HTTP '+JSON.stringify(facts));
   if(tasks.status===200){assert.deepEqual(tasks.body.tasks,[]);assert.equal(tasks.body.total,0);assert.equal(facts.reviewEnabled,false);}
   else{assert.equal(tasks.status,503);assert.equal(facts.code,'SERVICE_UNAVAILABLE');receipt.releaseBlockers.push('Scheduling Tasks GET blocked for '+user.role);}
   // Review remains closed. The deliberately invalid command cannot mutate
   // any record; the existing role/write-gate rejection must occur first.
   const review=await call(token,'/api/v1/scheduling-tasks/'+'0'.repeat(64)+'/review','POST',{});
   assert.equal(review.status,admins.has(user.role)?503:403);
   assert.equal(review.body.error.code,admins.has(user.role)?'WRITE_DISABLED':'ROLE_DENIED');
   console.log('BROWSER_QA_TASKS_REVIEW_GATE '+JSON.stringify({role:user.role,status:review.status,code:safeCode(review.body.error.code)}));
  }
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
 // Additional actual identity negatives for the newly supported capability
 // discovery path. Only the disposable seed administrator creates users.
 stage='office-capability-negative';
 for(const kind of ['inactive-adc','password-lab']){
  const user={uid:'pr171-negative-'+kind,email:'paws-pr171-negative-'+kind+'@ucalgary.ca'};
  await auth.createUser({uid:user.uid,email:user.email,password,emailVerified:true});
  await db.query("INSERT paws.UserProfile(FirebaseUid,Email,DisplayName,BaseRole,Active,MustChangePassword) VALUES(@uid,@email,N'Synthetic office negative',@role,@active,@passwordRequired)",{
   uid:user.uid,email:user.email,role:kind==='inactive-adc'?'adc':'lab',active:kind!=='inactive-adc',passwordRequired:kind==='password-lab'
  });
  const token=await emulatorToken(user),denied=await call(token,'/api/v1/afc-requests/write-capabilities');
  assert.equal(denied.status,403);assert.equal(denied.body.error.code,kind==='inactive-adc'?'PROFILE_REQUIRED':'PASSWORD_CHANGE_REQUIRED');
  assert.equal(Object.hasOwn(denied.body,'writeCapabilities'),false);
  console.log('BROWSER_QA_OFFICE_NEGATIVE '+JSON.stringify({kind,status:denied.status,code:denied.body.error.code}));
 }
 for(const token of ['', 'invalid-synthetic-token']){
  const denied=await call(token,'/api/v1/afc-requests/write-capabilities');assert.equal(denied.status,401);
 }
 // Independent populated Tasks regression. Temporary additional rows are
 // inserted only in the marker-verified disposable database and removed
 // before the existing unchanged 9 x 2 Calendar expectations run.
 stage='tasks-populated-fixture';
 const facultyPair=identities.filter(user=>user.role==='faculty');
 assert.equal(facultyPair.length,2);
 const conflicts=facultyPair.map(user=>({user,extraId:randomUUID()}));
 const taskConnection=createSqlConnection({sql,driver:env.PAWS_SQL_DRIVER,connectionString:env.PAWS_SQL_CONNECTION_STRING});
 receipt.schedulingTaskDiagnostics.populated={status:'pending'};
 try{
  const [permission]=await taskConnection.query("SELECT IS_ROLEMEMBER(N'db_owner') AS owner,HAS_PERMS_BY_NAME(N'paws_api.ListSchedulingTasks',N'OBJECT',N'EXECUTE') AS listExecute,HAS_PERMS_BY_NAME(N'paws_api.ReviewSchedulingTask',N'OBJECT',N'EXECUTE') AS reviewExecute");
  assert.deepEqual(permission,{owner:0,listExecute:1,reviewExecute:0});
  const tasksRepo=createSqlSchedulingTaskRepository(taskConnection),year='2026-27';
  const oldRepo=require(path.join(baselineRoot,'server','src','data','sql-scheduling-task-repository')).createSqlSchedulingTaskRepository(taskConnection);
  for(const [index,entry] of conflicts.entries()){
   await db.query(`
    INSERT paws.Session(SessionId,AcademicYear,CurriculumYear,CourseId,CourseCode,CourseName,Topic,SessionType,SessionDate,StartTime,EndTime,Room,SourceImportBatchId)
    VALUES(@sessionId,N'2026-27',N'2',@course,N'BROWSER171',N'Synthetic Browser QA',@topic,N'LEC','2026-11-25','09:30','10:30',N'QA room',@batch);
    INSERT paws.SessionAssignment(SessionAssignmentId,SessionId,FacultyId,FacultyResolutionStatus,TeachingRole,SourceImportBatchId,SourceRow)
    VALUES(NEWID(),@sessionId,@facultyId,N'resolved',N'Lecture',@batch,@sourceRow);
   `,{sessionId:entry.extraId,course,batch,topic:'Synthetic task conflict '+index,facultyId:entry.user.facultyId,sourceRow:100+index});
  }
  const pairKey=task=>[task.sessionId,...task.relatedSessions.map(row=>row.id)].map(id=>String(id).toLowerCase()).sort().join(':');
  const expectedPairs=conflicts.map(entry=>[entry.user.sessionId,entry.extraId].map(id=>id.toLowerCase()).sort().join(':')).sort();
  function checkQueue(queue,expected,review){
   assert.equal(queue.total,expected.length);assert.equal(queue.tasks.length,expected.length);
   assert.deepEqual(queue.tasks.map(pairKey).sort(),expected);
   assert.ok(queue.tasks.every(task=>task.type==='instructor_overlap'&&task.severity==='Conflict'&&task.canReview===review&&task.reviewStatus==='Unreviewed'));
   assert.match(queue.snapshotVersion,/^[a-f0-9]{64}$/i);assert.equal(queue.capabilities.canReview,review);
   assert.equal(queue.nextCursor,null);
   // The public API projection still strips unrelated sensitive fields.
   assert.doesNotMatch(JSON.stringify(queue),/"(?:email|ucid|afcPurpose|FirebaseUid)"\s*:/i);
  }
  const tested=[];
  for(const user of [identities[0],...facultyPair,identities.find(item=>item.role==='adc'),identities.find(item=>item.role==='lab')]){
   const query={academicYear:year,limit:50},expected=user.role==='faculty'?conflicts.filter(entry=>entry.user.uid===user.uid).map(entry=>[entry.user.sessionId,entry.extraId].map(id=>id.toLowerCase()).sort().join(':')):expectedPairs;
   const rawRows=await taskConnection.query('EXEC paws_api.ListSchedulingTasks @ActorFirebaseUid=@actor,@QueryJson=@query',{actor:user.uid,query:JSON.stringify(query)});
   const raw=JSON.parse(rawRows[0].responseJson);
   assert.equal(rawRows.length,1);assert.equal(raw.total,expected.length);assert.ok(Array.isArray(raw.tasks));assert.equal(raw.tasks.length,expected.length);
   const candidate=await tasksRepo.list({actorFirebaseUid:user.uid,query}),original=await oldRepo.list({actorFirebaseUid:user.uid,query});
   checkQueue(candidate,expected,user.role==='developer');
   assert.deepEqual(candidate,original,'Nonzero SQL queue must be byte-equivalent to the original public contract');
   const token=await emulatorToken(user),http=await call(token,'/api/v1/scheduling-tasks?academicYear=2026-27&limit=50');
   assert.equal(http.status,200);checkQueue(http.body,expected,false);
   const record={role:user.role,rawRows:raw.tasks.length,sqlTotal:candidate.total,httpStatus:http.status,scopeVerified:true,originalEquivalent:true,reviewDisabled:true};
   tested.push(record);console.log('BROWSER_QA_TASKS_POPULATED '+JSON.stringify(record));
  }
  const developerToken=await emulatorToken(identities[0]),first=await call(developerToken,'/api/v1/scheduling-tasks?academicYear=2026-27&limit=1');
  assert.equal(first.status,200);assert.equal(first.body.total,2);assert.equal(first.body.tasks.length,1);assert.match(first.body.nextCursor,/^[a-f0-9]{64}:1$/i);
  const second=await call(developerToken,'/api/v1/scheduling-tasks?academicYear=2026-27&limit=1&cursor='+encodeURIComponent(first.body.nextCursor));
  assert.equal(second.status,200);assert.equal(second.body.total,2);assert.equal(second.body.tasks.length,1);assert.equal(second.body.nextCursor,null);
  assert.equal(second.body.snapshotVersion,first.body.snapshotVersion);assert.deepEqual([...first.body.tasks,...second.body.tasks].map(pairKey).sort(),expectedPairs);
  const emptyQuery={academicYear:year,courseCode:'QA-NO-SUCH-COURSE',limit:50};
  const filtered=await tasksRepo.list({actorFirebaseUid:identities[0].uid,query:emptyQuery});
  assert.equal(filtered.total,0);assert.deepEqual(filtered.tasks,[]);
  const emptyHttp=await call(developerToken,'/api/v1/scheduling-tasks?academicYear=2026-27&courseCode=QA-NO-SUCH-COURSE&limit=50');
  assert.equal(emptyHttp.status,200);assert.deepEqual(emptyHttp.body.tasks,[]);assert.equal(emptyHttp.body.total,0);
  receipt.schedulingTaskDiagnostics.populated={status:'passed',cases:tested,paginationVerified:true,filteredEmptyVerified:true};
  console.log('BROWSER_QA_TASKS_POPULATED_OK '+JSON.stringify({roles:tested.length,paginationVerified:true,filteredEmptyVerified:true}));
 }catch(error){
  const facts={status:'blocked',...fail(error)};
  receipt.schedulingTaskDiagnostics.populated=facts;
  receipt.releaseBlockers.push('Scheduling Tasks populated/filtered scope regression blocked');
  console.error('BROWSER_QA_TASKS_POPULATED_FAILED '+JSON.stringify(facts));
 }finally{
  await taskConnection.close();
  stage='tasks-populated-cleanup';
  for(const entry of conflicts){
   await db.query('DELETE FROM paws.SessionAssignment WHERE SessionId=@id; DELETE FROM paws.Session WHERE SessionId=@id;',{id:entry.extraId});
  }
  const originalCount=await call(await emulatorToken(identities[0]),'/api/v1/sessions');
  assert.equal(originalCount.status,200);assert.deepEqual(originalCount.body.sessions.map(row=>String(row.id).toLowerCase()).sort(),allIds);
  console.log('BROWSER_QA_TASKS_FIXTURE_CLEANUP_OK');
 }
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
   const requestIds=new WeakMap();let nextRequestId=0;
   const requestId=request=>{if(!requestIds.has(request))requestIds.set(request,++nextRequestId);return requestIds.get(request);};
   const scriptNames=new Set(manifest.filter(file=>/^[A-Za-z0-9_-]+\.js$/.test(file)));
   const browserEvents=new Set(['firebase-auth-state','profile-event','access-invalidated','access-invalidated-after','window-error','unhandled-rejection']);
   const booleanKeys=['sessionEstablished','sameExpectedIdentity','gateLocked','accountControlPresent','gateSignInPresent','sessionGuardBlocked','guardCurrent','privateProfilePresent','privateFacultyPresent'];
   const stateKeys=value=>{
    if(!value||typeof value!=='object')return null;
    return {...Object.fromEntries(booleanKeys.map(key=>[key,typeof value[key]==='boolean'?value[key]:null])),
     guardGeneration:Number.isInteger(value.guardGeneration)?value.guardGeneration:null,cachedSessions:Number.isInteger(value.cachedSessions)?value.cachedSessions:null,cachedFaculty:Number.isInteger(value.cachedFaculty)?value.cachedFaculty:null};
   };
   await page.exposeBinding('__pawsQaEmit',(_source,value)=>{
    if(!value||!browserEvents.has(value.event))return;
    const frames=Array.isArray(value.frames)?value.frames.filter(f=>scriptNames.has(f?.script)&&Number.isInteger(f.line)&&Number.isInteger(f.column)).slice(0,8).map(f=>({script:f.script,line:f.line,column:f.column})):[];
    const branch=value.event==='access-invalidated'?frames.filter(f=>f.script==='effective-access-guard.js').map(f=>invalidationBranches.get(f.line)).find(Boolean)||'unresolved':null;
    const reason=['changed','unverified','password_required','signed_out'].includes(value.reason)?value.reason:null;
    const category=['null-property-read','null-property-write','undefined-property-read','undefined-property-write','not-a-function','network','other'].includes(value.category)?value.category:null;
    traceEvent(trace,value.event,{observedMs:Number.isFinite(value.at)?value.at-trace.startedAt:null,pageSequence:Number.isInteger(value.seq)?value.seq:null,reason,branch,
     errorName:value.name?safeName(value.name):null,errorCode:safeCode(value.code),category,frames,
     before:stateKeys(value.before),state:stateKeys(value.state)});
   });
   await page.addInitScript(({expectedUid,scripts})=>{
    const t={formSubmits:0,profileEvents:0,invalidated:null};window.__pawsQaLoginTrace=t;
    const allowed=new Set(scripts);
    const frames=stack=>typeof stack==='string'?[...stack.matchAll(/\/([A-Za-z0-9_-]+\.js):(\d+):(\d+)/g)].filter(m=>allowed.has(m[1])).slice(0,8).map(m=>({script:m[1],line:Number(m[2]),column:Number(m[3])})):[];
    const snapshot=()=>{
     const user=window.firebase?.apps?.length?firebase.auth().currentUser:null,guard=window.UCVM_EFFECTIVE_ACCESS?.guard;
     const generation=guard?.capture?.(),data=window.UCVM_PAGE_DATA;
     return {privateProfilePresent:!!data?.profile?.(),privateFacultyPresent:!!data?.faculty?.(),cachedSessions:data?.sessions?.().length??null,cachedFaculty:data?.facultyDirectory?.().length??null,
      sessionEstablished:!!user,sameExpectedIdentity:!!user&&user.uid===expectedUid,
      gateLocked:document.body?.classList.contains('auth-locked')===true,accountControlPresent:!!document.getElementById('account-toggle'),
      gateSignInPresent:!!document.getElementById('gate-sign-in'),sessionGuardBlocked:window.__ucvmSessionGuard?.blocked===true,
      guardGeneration:Number.isInteger(generation)?generation:null,guardCurrent:generation!==undefined?guard?.current?.(generation)===true:null};
    };
    let seq=0,previous=snapshot(),attached=false;
    const emit=(event,details={})=>{
     try{const state=snapshot(),before=previous;previous=state;
      // Observational binding only: do not await, change auth, or cancel events.
      void window.__pawsQaEmit({event,at:Date.now(),seq:++seq,before,state,...details}).catch(()=>{});
     }catch(_){}
    };
    const errorFacts=error=>{
     const message=typeof error?.message==='string'?error.message:'';
     const category=/Cannot read propert(?:y|ies) of null/i.test(message)?'null-property-read':/Cannot set propert(?:y|ies) of null/i.test(message)?'null-property-write':/Cannot read propert(?:y|ies) of undefined/i.test(message)?'undefined-property-read':/Cannot set propert(?:y|ies) of undefined/i.test(message)?'undefined-property-write':/is not a function/i.test(message)?'not-a-function':/failed to fetch|networkerror|network request failed/i.test(message)?'network':'other';
     const name=['Error','TypeError','ReferenceError','FirebaseError'].includes(error?.name)?error.name:'Error';
     const code=typeof error?.code==='string'&&/^(?:auth\/[a-z][a-z0-9-]{1,70}|[A-Z][A-Z0-9_]{1,70})$/.test(error.code)?error.code:null;
     return {name,code,category,frames:frames(error?.stack)};
    };
    window.__pawsQaObserveAuth=auth=>{
     if(attached)return;attached=true;
     // Same actual SDK instance; observe state changes without replacing any
     // method, intercepting a credential, or altering auth/guard decisions.
     auth.onAuthStateChanged(()=>emit('firebase-auth-state'),()=>emit('firebase-auth-state'));
    };
    document.addEventListener('submit',event=>{if(event.target?.id==='email-login-form')t.formSubmits++;},true);
    window.addEventListener('paws-profile',()=>{t.profileEvents++;emit('profile-event');});
    window.addEventListener('paws-access-invalidated',event=>{
     const reason=event.detail?.reason;
     t.invalidated=['unverified','changed','password_required','signed_out'].includes(reason)?reason:'other';
     // Synchronous stack identifies the guard caller at the original branch.
     emit('access-invalidated',{reason:t.invalidated,frames:frames(new Error().stack)});
     queueMicrotask(()=>emit('access-invalidated-after',{reason:t.invalidated}));
    });
    window.addEventListener('error',event=>emit('window-error',errorFacts(event.error)),true);
    window.addEventListener('unhandledrejection',event=>emit('unhandled-rejection',errorFacts(event.reason)));
   },{expectedUid:user.uid,scripts:[...scriptNames]});
   page.on('request',request=>{
    const label=endpointLabel(request.url());
    if(label)traceEvent(trace,'browser-request',{requestId:requestId(request),endpoint:label,method:request.method()});
   });
   page.on('response',async response=>{
    const label=endpointLabel(response.url());if(!label)return;
    const entry={requestId:requestId(response.request()),endpoint:label,method:response.request().method(),status:response.status()};
    traceEvent(trace,'browser-response-received',entry);
    const code=await responseCode(response);
    browserResponses.push({...entry,code});traceEvent(trace,'browser-response',{...entry,code});
   });
   page.on('requestfailed',request=>{
    const label=endpointLabel(request.url());if(label)traceEvent(trace,'browser-request-failed',{requestId:requestId(request),endpoint:label,method:request.method(),code:safeCode(request.failure()?.errorText)});
   });
   page.on('pageerror',error=>traceEvent(trace,'page-error',{name:safeName(error?.name),code:safeCode(error?.code),category:errorCategory(error),frames:safeFrames(error?.stack,scriptNames)}));
   page.on('console',message=>{
    if(!['error','warning'].includes(message.type()))return;
    const text=message.text();
    const category=text.includes('[Email sign-in]')?'email-sign-in':text.includes('[SQL access profile]')?'sql-access-profile':text.includes('[write capabilities]')?'write-capabilities':/CORS|Access-Control-Allow-Origin/i.test(text)?'cors':/failed to fetch|networkerror|network request failed/i.test(text)?'network':/firebase/i.test(text)?'firebase':'other';
    const match=text.match(/\bauth\/[a-z][a-z0-9-]{1,70}\b|\bnet::ERR_[A-Z0-9_]+\b|\b(?:SQL_UNAVAILABLE|SERVICE_UNAVAILABLE|PROFILE_REQUIRED|ROLE_DENIED|FACULTY_LINK_REQUIRED|ACCESS_CHANGED|SESSION_REAUTH_REQUIRED|TOKEN_REFRESH_FAILED|UNAUTHENTICATED|PASSWORD_CHANGE_REQUIRED|CORS_ORIGIN_DENIED|CORS_PREFLIGHT_DENIED)\b/);
    traceEvent(trace,'browser-console',{level:message.type(),category,code:safeCode(match?.[0])});
   });
   let priorAccess=null;
   // Read only equality/validity facts from the real response in memory.
   // Never emit the profile, role binding, actual identifiers or versions.
   function bindingObservation(label,body){
    if(label==='access-self'){
     const access=body?.access;if(!access||typeof access!=='object')return {present:false};
     const keys=['role','facultyId','version','scopeVersion','academicYear'];
     const next=Object.fromEntries(keys.map(key=>[key,access[key]||null]));
     const changed=priorAccess?keys.filter(key=>priorAccess[key]!==next[key]):[];
     const observation={present:true,allowed:access.allowed===true,ready:access.status==='ready',
      versionValid:typeof access.version==='string'&&/^[a-f0-9]{16}$/i.test(access.version),
      scopeVersionValid:access.scopeVersion==null||typeof access.scopeVersion==='string'&&/^[a-f0-9]{64}$/i.test(access.scopeVersion),
      comparable:priorAccess!==null,changed};
     priorAccess=next;return observation;
    }
    const profile=body?.profile;if(!profile||typeof profile!=='object')return {present:false};
    return {present:true,active:profile.active===true,passwordRequired:profile.mustChangePassword===true,comparable:priorAccess!==null,
     roleMatches:priorAccess?priorAccess.role===(profile.role||profile.baseRole||null):null,
     facultyMatches:priorAccess?priorAccess.facultyId===(profile.facultyId||null):null};
   }
   try{
    await context.route('**/*',async route=>{
     const u=new URL(route.request().url());
     if(u.origin===site||u.origin==='http://127.0.0.1:9099'||u.origin==='http://127.0.0.1:8080'){await route.continue();return;}
     if(u.origin===origin&&u.pathname.startsWith('/api/')){
      const label=endpointLabel(u.href)||'unclassified-api',id=requestId(route.request());
      traceEvent(trace,'proxy-forward',{requestId:id,endpoint:label,method:route.request().method(),target:'isolated-api'});
      try{
       // Keep the existing proxy behavior while diagnosing, including the
       // original request/response headers. Observe rather than repair blindly.
       const response=await route.fetch({url:api+u.pathname+u.search,maxRedirects:0});
       const headers=response.headers();
       traceEvent(trace,'proxy-response-received',{requestId:id,endpoint:label,method:route.request().method(),status:response.status()});
       if(response.status()===200&&['access-self','me'].includes(label)){
        try{traceEvent(trace,'access-binding-observation',{requestId:id,endpoint:label,...bindingObservation(label,await response.json())});}
        catch(_){traceEvent(trace,'access-binding-observation',{requestId:id,endpoint:label,present:false});}
       }
       traceEvent(trace,'proxy-response',{requestId:id,endpoint:label,method:route.request().method(),status:response.status(),corsMatches:headers['access-control-allow-origin']===site,corsPresent:!!headers['access-control-allow-origin'],code:await responseCode(response)});
       await route.fulfill({response});return;
      }catch(error){
       traceEvent(trace,'proxy-failed',{requestId:id,endpoint:label,method:route.request().method(),name:safeName(error?.name),code:safeCode(error?.code)});
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
    stage='browser-current-user:'+user.uid+':'+viewport.width;
    traceEvent(trace,'phase-start',{phase:'currentUser',...await browserState(page)});
    const identityView=await page.evaluate(async()=>{
     try{
      const profile=await window.UCVM_PAWS_DATA.currentUser();
      return {ok:true,role:profile.role,facultyId:profile.facultyId||null};
     }catch(error){return {ok:false,errorName:error?.name,errorCode:error?.code,status:Number.isInteger(error?.status)?error.status:null};}
    });
    if(!identityView.ok){
     traceEvent(trace,'read-rejected',{operation:'currentUser',name:safeName(identityView.errorName),code:safeCode(identityView.errorCode),status:identityView.status,...await browserState(page)});
     throw Object.assign(Error('currentUser rejected'),{code:safeCode(identityView.errorCode)||'QA_CURRENT_USER_REJECTED'});
    }
    assert.equal(identityView.role,user.role);
    assert.equal(String(identityView.facultyId||'').toLowerCase(),String(user.facultyId||'').toLowerCase());
    traceEvent(trace,'phase-complete',{phase:'currentUser',roleMatches:true,facultyMatches:true,...await browserState(page)});
    stage='browser-list-sessions:'+user.uid+':'+viewport.width;
    traceEvent(trace,'phase-start',{phase:'listSessions',...await browserState(page)});
    const sessionView=await page.evaluate(async()=>{
     try{
      const rows=await window.UCVM_PAWS_DATA.listSessions(),sessions=Array.isArray(rows)?rows:rows.sessions;
      return {ok:true,ids:sessions.map(r=>String(r.id).toLowerCase()).sort(),tokens:sessions.filter(r=>r.batchEditToken).length};
     }catch(error){return {ok:false,errorName:error?.name,errorCode:error?.code,status:Number.isInteger(error?.status)?error.status:null};}
    });
    if(!sessionView.ok){
     traceEvent(trace,'read-rejected',{operation:'listSessions',name:safeName(sessionView.errorName),code:safeCode(sessionView.errorCode),status:sessionView.status,...await browserState(page)});
     throw Object.assign(Error('listSessions rejected'),{code:safeCode(sessionView.errorCode)||'QA_LIST_SESSIONS_REJECTED'});
    }
    traceEvent(trace,'phase-complete',{phase:'listSessions',rowCount:sessionView.ids.length,batchTokenCount:sessionView.tokens,...await browserState(page)});
    stage='browser-role-and-viewport:'+user.uid+':'+viewport.width;
    const surface=await page.evaluate(()=>({
     selection:!document.getElementById('selection-controls')?.classList.contains('hidden'),
     firebaseProject:firebase.app().options.projectId,viewportWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth
    }));
    const view={...identityView,...sessionView,...surface};
    assert.equal(view.firebaseProject,project);assert.equal(view.role,user.role);
    assert.equal(String(view.facultyId||'').toLowerCase(),String(user.facultyId||'').toLowerCase());
    assert.deepEqual(view.ids,scoped.has(user.role)?[user.sessionId.toLowerCase()]:expectedAll);
    assert.equal(view.tokens,admins.has(user.role)?expectedAll.length:0);
    assert.equal(view.selection,admins.has(user.role));
    if(officeOnly.has(user.role)){
     stage='browser-office-capabilities:'+user.uid+':'+viewport.width;
     const capabilities=await page.evaluate(async()=>{
      const data=window.UCVM_PAWS_DATA,guard=window.UCVM_EFFECTIVE_ACCESS.guard;
      const response=await data.refreshWriteCapabilities();
      return {flags:Object.fromEntries(['sessionEdit','sessionBatchEdit','sessionCreate','afcSingle','afcBatch','requestLifecycle','decisions','approvedArtifactCreation','dateChange'].map(key=>[key,response[key]])),
       guardCurrent:guard.current(guard.capture()),authenticated:!!firebase.auth().currentUser,unlocked:!document.body.classList.contains('auth-locked')};
     });
     assert.deepEqual(capabilities,{flags:officeCapabilities,guardCurrent:true,authenticated:true,unlocked:true});
     result.checks.officeCapabilitiesReadOnly=true;
     traceEvent(trace,'office-capabilities-accepted',{allNineFalse:true,guardCurrent:true,authenticated:true,unlocked:true});
    }
    result.checks.roleAndSessionScope=true;result.checks.batchTokenAndControls=true;
    result.viewportWidth=view.viewportWidth;result.scrollWidth=view.scrollWidth;
    result.checks.viewportNoPageOverflow=view.scrollWidth<=view.viewportWidth+1;
    assert.equal(result.checks.viewportNoPageOverflow,true);
    traceEvent(trace,'phase-complete',{phase:'role-and-viewport',...await browserState(page)});
    // Anonymous and role-denied writes are verified against the actual API,
    // using the browser-issued emulator token. No synthetic write occurs here.
    if(!admins.has(user.role)){
     stage='browser-forbidden-write:'+user.uid+':'+viewport.width;
     const denied=await page.evaluate(async()=>{
      const token=await firebase.auth().currentUser.getIdToken();
      const response=await fetch('https://paws-pr171-qa.invalid/api/v1/sessions/batch-edit',{method:'POST',headers:{Authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({edits:[]})});
      return {status:response.status,code:(await response.json()).error?.code};
     });
     assert.deepEqual(denied,{status:403,code:'ROLE_DENIED'});result.checks.forbiddenWrite=true;
    }
    // Verify the actual startup network traffic, not just that a mock source
    // selector returned false. All allowed sources must still answer 200;
    // no office account may issue an AFC-list GET during normal Calendar use.
    stage='browser-notification-sources:'+user.uid+':'+viewport.width;
    const matchesRead=(event,endpoint)=>event.endpoint===endpoint&&event.method==='GET';
    async function verifyNotificationSources(from=0){
     const events=()=>trace.slice(from);
     await waitTrace(()=>events().find(event=>event.event==='browser-response'&&matchesRead(event,'swaps/queue')&&event.status===200),15000);
     if(!officeOnly.has(user.role)){
      await waitTrace(()=>events().find(event=>event.event==='browser-response'&&matchesRead(event,'afc-requests')&&event.status===200),15000);
     }
     const afcGets=events().filter(event=>event.event==='browser-request'&&matchesRead(event,'afc-requests')).length;
     const swapReads=events().filter(event=>event.event==='browser-response'&&matchesRead(event,'swaps/queue')&&event.status===200).length;
     if(officeOnly.has(user.role))assert.equal(afcGets,0,'Office notification startup must never request AFC list');
     else assert.ok(afcGets>0,'Eligible AFC notification read must remain present');
     const state=await page.evaluate(()=>{
      const guard=window.UCVM_EFFECTIVE_ACCESS.guard;
      return {guardCurrent:guard.current(guard.capture()),authenticated:!!firebase.auth().currentUser,unlocked:!document.body.classList.contains('auth-locked')};
     });
     assert.deepEqual(state,{guardCurrent:true,authenticated:true,unlocked:true});
     return {afcGets,swapReads,afcExpected:!officeOnly.has(user.role),...state};
    }
    const notificationReads=await verifyNotificationSources();
    result.notificationSources=notificationReads;
    result.checks.notificationSources=true;
    traceEvent(trace,'notification-sources-accepted',notificationReads);
    // The old stage label covered all these operations. Explicitly distinguish
    // the test's intended sign-out from any earlier spontaneous session loss.
    stage='browser-screenshot:'+user.uid+':'+viewport.width;
    traceEvent(trace,'phase-start',{phase:'screenshot',...await browserState(page)});
    await page.screenshot({path:path.join(out,user.uid+'-'+viewport.width+'.png')});
    traceEvent(trace,'phase-complete',{phase:'screenshot',...await browserState(page)});
    async function productSignoutAndVerify(label){
     stage='browser-logout-cache-before:'+user.uid+':'+viewport.width+':'+label;
     // Establish that the actual page has private data to clear, not just
     // that a fresh unauthenticated page starts empty.
     const before=await page.evaluate(async()=>{
      const data=window.UCVM_PAGE_DATA,rows=await data.allSessions();
      return {documentEpoch:performance.timeOrigin,sessionEstablished:!!firebase.auth().currentUser,
       privateProfilePresent:!!data.profile(),cachedSessions:data.sessions().length,loadedSessions:rows.length};
     });
     assert.equal(before.sessionEstablished,true);assert.equal(before.privateProfilePresent,true);
     assert.equal(before.loadedSessions,scoped.has(user.role)?1:expectedAll.length);
     assert.equal(before.cachedSessions,before.loadedSessions);
     traceEvent(trace,'logout-private-cache-before',{label,sessionEstablished:true,privateProfilePresent:true,cachedSessions:before.cachedSessions});
     stage='browser-product-signout:'+user.uid+':'+viewport.width+':'+label;
     await page.locator('#account-toggle').click();
     await page.locator('#logout-btn').waitFor({state:'visible'});
     const traceStart=trace.length;
     traceEvent(trace,'qa-signout-requested',{label,via:'product-logout-button',...await browserState(page)});
     // A real click, no SDK signOut call or forced navigation from QA.
     await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded',timeout:30000}),page.locator('#logout-btn').click()]);
     stage='browser-signed-out-gate:'+user.uid+':'+viewport.width+':'+label;
     await page.locator('#gate-sign-in').waitFor({state:'visible'});
     await page.waitForFunction(()=>window.firebase?.apps?.length&&firebase.auth().currentUser===null&&document.body.classList.contains('auth-locked')&&!!window.UCVM_PAGE_DATA);
     const clean=await page.evaluate(async()=>{
      const data=window.UCVM_PAGE_DATA,guard=window.UCVM_EFFECTIVE_ACCESS?.guard,body=document.body;
      return {documentEpoch:performance.timeOrigin,sessionEstablished:!!firebase.auth().currentUser,
       privateProfilePresent:!!data.profile(),privateFacultyPresent:!!data.faculty(),
       cachedSessions:data.sessions().length,cachedFaculty:data.facultyDirectory().length,allSessions:(await data.allSessions()).length,
       gateLocked:body.classList.contains('auth-locked'),privateFixtureTextPresent:/Synthetic (?:QA|Faculty|session|Browser QA)/i.test(body.innerText),
       selectionHidden:document.getElementById('selection-controls')?.classList.contains('hidden')===true,
       accountSignedOut:document.getElementById('account-toggle')?.textContent.trim()==='Sign in',
       guardCurrent:!!guard&&guard.current(guard.capture()),supportContextAbsent:sessionStorage.getItem('paws-support-context-v1')===null};
     });
     assert.notEqual(clean.documentEpoch,before.documentEpoch);
     assert.deepEqual({...clean,documentEpoch:0},{documentEpoch:0,sessionEstablished:false,privateProfilePresent:false,privateFacultyPresent:false,cachedSessions:0,cachedFaculty:0,allSessions:0,gateLocked:true,privateFixtureTextPresent:false,selectionHidden:true,accountSignedOut:true,guardCurrent:true,supportContextAbsent:true});
     const oldClear=trace.slice(traceStart).find(event=>event.event==='access-invalidated-after'&&event.reason==='signed_out');
     // The navigation may retire the old document before its asynchronous
     // observer binding is delivered. VM regression proves terminal ordering;
     // the fresh document and all data checks above remain mandatory.
     if(oldClear){assert.equal(oldClear.state?.guardCurrent,false);assert.equal(oldClear.state?.privateProfilePresent,false);assert.equal(oldClear.state?.cachedSessions,0);}
     traceEvent(trace,'logout-private-cache-cleared',{label,freshDocument:true,oldDocumentObservation:!!oldClear,sessionEstablished:false,cachedSessions:0,cachedFaculty:0,privateProfilePresent:false,privateFixtureTextPresent:false});
     stage='browser-anonymous-api:'+user.uid+':'+viewport.width+':'+label;
     const denied=await page.evaluate(async()=>{
      const out=[];
      for(const route of ['access/self','me','sessions']){
       const response=await fetch('https://paws-pr171-qa.invalid/api/v1/'+route,{credentials:'omit'});
       const body=await response.json();
       out.push({status:response.status,code:body.error?.code,hasPrivate:Object.hasOwn(body,'profile')||Object.hasOwn(body,'access')||Object.hasOwn(body,'sessions')});
      }
      return out;
     });
     assert.deepEqual(denied,Array.from({length:3},()=>({status:401,code:'UNAUTHENTICATED',hasPrivate:false})));
     assert.equal(trace.slice(traceStart).some(event=>['page-error','window-error','unhandled-rejection'].includes(event.event)&&(event.name==='TypeError'||event.errorName==='TypeError')),false,'No TypeError during logout/return to login');
     assert.equal(await page.evaluate(()=>firebase.auth().currentUser),null);
     traceEvent(trace,'product-signout-accepted',{label,freshDocument:true,privateDataCleared:true,anonymousDenied:true,typeError:false});
    }
    await productSignoutAndVerify('initial');
    result.checks.signOutCleanup=true;result.checks.anonymousApiDenied=true;result.checks.privateDataCleared=true;
    // Check the entire normal visit, including asynchronous work through
    // logout, before the separately labeled deliberate rejection probe.
    if(officeOnly.has(user.role)){
     assert.equal(trace.filter(event=>event.event==='browser-request'&&matchesRead(event,'afc-requests')).length,0);
     result.checks.noForbiddenAfcRead=true;
    }
    if(receipt.roles.length===1){
     stage='browser-relogin:'+user.uid+':'+viewport.width;
     await page.locator('#gate-sign-in').click();
     await page.locator('#choose-email').click();
     await page.locator('#login-email').fill(user.email);
     await page.locator('#login-password').fill(password);
     await page.locator('#email-login-submit').click();
     await page.waitForFunction(uid=>window.firebase?.apps?.length&&firebase.auth().currentUser?.uid===uid,user.uid,{timeout:20000});
     await page.waitForFunction(role=>document.getElementById('account-toggle')?.textContent.trim().endsWith(' - '+role),user.role,{timeout:30000});
     await page.waitForFunction(()=>!document.body.classList.contains('auth-locked'),null,{timeout:30000});
     const again=await page.evaluate(async()=>{
      const p=await window.UCVM_PAWS_DATA.currentUser(),rows=await window.UCVM_PAWS_DATA.listSessions(),sessions=Array.isArray(rows)?rows:rows.sessions;
      return {role:p.role,ids:sessions.map(row=>String(row.id).toLowerCase()).sort(),tokens:sessions.filter(row=>row.batchEditToken).length};
     });
     assert.equal(again.role,user.role);assert.deepEqual(again.ids,expectedAll);assert.equal(again.tokens,expectedAll.length);
     traceEvent(trace,'product-relogin-accepted',{sameRole:true,sessionCount:again.ids.length,batchTokenCount:again.tokens});
     result.checks.relogin=true;
     await productSignoutAndVerify('after-relogin');
    }
    if(user.role==='adc'&&viewport.width===1440){
     // Extra denial regression AFTER the normal ADC desktop logout has
     // passed. This is not part of notification startup or a new capability.
     // Use the real login UI and actual product data client (not raw fetch
     // or a mocked denial) to prove a genuine 403 still blocks old access.
     stage='browser-real-denial-relogin:'+user.uid+':'+viewport.width;
     const visitStart=trace.length;
     await page.locator('#gate-sign-in').click();
     await page.locator('#choose-email').click();
     await page.locator('#login-email').fill(user.email);
     await page.locator('#login-password').fill(password);
     await page.locator('#email-login-submit').click();
     await page.waitForFunction(uid=>window.firebase?.apps?.length&&firebase.auth().currentUser?.uid===uid,user.uid,{timeout:20000});
     await page.waitForFunction(role=>document.getElementById('account-toggle')?.textContent.trim().endsWith(' - '+role),user.role,{timeout:30000});
     await page.waitForFunction(()=>!document.body.classList.contains('auth-locked'),null,{timeout:30000});
     await verifyNotificationSources(visitStart);
     const before=await page.evaluate(async()=>{
      const data=window.UCVM_PAGE_DATA,guard=window.UCVM_EFFECTIVE_ACCESS.guard;
      await data.allSessions();
      return {privateProfilePresent:!!data.profile(),cachedSessions:data.sessions().length,guardCurrent:guard.current(guard.capture())};
     });
     assert.deepEqual(before,{privateProfilePresent:true,cachedSessions:expectedAll.length,guardCurrent:true});
     assert.equal(trace.slice(visitStart).filter(event=>event.event==='browser-request'&&matchesRead(event,'afc-requests')).length,0);
     stage='browser-real-role-denial:'+user.uid+':'+viewport.width;
     const denialStart=trace.length;
     const denied=await page.evaluate(async()=>{
      try{await window.UCVM_PAWS_DATA.listAfcRequests();return {unexpectedSuccess:true};}
      catch(error){return {status:error?.status,code:error?.code};}
     });
     assert.deepEqual(denied,{status:403,code:'ROLE_DENIED'});
     await page.getByRole('alert').getByRole('heading',{name:'Your access has changed',exact:true}).waitFor({state:'visible'});
     const rejection=await waitTrace(()=>trace.slice(denialStart).find(event=>event.event==='browser-response'&&matchesRead(event,'afc-requests')&&event.status===403&&event.code==='ROLE_DENIED'),15000);
     await waitTrace(()=>trace.slice(denialStart).find(event=>event.event==='access-invalidated'&&event.reason==='changed'&&event.branch==='api-revocation-error'),15000);
     const cleared=await page.evaluate(async()=>{
      const data=window.UCVM_PAGE_DATA,guard=window.UCVM_EFFECTIVE_ACCESS.guard;
      let subsequent;
      try{await window.UCVM_PAWS_DATA.currentUser();subsequent='unexpected-success';}catch(error){subsequent=error?.code;}
      return {guardCurrent:guard.current(guard.capture()),privateProfilePresent:!!data.profile(),cachedSessions:data.sessions().length,cachedFaculty:data.facultyDirectory().length,subsequent};
     });
     assert.deepEqual(cleared,{guardCurrent:false,privateProfilePresent:false,cachedSessions:0,cachedFaculty:0,subsequent:'ACCESS_CHANGED'});
     result.checks.realRoleDenialBlocks=true;
     receipt.realRoleDenial={status:'passed',role:'adc',viewport:1440,normalVisitCompleted:true,httpStatus:rejection.status,errorCode:rejection.code,oldGuardBlocked:true,privateDataCleared:true,subsequentReadDenied:true};
     console.log('BROWSER_QA_REAL_ROLE_DENIAL '+JSON.stringify(receipt.realRoleDenial));
     // Synthetic browser context is discarded in finally; its ordinary
     // product-button signout was already independently accepted above.
    }
    assert.notEqual(trace.overflow,true,'Diagnostic trace must be complete.');
    result.status='passed';
   }catch(error){
    result.status='failed';result.failure=fail(error);receipt.failures.push(result.failure);
    result.lastBrowserState=await browserState(page);
    traceEvent(trace,'phase-failed',{failure:result.failure,state:result.lastBrowserState});
    // Do not capture a failed login page: it may still contain a password.
    console.error('BROWSER_QA_ROLE_FAILED '+JSON.stringify({role:user.role,account:user.uid,viewport:viewport.width,...result.failure}));
   }finally{
    // Only known categories are reported, not arbitrary URL components.
    result.blockedOrigins=[...blocked].sort();result.traceOverflow=trace.overflow===true;await context.close();activeTrace=null;
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
 const tasksPassed=receipt.schedulingTaskDiagnostics.sql.every(row=>row.status==='passed')&&receipt.schedulingTaskDiagnostics.http.every(row=>row.readPassed)&&receipt.schedulingTaskDiagnostics.populated.status==='passed';
 console.log('PR171_TASKS_DIAGNOSTIC_SUMMARY '+JSON.stringify({sql:receipt.schedulingTaskDiagnostics.sql.map(({phase,status})=>({phase,status})),http:receipt.schedulingTaskDiagnostics.http,populated:receipt.schedulingTaskDiagnostics.populated.status,reviewGateUnchanged:true,passed:tasksPassed}));
 assert.equal(receipt.officeCapabilityChecks.length,2);
 assert.equal(receipt.roles.filter(row=>officeOnly.has(row.role)&&row.checks.officeCapabilitiesReadOnly===true).length,4);
 assert.equal(receipt.roles.filter(row=>row.checks.notificationSources===true).length,18);
 assert.equal(receipt.roles.filter(row=>officeOnly.has(row.role)&&row.checks.noForbiddenAfcRead===true).length,4);
 assert.equal(receipt.realRoleDenial?.status,'passed');
 console.log('BROWSER_QA_NOTIFICATION_MATRIX_OK '+JSON.stringify({allCases:18,officeNoAfcReads:4,otherEligibleAfcReads:14,swapAllCases:18,realDenialBlocked:true}));
 assert.equal(tasksPassed,true,'Independent Tasks read-contract acceptance must pass; no false conflict-free success.');
}
main().catch(error=>{
 receipt.failure=fail(error);console.error('BROWSER_QA_FAILED '+JSON.stringify(receipt.failure));process.exitCode=1;
}).finally(async()=>{
 await browser?.close().catch(()=>{});
 await Promise.allSettled(servers.map(server=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections?.();})));
 await Promise.allSettled([runtime?.close(),db.close(),...admin.apps.map(app=>app.delete())]);
 fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
});
