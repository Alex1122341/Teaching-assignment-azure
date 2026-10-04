'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {createPawsAzureDataClient}=require('../paws-data-client.js');

test('PAWS client is fixed to VetMed-Ops mode and exposes no backend selector or session write path',()=>{
  const source=fs.readFileSync('paws-data-client.js','utf8');
  const client=createPawsAzureDataClient({fetchImpl:async()=>({ok:true,json:async()=>({})}),tokenProvider:async()=>'t'});
  assert.equal(client.sessionBackend(),'vetmed-ops');
  assert.equal(client.sessionWritesEnabled(),false);
  assert.doesNotMatch(source,/firestore/i);
  assert.doesNotMatch(source,/UCVM_PAWS_SESSION_BACKEND|backend\s*:\s*['\"]/i);
});

test('current user and sessions use the University-origin bearer GET requests',async()=>{
  const calls=[];
  const origin='https://itappvetopsdb01.uc.ucalgary.ca';
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
  assert.equal(calls[0].url,'https://itappvetopsdb01.uc.ucalgary.ca/api/v1/dashboard/summary');
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
  assert.equal(urls[0],'https://itappvetopsdb01.uc.ucalgary.ca/api/v1/dashboard/summary');
  assert.equal(urls[1],'https://itappvetopsdb01.uc.ucalgary.ca/api/v1/dashboard/summary?academicYear=2026-27');
});

test('Dashboard faculty query safely encodes reserved search characters and returns only the roster array',async()=>{
  let request;
  const client=createPawsAzureDataClient({
    tokenProvider:async()=>'t',
    fetchImpl:async(url,init)=>{request={url,init};return{ok:true,json:async()=>({faculty:[{facultyId:'F1'}],ignored:true})}}
  });
  assert.deepEqual(await client.dashboardFaculty({academicYear:'2026-27',search:'A% &= B',limit:25}),[{facultyId:'F1'}]);
  assert.equal(request.url,'https://itappvetopsdb01.uc.ucalgary.ca/api/v1/dashboard/faculty?academicYear=2026-27&search=A%25+%26%3D+B&limit=25');
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
  assert.equal(url,'https://itappvetopsdb01.uc.ucalgary.ca/api/v1/dashboard/faculty/F%2F1%20%3F?academicYear=2026%2F27');
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
    'https://itappvetopsdb01.uc.ucalgary.ca/api/v1/dashboard/teaching-summary?academicYear=2026-27',
    'https://itappvetopsdb01.uc.ucalgary.ca/api/v1/dashboard/roles?academicYear=2026-27',
    'https://itappvetopsdb01.uc.ucalgary.ca/api/v1/dashboard/doe-overview?academicYear=2026-27'
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
    'approveAfcRequest','createDashboardAfcRecord','currentUser','dashboardAfcRecords','dashboardDoeOverview','dashboardFaculty','dashboardFacultyById','dashboardRoles','dashboardSummary','dashboardTeachingSummary','listAfcRequests','listSessions','recommendAfcRequest','rejectAfcRequest','sessionBackend','sessionWritesEnabled','submitAfcRequest','withdrawAfcRequest'
  ]);
  assert.doesNotMatch(source,/firestore/i);
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
    ['GET','https://itappvetopsdb01.uc.ucalgary.ca/api/v1/afc-requests'],
    ['POST','https://itappvetopsdb01.uc.ucalgary.ca/api/v1/afc-requests'],
    ['POST','https://itappvetopsdb01.uc.ucalgary.ca/api/v1/afc-requests/r%2F1/withdraw'],
    ['POST','https://itappvetopsdb01.uc.ucalgary.ca/api/v1/afc-requests/r%2F1/recommend'],
    ['POST','https://itappvetopsdb01.uc.ucalgary.ca/api/v1/afc-requests/r%2F1/reject'],
    ['POST','https://itappvetopsdb01.uc.ucalgary.ca/api/v1/afc-requests/r%2F1/approve']
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
