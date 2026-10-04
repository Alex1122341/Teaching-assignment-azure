'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {createSqlAfcWorkflow,requestActions}=require('../afc-workflow-sql.js');

function harness(overrides={}){
  const calls=[];
  const rows=[
    {afcRequestId:'r1',requesterFirebaseUid:'u1',reportToFirebaseUid:'u2',facultyName:'A <B>',status:'pending_report_to',startDate:'2026-11-02',endDate:'2026-11-02',workDays:1,reason:'vacation'},
    {afcRequestId:'r2',requesterFirebaseUid:'u4',reportToFirebaseUid:'u3',facultyName:'Other',status:'pending_admin',startDate:'2026-11-03',endDate:'2026-11-03',workDays:1,reason:'business_other'},
    {afcRequestId:'r3',requesterFirebaseUid:'u1',reportToFirebaseUid:'u2',facultyName:'Approved User',status:'approved',startDate:'2026-11-04',endDate:'2026-11-04',workDays:1,reason:'vacation'}
  ];
  const client={
    async listAfcRequests(){calls.push(['list']);return rows},
    async submitAfcRequest(payload){calls.push(['submit',payload]);return{afcRequestId:'r3',status:'pending_report_to'}},
    async withdrawAfcRequest(id){calls.push(['withdraw',id]);return{afcRequestId:id,status:'withdrawn'}},
    async recommendAfcRequest(id,payload){calls.push(['recommend',id,payload]);return{afcRequestId:id,status:'pending_admin'}},
    async rejectAfcRequest(id,payload){calls.push(['reject',id,payload]);return{afcRequestId:id,status:'rejected'}},
    async approveAfcRequest(id,payload){calls.push(['approve',id,payload]);return{afcRequestId:id,status:'approved'}}
  };
  const panel={innerHTML:'',querySelectorAll(){return[]}};
  const doc={getElementById(){return panel}};
  const workflow=createSqlAfcWorkflow({
    dataClient:client,document:doc,auth:{currentUser:{uid:'u2',email:'test@example.org'}},
    profile:()=>({role:'faculty',displayName:'Test User'}), ...overrides
  });
  workflow.mount({panelId:'afc-panel-content',mode:'timetable'});
  return{workflow,calls,panel,rows};
}

test('SQL AFC workflow lists scoped API rows, escapes content, and never references a Firestore request or PDF path',async()=>{
  const {workflow,calls,panel}=harness();
  await workflow.load(true);
  assert.equal(calls.filter(x=>x[0]==='list').length,1);
  assert.match(panel.innerHTML,/A &lt;B&gt;/);
  assert.doesNotMatch(panel.innerHTML,/A <B>/);
  assert.match(panel.innerHTML,/PDF delivery is pending/);
  const source=fs.readFileSync('afc-workflow-sql.js','utf8');
  assert.doesNotMatch(source,/db\\.collection|pdf_chunks|afc_audit/i);
});

test('request action policy limits withdraw, Reports-To decisions and final approval by ownership, stage and role',()=>{
  const row={status:'pending_report_to',requesterFirebaseUid:'u1',reportToFirebaseUid:'u2'};
  assert.deepEqual(requestActions(row,{uid:'u1',role:'faculty'}),{canWithdraw:true,canRecommend:false,canReject:false,canApprove:false});
  assert.deepEqual(requestActions(row,{uid:'u2',role:'faculty'}),{canWithdraw:false,canRecommend:true,canReject:true,canApprove:false});
  assert.deepEqual(requestActions(row,{uid:'admin',role:'adfa_general'}),{canWithdraw:false,canRecommend:true,canReject:true,canApprove:false});
  assert.deepEqual(requestActions({...row,status:'pending_admin'},{uid:'u1',role:'faculty'}),{canWithdraw:true,canRecommend:false,canReject:false,canApprove:false});
  assert.deepEqual(requestActions({...row,status:'pending_admin'},{uid:'admin',role:'admin'}),{canWithdraw:false,canRecommend:false,canReject:true,canApprove:true});
  assert.deepEqual(requestActions({...row,status:'approved'},{uid:'u1',role:'faculty'}),{canWithdraw:false,canRecommend:false,canReject:false,canApprove:false});
});

