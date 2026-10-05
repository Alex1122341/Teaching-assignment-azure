'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const API_ORIGIN=require('../paws-api-origin.js').apiOrigin;
const {createPawsAzureDataClient}=require('../paws-data-client.js');

test('PAWS client is fixed to VetMed-Ops mode and exposes no backend selector or legacy write capability',()=>{
  const source=fs.readFileSync('paws-data-client.js','utf8');
  const client=createPawsAzureDataClient({fetchImpl:async()=>({ok:true,json:async()=>({})}),tokenProvider:async()=>'t'});
  assert.equal(client.sessionBackend(),'vetmed-ops');
  assert.equal(client.sessionWritesEnabled(),false);
  assert.doesNotMatch(source,/firestore/i);
  assert.doesNotMatch(source,/UCVM_PAWS_SESSION_BACKEND|backend\s*:\s*['\"]/i);
});

test('current user and sessions use the University-origin bearer GET requests',async()=>{
  const calls=[];
  const origin=API_ORIGIN;
  const client=createPawsAzureDataClient({
    tokenProvider:async()=>'firebase-id-token',
    fetchImpl:async(url,init)=>{
      calls.push({url,init});
      if(url===origin+'/api/v1/me')return{ok:true,json:async()=>({profile:{role:'viewer'}})};
      return{ok:true,json:async()=>({sessions:[{id:'1'}]})};
    }
  });
  assert.equal((await client.currentUser()).role,'viewer');
  assert.deepEqual(await client.listSessions({start:'2026-09-01',end:'2026-09-08'}),[{id:'1'}]);
  assert.equal(calls[0].url,origin+'/api/v1/me');
  assert.match(calls[1].url,new RegExp('^'+origin.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\/api\\/v1\\/sessions\\?'));
  for(const call of calls){
    assert.equal(call.init.method,'GET');
    assert.equal(call.init.headers.Authorization,'Bearer firebase-id-token');
    assert.equal(call.init.credentials,'omit');
  }
});

test('missing token and API failures fail closed without alternate data source',async()=>{
  let called=false;
  const noToken=createPawsAzureDataClient({tokenProvider:async()=>'',fetchImpl:async()=>{called=true;throw new Error('should not call')}});
  await assert.rejects(noToken.currentUser(),e=>e.code==='UNAUTHENTICATED');
  assert.equal(called,false);

  const failed=createPawsAzureDataClient({
    tokenProvider:async()=>'x',
    fetchImpl:async()=>({ok:false,status:403,json:async()=>({error:{code:'PROFILE_REQUIRED',message:'No SQL profile'}})})
  });
  await assert.rejects(failed.listSessions(),e=>e.code==='PROFILE_REQUIRED'&&e.status===403);
});

test('Dashboard summary uses the bearer GET endpoint and returns a deterministic summary object',async()=>{
  const calls=[];
  const client=createPawsAzureDataClient({
    tokenProvider:async()=>'dashboard-token',
    fetchImpl:async(url,init)=>{calls.push({url,init});return{ok:true,json:async()=>({summary:{activeFacultyCount:120,hiccCount:64,viscCount:35}})}}
  });
  assert.deepEqual(await client.dashboardSummary(),{activeFacultyCount:120,hiccCount:64,viscCount:35});
  assert.equal(calls[0].url,`${API_ORIGIN}/api/v1/dashboard/summary`);
  assert.equal(calls[0].init.method,'GET');
  assert.equal(calls[0].init.headers.Authorization,'Bearer dashboard-token');
  assert.equal(calls[0].init.credentials,'omit');
});

test('Dashboard summary omits blank academic year and query-encodes a supplied year',async()=>{
  const urls=[];
  const client=createPawsAzureDataClient({
    tokenProvider:async()=>'t',
    fetchImpl:async url=>{urls.push(url);return{ok:true,json:async()=>({})}}
  });
  assert.deepEqual(await client.dashboardSummary({academicYear:'  '}),{});
  assert.deepEqual(await client.dashboardSummary({academicYear:'2026-27'}),{});
  assert.equal(urls[0],`${API_ORIGIN}/api/v1/dashboard/summary`);
  assert.equal(urls[1],`${API_ORIGIN}/api/v1/dashboard/summary?academicYear=2026-27`);
});

test('Dashboard faculty query safely encodes reserved search characters and returns only the roster array',async()=>{
  let request;
  const client=createPawsAzureDataClient({
    tokenProvider:async()=>'t',
    fetchImpl:async(url,init)=>{request={url,init};return{ok:true,json:async()=>({faculty:[{facultyId:'F1'}],ignored:true})}}
  });
  assert.deepEqual(await client.dashboardFaculty({academicYear:'2026-27',search:'A% &= B',limit:25}),[{facultyId:'F1'}]);
  assert.equal(request.url,`${API_ORIGIN}/api/v1/dashboard/faculty?academicYear=2026-27&search=A%25+%26%3D+B&limit=25`);
  assert.equal(request.init.method,'GET');
});

test('Dashboard faculty returns an empty roster when the response shape is missing',async()=>{
  const client=createPawsAzureDataClient({tokenProvider:async()=>'t',fetchImpl:async()=>({ok:true,json:async()=>({faculty:null})})});
  assert.deepEqual(await client.dashboardFaculty(),[]);
});

test('Dashboard detail requires a faculty id, encodes the path segment, and preserves the complete body',async()=>{
  let url='';
  const response={faculty:{facultyId:'F/1 ?'},roles:[],afcRecords:[],teachingAssignments:[],academicYear:'2026/27'};
  const client=createPawsAzureDataClient({tokenProvider:async()=>'t',fetchImpl:async value=>{url=value;return{ok:true,json:async()=>response}}});
  await assert.rejects(client.dashboardFacultyById('  '),/facultyId is required/i);
  assert.equal(await client.dashboardFacultyById('F/1 ?',{academicYear:'2026/27'}),response);
  assert.equal(url,`${API_ORIGIN}/api/v1/dashboard/faculty/F%2F1%20%3F?academicYear=2026%2F27`);
});

test('Dashboard methods preserve API status, code, and server message without a fallback',async()=>{
  // B2A1: 401 now triggers one forced token refresh + retry; a second 401 becomes SESSION_REAUTH_REQUIRED.
  for(const [status,code] of [[400,'INVALID_ACADEMIC_YEAR'],[403,'ROLE_DENIED'],[404,'FACULTY_NOT_FOUND'],[503,'SQL_UNAVAILABLE']]){
    const client=createPawsAzureDataClient({
      tokenProvider:async()=>'t',
      fetchImpl:async()=>({ok:false,status,json:async()=>({error:{code,message:`failure ${status}`}})})
    });
    await assert.rejects(client.dashboardSummary(),error=>error.status===status&&error.code===code&&error.message===`failure ${status}`);
  }
  // 401 path: first 401 -> refresh -> second 401 -> SESSION_REAUTH_REQUIRED (status preserved).
  let calls=0;
  const client401=createPawsAzureDataClient({
    tokenProvider:async(opts)=>(opts&&opts.forceRefresh?'refreshed':'normal'),
    fetchImpl:async()=>{calls++;return{ok:false,status:401,json:async()=>({error:{code:'UNAUTHENTICATED',message:'failure 401'}})};}
  });
  await assert.rejects(client401.dashboardSummary(),error=>error.status===401&&error.code==='SESSION_REAUTH_REQUIRED');
  assert.equal(calls,2,'exactly two attempts for double-401');
});

test('Dashboard aggregate methods use lazy read-only endpoints and preserve response shapes',async()=>{
  const calls=[];
  const client=createPawsAzureDataClient({
    tokenProvider:async()=>'t',
    fetchImpl:async(url,init)=>{
      calls.push({url,init});
      if(url.includes('/teaching-summary'))return{ok:true,json:async()=>({teachingSummary:[{facultyId:'f1',recordedDoeTotal:3}]})};
      if(url.includes('/roles'))return{ok:true,json:async()=>({roles:[{roleType:'VISC'}]})};
      return{ok:true,json:async()=>({doeOverview:{partial:true}})};
    }
  });
  assert.deepEqual(await client.dashboardTeachingSummary({academicYear:'2026-27'}),[{facultyId:'f1',recordedDoeTotal:3}]);
  assert.deepEqual(await client.dashboardRoles({academicYear:'2026-27'}),[{roleType:'VISC'}]);
  assert.deepEqual(await client.dashboardDoeOverview({academicYear:'2026-27'}),{partial:true});
  assert.deepEqual(calls.map(call=>call.url),[
    `${API_ORIGIN}/api/v1/dashboard/teaching-summary?academicYear=2026-27`,
    `${API_ORIGIN}/api/v1/dashboard/roles?academicYear=2026-27`,
    `${API_ORIGIN}/api/v1/dashboard/doe-overview?academicYear=2026-27`
  ]);
  for(const call of calls){
    assert.equal(call.init.method,'GET');
    assert.equal(call.init.credentials,'omit');
    assert.equal(call.init.headers.Authorization,'Bearer t');
  }
});

test('Dashboard client exposes explicit AFC methods without Firestore fallback',()=>{
  const source=fs.readFileSync('paws-data-client.js','utf8');
  const client=createPawsAzureDataClient({tokenProvider:async()=>'t',fetchImpl:async()=>({ok:true,json:async()=>({})})});
  assert.deepEqual(Object.keys(client).sort(),[
    'approveAfcRequest','createApprovedAfcArtifact','createDashboardAfcManualBatch','createDashboardAfcRecord','currentUser','dashboardAfcRecords','dashboardDoeOverview','dashboardFaculty','dashboardFacultyById','dashboardRoles','dashboardSummary','dashboardTeachingSummary','getApprovedAfcArtifact','listAfcRequests','listSessions','patchSession','recommendAfcRequest','rejectAfcRequest','sessionBackend','sessionEditEnabled','sessionWritesEnabled','submitAfcRequest','withdrawAfcRequest'
  ]);
  assert.doesNotMatch(source,/firestore/i);
});

test('existing-session scalar edits use the authenticated University API PATCH route',async()=>{
  const calls=[];
  const client=createPawsAzureDataClient({
    tokenProvider:async()=>'session-edit-token',
    fetchImpl:async(url,init)=>{calls.push({url,init});return{ok:true,json:async()=>({session:{id:'s1',topic:'Updated'}})}}
  });
  assert.equal(client.sessionEditEnabled(),true);
  assert.deepEqual(await client.patchSession('session/1',{topic:'Updated',room:'VET 123'}),{id:'s1',topic:'Updated'});
  assert.equal(calls[0].url,`${API_ORIGIN}/api/v1/sessions/session%2F1`);
  assert.equal(calls[0].init.method,'PATCH');
  assert.equal(calls[0].init.credentials,'omit');
  assert.equal(calls[0].init.headers.Authorization,'Bearer session-edit-token');
  assert.deepEqual(JSON.parse(calls[0].init.body),{topic:'Updated',room:'VET 123'});
});

test('session PATCH replays once only after explicit 401 and never on other failures', async () => {
  const requests = [];
  const tokenOptions = [];
  const client = createPawsAzureDataClient({
    tokenProvider: async options => { tokenOptions.push(options?.forceRefresh === true); return options?.forceRefresh ? 'fresh' : 'initial'; },
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return requests.length === 1
        ? { ok: false, status: 401, json: async () => ({ error: { code: 'UNAUTHENTICATED' } }) }
        : { ok: true, status: 200, json: async () => ({ session: { id: 's1' } }) };
    }
  });
  await client.patchSession('s1', { topic: 'Updated' });
  assert.deepEqual(tokenOptions, [false, true]);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests.map(request => JSON.parse(request.init.body)), [{ topic: 'Updated' }, { topic: 'Updated' }]);

  for (const status of [403, 409, 500, 503]) {
    let calls = 0, tokens = 0;
    const failing = createPawsAzureDataClient({
      tokenProvider: async options => { tokens++; return options?.forceRefresh ? 'fresh' : 'initial'; },
      fetchImpl: async () => { calls++; return { ok: false, status, json: async () => ({ error: { code: 'NO_REPLAY' } }) }; }
    });
    await assert.rejects(failing.patchSession('s1', { topic: 'Updated' }), error => error.code === 'NO_REPLAY');
    assert.equal(calls, 1, `PATCH must not replay after ${status}`);
    assert.equal(tokens, 1, `PATCH must not force-refresh after ${status}`);
  }
});

test('B1 client uses explicit AFC GET and POST methods with business fields only', async () => {
  const calls = [];
  const client = createPawsAzureDataClient({
    tokenProvider: async () => 't',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, json: async () => ({ afcRecords: [], afcRecord: { afcRecordId: 'a1' } }) };
    }
  });
  await client.dashboardAfcRecords({ search: 'Ada', reason: 'vacation', active: true, limit: 25 });
  await client.createDashboardAfcRecord({ facultyId: 'f1', startDate: '2026-10-01', endDate: '2026-10-01', reasonCode: 'vacation', notes: '' });
  assert.equal(calls[0].init.method, 'GET');
  assert.match(calls[0].url, /dashboard\/afc-records\?search=Ada&reason=vacation&active=true&limit=25$/);
  assert.equal(calls[1].init.method, 'POST');
  assert.equal(calls[1].init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[1].init.body), { facultyId: 'f1', startDate: '2026-10-01', endDate: '2026-10-01', reasonCode: 'vacation', notes: '' });
});

