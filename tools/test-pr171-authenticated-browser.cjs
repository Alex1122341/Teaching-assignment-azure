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
const sha='343f04b06f7360d0b5ee3b1ab0c9d8bda4a6ded8';
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
assert.equal(execFileSync('git',['merge-base','--is-ancestor',sha,'HEAD'],{cwd:root}).length,0);
const container=JSON.parse(execFileSync('docker',['inspect','paws-calendar-pr171-browser'],{encoding:'utf8'}))[0];
assert.equal(container.Config.Labels['paws.calendar-test'],'1');
assert.equal(container.State.Running,true);
assert.deepEqual(container.NetworkSettings.Ports['1433/tcp'],[{HostIp:'127.0.0.1',HostPort:'14339'}]);
const sql=require('../server/node_modules/mssql');
const admin=require('../server/node_modules/firebase-admin');
const {createSqlConnection}=require('../server/src/data/sql-connection');
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
const receipt={product:sha,qa:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),project,environment:'ephemeral runner; synthetic data and emulator auth',roles:[],failures:[],limits:['No University Staging or live identity','SDK configuration and API origin adapted in QA response only','HICC/VISC base-role checks do not establish appointment/package scope','Mobile is a Chromium viewport, not a physical device','Four generic annual rule previews only; complete annual reconciliation is not covered']};
let stage='marker',browser,runtime;
const fail=error=>({stage,name:error?.name||'Error',code:error?.code||null,number:error?.number??error?.originalError?.info?.number??null});
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
  PAWS_RELEASE_SHA:receipt.qa,PAWS_RUNTIME_TRUST_ANCHOR:sha,PAWS_API_HOST:'127.0.0.1',
  PAWS_SESSION_EDIT_WRITE_ENABLED:'true',PAWS_SESSION_BATCH_EDIT_ENABLED:'true'};
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
 const api=await listen(createUniversityHttpServer({runtime,env,logger:{error:()=>console.log('BROWSER_QA_HTTP_ERROR')}}));
 const noAuth=await fetch(api+'/api/v1/me');assert.equal(noAuth.status,401);
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
   try{
    await context.route('**/*',async route=>{
     const u=new URL(route.request().url());
     if(u.origin===site||u.origin==='http://127.0.0.1:9099'||u.origin==='http://127.0.0.1:8080'){await route.continue();return;}
     if(u.origin===origin&&u.pathname.startsWith('/api/')){
      const response=await route.fetch({url:api+u.pathname+u.search,maxRedirects:0});
      await route.fulfill({response});return;
     }
     if(u.origin==='https://www.gstatic.com'&&u.pathname.startsWith('/firebasejs/9.23.0/')){
      const name=path.basename(u.pathname);
      if(sdkFiles.has(name)){
       let body=fs.readFileSync(path.join(sdkRoot,name),'utf8');
       if(name==='firebase-firestore-compat.js')body+=emulatorBoot;
       await route.fulfill({status:200,contentType:mime['.js'],body});return;
      }
     }
     blocked.add(u.origin);await route.abort('blockedbyclient');
    });
    stage='browser-login:'+user.uid+':'+viewport.width;
    await page.goto(site+'/',{waitUntil:'domcontentloaded'});
    await page.locator('#gate-sign-in').waitFor({state:'visible'});
    await page.locator('#gate-sign-in').click();
    await page.locator('#choose-email').click();
    await page.locator('#login-email').fill(user.email);
    await page.locator('#login-password').fill(password);
    await page.locator('#email-login-submit').click();
    await page.waitForFunction(role=>document.getElementById('account-toggle')?.textContent.trim().endsWith(' - '+role),user.role,{timeout:60000});
    await page.waitForFunction(()=>!document.body.classList.contains('auth-locked'),null,{timeout:60000});
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
    // Do not capture a failed login page: it may still contain a password.
    console.error('BROWSER_QA_ROLE_FAILED '+JSON.stringify({role:user.role,account:user.uid,viewport:viewport.width,...result.failure}));
   }finally{
    result.blockedOrigins=[...blocked].sort();await context.close();
    console.log('BROWSER_QA_ROLE '+JSON.stringify(result));
   }
  }
 }
 assert.equal(receipt.roles.length,18);
 assert.equal(receipt.failures.length,0,'One or more browser role/viewport checks failed.');
 console.log('PR171_ISOLATED_AUTHENTICATED_BROWSER_OK');
}
main().catch(error=>{
 receipt.failure=fail(error);console.error('BROWSER_QA_FAILED '+JSON.stringify(receipt.failure));process.exitCode=1;
}).finally(async()=>{
 await browser?.close().catch(()=>{});
 await Promise.allSettled(servers.map(server=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections?.();})));
 await Promise.allSettled([runtime?.close(),db.close(),...admin.apps.map(app=>app.delete())]);
 fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
});