test('submit, requester withdrawal, Reports-To recommendation, and Admin approval call only the data-client API',async()=>{
  const signature={mode:'typed',name:'Signer',uid:'u2',signedAt:'2026-10-04T12:00:00Z',fingerprint:'a'.repeat(64)};
  const facultySubmit=harness({profile:()=>({role:'faculty',displayName:'Faculty'})});
  await facultySubmit.workflow.load(true);
  await facultySubmit.workflow.submit({startDate:'2026-11-02',endDate:'2026-11-02',reason:'vacation',contactAddress:'Address',contactPhone:'403',termsAccepted:true,applicantSignature:signature});
  assert.deepEqual(facultySubmit.calls.find(x=>x[0]==='submit')[1],{startDate:'2026-11-02',endDate:'2026-11-02',reason:'vacation',contactAddress:'Address',contactPhone:'403',termsAccepted:true,applicantSignature:signature});

  const reportTo=harness();
  await reportTo.workflow.load(true);
  await reportTo.workflow.recommend('r1',signature);
  assert.deepEqual(reportTo.calls.find(x=>x[0]==='recommend').slice(1),['r1',{signature}]);

  const admin=harness({profile:()=>({role:'admin',displayName:'Admin'})});
  await admin.workflow.load(true);
  await admin.workflow.approve('r2',signature);
  assert.deepEqual(admin.calls.find(x=>x[0]==='approve').slice(1),['r2',{signature}]);

  const requester=harness({auth:{currentUser:{uid:'u1',email:'faculty@example.org'}},profile:()=>({role:'faculty'})});
  await requester.workflow.load(true);
  await requester.workflow.withdraw('r1');
  assert.deepEqual(requester.calls.find(x=>x[0]==='withdraw'),['withdraw','r1']);
});

test('workflow refuses UI actions outside the current server-returned ownership and stage',async()=>{
  const {workflow,calls}=harness();
  await workflow.load(true);
  await assert.rejects(workflow.withdraw('r2'),/requester.*pending/i);
  await assert.rejects(workflow.approve('r1',{uid:'u2'}),/administrator/i);
  assert.equal(calls.filter(x=>['withdraw','approve'].includes(x[0])).length,0);
});


test('SQL entry point selects the SQL AFC module only for the VetMed-Ops backend',()=>{
  const source=fs.readFileSync('afc-workflow.js','utf8');
  const html=fs.readFileSync('index.html','utf8');
  assert.match(source,/businessBackend\(\)==='vetmed-ops'&&window\.UCVM_AFC_SQL/);
  assert.ok(html.indexOf('afc-workflow-sql.js')<html.indexOf('afc-workflow.js'));
});

test('SQL form payload preserves terms and applicant signature but excludes derived identity and teaching fields',async()=>{
  const panel={innerHTML:'',querySelectorAll(){return[]}};
  const form={},sign={};
  const nodes={'afc-panel-content':panel,'afc-sql-form':form,'afc-sql-sign':sign};
  const data={
    startDate:'2026-11-02',endDate:'2026-11-02',reason:'vacation',
    purposeDestination:'',coverage:'Coverage',contactAddress:'Address',contactPhone:'403',
    termsAccepted:'on',facultyId:'forbidden',requesterFirebaseUid:'forbidden',
    reportToFirebaseUid:'forbidden',status:'approved',workDays:'99',teachingSessions:'forbidden'
  };
  class FakeFormData{constructor(){ }get(key){return data[key]??''}}
  const signature={mode:'typed',name:'Test User',uid:'u2',signedAt:'2026-10-04T12:00:00Z',fingerprint:'b'.repeat(64)};
  const workflow=createSqlAfcWorkflow({
    dataClient:{async listAfcRequests(){return[]}},document:{getElementById(id){return nodes[id]||{}}},
    auth:{currentUser:{uid:'u2',email:'test@example.org'}},profile:()=>({role:'faculty'}),
    FormData:FakeFormData,signatureCapture:async()=>signature
  });
  workflow.mount({panelId:'afc-panel-content',mode:'timetable'});
  await workflow.load(true);
  await sign.onclick();
  assert.deepEqual(workflow.formPayload({}),{
    startDate:'2026-11-02',endDate:'2026-11-02',reason:'vacation',
    purposeDestination:'',coverage:'Coverage',contactAddress:'Address',contactPhone:'403',
    termsAccepted:true,termsVersion:'ucvm-afc-terms-page2-v1',
    termsSource:'absence-from-campus-app.pdf#page=2',applicantSignature:signature
  });
});


test('ambiguous AFC write transport failure tells the user to refresh before retrying and is not replayed by the UI',async()=>{
  let submissions=0;
  const workflow=createSqlAfcWorkflow({
    dataClient:{
      async listAfcRequests(){return[]},
      async submitAfcRequest(){submissions++;throw TypeError('network unavailable')}
    },
    document:{getElementById(){return{innerHTML:'',querySelectorAll(){return[]}}}},
    auth:{currentUser:{uid:'u1'}},profile:()=>({role:'faculty'})
  });
  workflow.mount({panelId:'afc-panel-content'});
  await workflow.load(true);
  await assert.rejects(workflow.submit({startDate:'2026-11-02'}),error=>error.code==='OUTCOME_UNCONFIRMED'&&/Refresh the request list before trying again/.test(error.message));
  assert.equal(submissions,1);
});