test('AFC multi-input client sends exact purposes only to the authenticated SQL batch route', async () => {
  const calls = [];
  const client = createPawsAzureDataClient({
    tokenProvider: async () => 't',
    fetchImpl: async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({ requestId: 'r1', rows: [{ rowIndex: 0 }] }) }; }
  });
  const purpose = ' CCC   Day ';
  const result = await client.createDashboardAfcManualBatch({ requestId: 'r1', rows: [{ facultyId: 'f1', startDate: '2026-10-01', endDate: '2026-10-02', purpose, actorName: 'ignored' }] });
  assert.deepEqual(result, { requestId: 'r1', idempotentReplay: false, rows: [{ rowIndex: 0 }] });
  assert.equal(calls[0].url, API_ORIGIN + '/api/v1/dashboard/afc-records/batch');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.credentials, 'omit');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer t');
  assert.deepEqual(JSON.parse(calls[0].init.body), { requestId: 'r1', rows: [{ facultyId: 'f1', startDate: '2026-10-01', endDate: '2026-10-02', purpose }] });
});


test('P3B3 AFC request and decision methods use the University API with bounded payloads',async()=>{
  const calls=[];
  const client=createPawsAzureDataClient({
    tokenProvider:async()=>'afc-token',
    fetchImpl:async(url,init)=>{
      calls.push({url,init});
      return{ok:true,json:async()=>({
        afcRequests:[{afcRequestId:'r1',status:'pending_report_to'}],
        afcRequest:{afcRequestId:'r1',status:'approved'}
      })};
    }
  });
  assert.deepEqual(await client.listAfcRequests(),[{afcRequestId:'r1',status:'pending_report_to'}]);
  const signature={mode:'typed',name:'Test User',uid:'firebase-uid',signedAt:'2026-10-04T12:00:00Z',fingerprint:'a'.repeat(64)};
  const submitted=await client.submitAfcRequest({
    startDate:'2026-11-02',endDate:'2026-11-04',reason:'vacation',
    purposeDestination:'',coverage:'Coverage plan',contactAddress:'Calgary',
    contactPhone:'403-555-0100',termsAccepted:true,termsVersion:'ucvm-afc-terms-page2-v1',
    termsSource:'absence-from-campus-app.pdf#page=2',applicantSignature:signature,
    facultyId:'client-controlled',requesterUid:'client-controlled',status:'approved',workDays:99
  });
  assert.equal(submitted.status,'approved');
  await client.withdrawAfcRequest('r/1');
  await client.recommendAfcRequest('r/1',{signature,actorRole:'administrator'});
  await client.rejectAfcRequest('r/1',{signature,rejectionReason:'Incomplete',facultyId:'F1'});
  await client.approveAfcRequest('r/1',{signature,status:'approved'});

  assert.deepEqual(calls.map(x=>[x.init.method,x.url]),[
    ['GET',`${API_ORIGIN}/api/v1/afc-requests`],
    ['POST',`${API_ORIGIN}/api/v1/afc-requests`],
    ['POST',`${API_ORIGIN}/api/v1/afc-requests/r%2F1/withdraw`],
    ['POST',`${API_ORIGIN}/api/v1/afc-requests/r%2F1/recommend`],
    ['POST',`${API_ORIGIN}/api/v1/afc-requests/r%2F1/reject`],
    ['POST',`${API_ORIGIN}/api/v1/afc-requests/r%2F1/approve`]
  ]);
  assert.deepEqual(JSON.parse(calls[1].init.body),{
    startDate:'2026-11-02',endDate:'2026-11-04',reason:'vacation',
    purposeDestination:'',coverage:'Coverage plan',contactAddress:'Calgary',
    contactPhone:'403-555-0100',termsAccepted:true,termsVersion:'ucvm-afc-terms-page2-v1',
    termsSource:'absence-from-campus-app.pdf#page=2',applicantSignature:signature
  });
  assert.equal(calls[2].init.body,undefined);
  assert.deepEqual(JSON.parse(calls[3].init.body),{signature});
  assert.deepEqual(JSON.parse(calls[4].init.body),{signature,rejectionReason:'Incomplete'});
  assert.deepEqual(JSON.parse(calls[5].init.body),{signature});
  for(const {init} of calls){
    assert.equal(init.credentials,'omit');
    assert.equal(init.headers.Authorization,'Bearer afc-token');
  }
});

