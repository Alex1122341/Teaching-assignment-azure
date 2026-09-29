'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {createPawsAzureDataClient}=require('../paws-data-client.js');

test('Azure client is fixed to SQL mode and exposes no backend selector or write path',()=>{
  const source=fs.readFileSync('paws-data-client.js','utf8');
  const client=createPawsAzureDataClient({fetchImpl:async()=>({ok:true,json:async()=>({})}),tokenProvider:async()=>'t'});
  assert.equal(client.sessionBackend(),'azure-sql');
  assert.equal(client.sessionWritesEnabled(),false);
  assert.doesNotMatch(source,/firestore/i);
  assert.doesNotMatch(source,/UCVM_PAWS_SESSION_BACKEND|backend\s*:\s*['\"]/i);
});

test('current user and sessions use the ACA-origin bearer GET requests',async()=>{
  const calls=[];
  const origin='https://paws-sql-beta-api-260926.wonderfulglacier-ff8c7a3b.eastus2.azurecontainerapps.io';
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
  assert.equal(calls[0].url,'https://paws-sql-beta-api-260926.wonderfulglacier-ff8c7a3b.eastus2.azurecontainerapps.io/api/v1/dashboard/summary');
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
  assert.equal(urls[0],'https://paws-sql-beta-api-260926.wonderfulglacier-ff8c7a3b.eastus2.azurecontainerapps.io/api/v1/dashboard/summary');
  assert.equal(urls[1],'https://paws-sql-beta-api-260926.wonderfulglacier-ff8c7a3b.eastus2.azurecontainerapps.io/api/v1/dashboard/summary?academicYear=2026-27');
});

test('Dashboard faculty query safely encodes reserved search characters and returns only the roster array',async()=>{
  let request;
  const client=createPawsAzureDataClient({
    tokenProvider:async()=>'t',
    fetchImpl:async(url,init)=>{request={url,init};return{ok:true,json:async()=>({faculty:[{facultyId:'F1'}],ignored:true})}}
  });
  assert.deepEqual(await client.dashboardFaculty({academicYear:'2026-27',search:'A% &= B',limit:25}),[{facultyId:'F1'}]);
  assert.equal(request.url,'https://paws-sql-beta-api-260926.wonderfulglacier-ff8c7a3b.eastus2.azurecontainerapps.io/api/v1/dashboard/faculty?academicYear=2026-27&search=A%25+%26%3D+B&limit=25');
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
  assert.equal(url,'https://paws-sql-beta-api-260926.wonderfulglacier-ff8c7a3b.eastus2.azurecontainerapps.io/api/v1/dashboard/faculty/F%2F1%20%3F?academicYear=2026%2F27');
});

test('Dashboard methods preserve API status, code, and server message without a fallback',async()=>{
  for(const [status,code] of [[400,'INVALID_ACADEMIC_YEAR'],[401,'UNAUTHENTICATED'],[403,'ROLE_DENIED'],[404,'FACULTY_NOT_FOUND'],[503,'SQL_UNAVAILABLE']]){
    const client=createPawsAzureDataClient({
      tokenProvider:async()=>'t',
      fetchImpl:async()=>({ok:false,status,json:async()=>({error:{code,message:`failure ${status}`}})})
    });
    await assert.rejects(client.dashboardSummary(),error=>error.status===status&&error.code===code&&error.message===`failure ${status}`);
  }
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
    'https://paws-sql-beta-api-260926.wonderfulglacier-ff8c7a3b.eastus2.azurecontainerapps.io/api/v1/dashboard/teaching-summary?academicYear=2026-27',
    'https://paws-sql-beta-api-260926.wonderfulglacier-ff8c7a3b.eastus2.azurecontainerapps.io/api/v1/dashboard/roles?academicYear=2026-27',
    'https://paws-sql-beta-api-260926.wonderfulglacier-ff8c7a3b.eastus2.azurecontainerapps.io/api/v1/dashboard/doe-overview?academicYear=2026-27'
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
    'createDashboardAfcRecord','currentUser','dashboardAfcRecords','dashboardDoeOverview','dashboardFaculty','dashboardFacultyById','dashboardRoles','dashboardSummary','dashboardTeachingSummary','listSessions','sessionBackend','sessionWritesEnabled'
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