async function submitUiHarness({submitAfcRequest,listAfcRequests}={}){
  const values={
    startDate:'2026-11-02',endDate:'2026-11-02',reason:'vacation',
    purposeDestination:'',coverage:'Coverage',contactAddress:'Address',
    contactPhone:'403',termsAccepted:'on'
  };
  class FakeFormData{constructor(){}get(key){return values[key]??''}}
  const submitButton={disabled:false};
  const form={onsubmit:null,resetCount:0,querySelector(selector){return selector==='button[type="submit"]'?submitButton:null},reset(){this.resetCount++}};
  const panel={innerHTML:'',querySelectorAll(){return[]}};
  const sign={onclick:null};
  const status={textContent:''};
  const signatureStatus={textContent:''};
  const refresh={onclick:null};
  const nodes={
    'afc-panel-content':panel,
    'afc-sql-form':form,
    'afc-sql-sign':sign,
    'afc-sql-submit-status':status,
    'afc-sql-signature-status':signatureStatus,
    'afc-sql-refresh':refresh
  };
  const calls={submissions:0,lists:0};
  const dataClient={
    async listAfcRequests(){
      calls.lists++;
      return listAfcRequests?listAfcRequests(calls.lists):[];
    },
    async submitAfcRequest(payload){
      calls.submissions++;
      return submitAfcRequest?submitAfcRequest(payload,calls.submissions):{afcRequestId:'created',status:'pending_report_to'};
    }
  };
  const signature={mode:'typed',name:'Test User',uid:'u1',signedAt:'2026-10-04T12:00:00Z',fingerprint:'c'.repeat(64)};
  const workflow=createSqlAfcWorkflow({
    dataClient,document:{getElementById(id){return nodes[id]||null}},
    auth:{currentUser:{uid:'u1',email:'test@example.org'}},
    profile:()=>({role:'faculty',displayName:'Test User'}),
    FormData:FakeFormData,signatureCapture:async()=>signature
  });
  workflow.mount({panelId:'afc-panel-content'});
  await workflow.load(true);
  await sign.onclick();
  return{workflow,calls,panel,form,submitButton,status,refresh};
}

test('SQL AFC form submit is single-flight, disables submit while pending, and resets after success',async()=>{
  let finishSubmission;
  const pending=new Promise(resolve=>{finishSubmission=resolve});
  const h=await submitUiHarness({submitAfcRequest:()=>pending});
  const event={preventDefault(){}};
  const first=h.form.onsubmit(event);
  assert.equal(h.submitButton.disabled,true,'submit is disabled immediately');
  const second=h.form.onsubmit(event);
  await second;
  assert.equal(h.calls.submissions,1,'the second pending submit does not call the API');
  assert.equal(h.submitButton.disabled,true,'submit remains disabled until the first outcome');
  finishSubmission({afcRequestId:'created',status:'pending_report_to'});
  await first;
  assert.equal(h.form.resetCount,1,'success resets the form once');
  assert.equal(h.submitButton.disabled,false,'success releases the submit guard');
  assert.equal(h.status.textContent,'Request submitted.');
});

test('SQL AFC form releases its guard after a definite failure and permits a manual retry',async()=>{
  const h=await submitUiHarness({
    submitAfcRequest:(_payload,attempt)=>{
      if(attempt===1)throw Object.assign(Error('Invalid request'),{status:400});
      return{afcRequestId:'created-after-retry',status:'pending_report_to'};
    }
  });
  const event={preventDefault(){}};
  await h.form.onsubmit(event);
  assert.equal(h.calls.submissions,1,'a failed submission is not automatically replayed');
  assert.equal(h.submitButton.disabled,false,'a definite failure restores the submit button');
  const retry=h.form.onsubmit(event);
  assert.equal(h.calls.submissions,2,'the user can manually retry after a definite failure');
  await retry;
  assert.equal(h.form.resetCount,1);
});

test('SQL AFC form keeps submit locked after an ambiguous transport outcome until a successful list refresh',async()=>{
  const h=await submitUiHarness({
    submitAfcRequest:()=>{throw TypeError('network unavailable')}
  });
  const event={preventDefault(){}};
  await h.form.onsubmit(event);
  assert.equal(h.calls.submissions,1,'an ambiguous failure does not trigger another POST');
  assert.equal(h.submitButton.disabled,true,'the user must resolve the outcome by refreshing');
  assert.match(h.status.textContent,/Refresh the request list before trying again/);
  await h.refresh.onclick();
  assert.equal(h.submitButton.disabled,false,'a successful refresh resolves the pending outcome');
  assert.equal(h.calls.submissions,1);
});