test('P3B3 AFC POST retries once only after explicit 401 and never after other failures',async()=>{
  let tokenCalls=0,fetchCalls=0;
  const retried=createPawsAzureDataClient({
    tokenProvider:async options=>{tokenCalls++;return options?.forceRefresh?'fresh-token':'old-token'},
    fetchImpl:async(_url,init)=>{
      fetchCalls++;
      if(fetchCalls===1)return{ok:false,status:401,json:async()=>({error:{code:'UNAUTHENTICATED'}})};
      assert.equal(init.headers.Authorization,'Bearer fresh-token');
      return{ok:true,json:async()=>({afcRequest:{afcRequestId:'r1'}})};
    }
  });
  assert.equal((await retried.submitAfcRequest({startDate:'2026-11-02'})).afcRequestId,'r1');
  assert.equal(fetchCalls,2);
  assert.equal(tokenCalls,2);

  for(const status of [403,404,503]){
    fetchCalls=0;tokenCalls=0;
    const noReplay=createPawsAzureDataClient({
      tokenProvider:async options=>{tokenCalls++;return options?.forceRefresh?'fresh-token':'old-token'},
      fetchImpl:async()=>{fetchCalls++;return{ok:false,status,json:async()=>({error:{code:'FAIL'}})}}
    });
    await assert.rejects(noReplay.submitAfcRequest({startDate:'2026-11-02'}),error=>error.status===status);
    assert.equal(fetchCalls,1);
    assert.equal(tokenCalls,1);
  }

  fetchCalls=0;tokenCalls=0;
  const transport=createPawsAzureDataClient({
    tokenProvider:async options=>{tokenCalls++;return options?.forceRefresh?'fresh-token':'old-token'},
    fetchImpl:async()=>{fetchCalls++;throw Error('offline')}
  });
  await assert.rejects(transport.submitAfcRequest({startDate:'2026-11-02'}),/offline/);
  assert.equal(fetchCalls,1);
  assert.equal(tokenCalls,1);
});

function binaryResponse(bytes,{status=200,contentType='application/pdf',contentDisposition='attachment; filename="afc-approved-11111111-2222-4333-8444-555555555555.pdf"'}={}){
  return{
    ok:status>=200&&status<300,
    status,
    headers:{get(name){return name.toLowerCase()==='content-type'?contentType:name.toLowerCase()==='content-disposition'?contentDisposition:null}},
    async arrayBuffer(){return Uint8Array.from(bytes).buffer},
    async json(){throw Error('Successful PDF responses must not be parsed as JSON')}
  };
}

test('P3B4 approved-artifact GET and POST preserve exact PDF bytes and response metadata',async()=>{
  const calls=[],pdf=[0x25,0x50,0x44,0x46,0x00,0xff,0x0a];
  const client=createPawsAzureDataClient({
    tokenProvider:async()=>'artifact-token',
    fetchImpl:async(url,init)=>{calls.push({url,init});return binaryResponse(pdf)}
  });
  const existing=await client.getApprovedAfcArtifact('11111111-2222-4333-8444-555555555555');
  const created=await client.createApprovedAfcArtifact('11111111-2222-4333-8444-555555555555');
  assert.deepEqual(Array.from(existing.bytes),pdf);
  assert.deepEqual(Array.from(created.bytes),pdf);
  assert.equal(existing.contentType,'application/pdf');
  assert.equal(existing.contentDisposition,'attachment; filename="afc-approved-11111111-2222-4333-8444-555555555555.pdf"');
  assert.deepEqual(calls.map(({url,init})=>[url,init.method]),[
    [`${API_ORIGIN}/api/v1/afc-requests/11111111-2222-4333-8444-555555555555/approved-artifact`,'GET'],
    [`${API_ORIGIN}/api/v1/afc-requests/11111111-2222-4333-8444-555555555555/approved-artifact`,'POST']
  ]);
  for(const {init} of calls){
    assert.equal(init.headers.Authorization,'Bearer artifact-token');
    assert.equal(init.headers.Accept,'application/pdf');
    assert.equal(init.credentials,'omit');
    assert.equal(init.body,undefined,'artifact POST has an empty body');
    assert.equal(init.headers['Content-Type'],undefined);
  }
});

test('P3B4 artifact calls force-refresh and replay exactly once only after HTTP 401',async()=>{
  for(const method of ['getApprovedAfcArtifact','createApprovedAfcArtifact']){
    const tokens=[],requests=[];
    const client=createPawsAzureDataClient({
      tokenProvider:async options=>{tokens.push(options?.forceRefresh===true);return options?.forceRefresh?'fresh-token':'initial-token'},
      fetchImpl:async(_url,init)=>{
        requests.push(init);
        if(requests.length===1)return{ok:false,status:401,async json(){return{error:{code:'UNAUTHENTICATED',message:'refresh required'}}}};
        return binaryResponse([1,2,3]);
      }
    });
    const result=await client[method]('11111111-2222-4333-8444-555555555555');
    assert.deepEqual(Array.from(result.bytes),[1,2,3]);
    assert.deepEqual(tokens,[false,true]);
    assert.equal(requests.length,2);
    assert.equal(requests[1].method,method==='getApprovedAfcArtifact'?'GET':'POST');
    assert.equal(requests[1].headers.Authorization,'Bearer fresh-token');
    assert.equal(requests[1].body,undefined);
  }
});

test('P3B4 artifact POST parses fixed JSON errors and never replays non-401 or transport failures',async()=>{
  for(const [status,code] of [[403,'ROLE_DENIED'],[404,'REQUEST_NOT_FOUND'],[409,'ARTIFACT_CONFLICT'],[500,'SQL_UNAVAILABLE'],[503,'SQL_UNAVAILABLE']]){
    let tokenCalls=0,fetchCalls=0;
    const client=createPawsAzureDataClient({
      tokenProvider:async()=>{tokenCalls++;return't'},
      fetchImpl:async()=>{fetchCalls++;return{ok:false,status,async json(){return{error:{code,message:'bounded failure'}}}}}
    });
    await assert.rejects(client.createApprovedAfcArtifact('11111111-2222-4333-8444-555555555555'),error=>
      error.status===status&&error.code===code&&error.message==='bounded failure');
    assert.equal(fetchCalls,1,`${status} is not replayed`);
    assert.equal(tokenCalls,1,`${status} does not force-refresh`);
  }
  let transportCalls=0,transportTokens=0;
  const transport=createPawsAzureDataClient({
    tokenProvider:async()=>{transportTokens++;return't'},
    fetchImpl:async()=>{transportCalls++;throw Error('network unavailable')}
  });
  await assert.rejects(transport.createApprovedAfcArtifact('11111111-2222-4333-8444-555555555555'),/network unavailable/);
  assert.equal(transportCalls,1);
  assert.equal(transportTokens,1);
});
