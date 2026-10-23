'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createSqlAfcWorkflow}=require('../frontend/scripts/afc-workflow-sql.js');

const requestId='11111111-2222-4333-8444-555555555555';

function uiHarness({rows,clientOverrides={},urlOverrides={}}={}){
  const calls=[],downloads=[],buttons=[];
  const effectiveRows=rows||[
    {afcRequestId:requestId,status:'approved',facultyName:'Approved'},
    {afcRequestId:'pending-id',status:'pending_report_to',facultyName:'Pending'}
  ];
  for(const row of effectiveRows){
    if(row.status==='approved')buttons.push({dataset:{afcDownload:row.afcRequestId},disabled:false,onclick:null});
  }
  const panel={innerHTML:'',querySelectorAll(selector){return selector==='[data-afc-download]'?buttons:[]}};
  const body={appendChild(node){node.parentNode=this},removeChild(node){node.parentNode=null}};
  const doc={
    body,
    getElementById(id){return id==='afc-panel-content'?panel:null},
    createElement(tag){
      assert.equal(tag,'a');
      const anchor={click(){downloads.push({href:this.href,download:this.download})}};
      return anchor;
    }
  };
  const URLApi={
    createObjectURL(blob){const url=`blob:p3b4-${downloads.length+1}`;urlOverrides.created?.push({url,blob});return url},
    revokeObjectURL(url){urlOverrides.revoked?.push(url)}
  };
  const dataClient={
    async listAfcRequests(){calls.push(['list']);return effectiveRows},
    async afcWriteCapabilities(){return{requestLifecycle:true,decisions:true,approvedArtifactCreation:true}},
    async getApprovedAfcArtifact(id){calls.push(['getArtifact',id]);return{bytes:Uint8Array.from([37,80,68,70]),contentType:'application/pdf',contentDisposition:`attachment; filename="afc-approved-${id}.pdf"`}},
    async createApprovedAfcArtifact(id){calls.push(['createArtifact',id]);return{bytes:Uint8Array.from([37,80,68,70]),contentType:'application/pdf',contentDisposition:`attachment; filename="afc-approved-${id}.pdf"`}},
    ...clientOverrides
  };
  const root={document:doc,Blob,URL:URLApi,setTimeout(callback){callback()}};
  const workflow=createSqlAfcWorkflow({root,document:doc,dataClient,auth:{currentUser:{uid:'requester'}},profile:()=>({role:'faculty'})});
  workflow.mount({panelId:'afc-panel-content'});
  const load=workflow.load(true);
  return{workflow,calls,downloads,panel,buttons,load,urlOverrides};
}

test('SQL AFC workflow offers Download Approved PDF only for finally approved requests',async()=>{
  const h=uiHarness();
  await h.load;
  assert.match(h.panel.innerHTML,/data-afc-download="11111111-2222-4333-8444-555555555555"/);
  assert.doesNotMatch(h.panel.innerHTML,/data-afc-download="pending-id"/);
  assert.equal(h.buttons.length,1);
  assert.equal(typeof h.buttons[0].onclick,'function');
  assert.deepEqual(h.calls.filter(call=>call[0]!=='list'),[]);
});

test('disabled AFC write capabilities keep request reads and artifact GET while hiding and blocking writes',async()=>{
  const h=uiHarness({clientOverrides:{
    async afcWriteCapabilities(){return{requestLifecycle:false,decisions:false,approvedArtifactCreation:false}},
    async getApprovedAfcArtifact(id){h.calls.push(['getArtifact',id]);throw Object.assign(Error('Missing'),{status:404,code:'ARTIFACT_NOT_FOUND'})}
  }});
  await h.load;
  assert.deepEqual(h.calls,[['list']]);
  assert.match(h.panel.innerHTML,/currently unavailable/);
  assert.match(h.panel.innerHTML,/remain downloadable/);
  assert.doesNotMatch(h.panel.innerHTML,/id="afc-sql-form"/);
  assert.match(h.panel.innerHTML,/data-afc-download="11111111-2222-4333-8444-555555555555"/);
  await assert.rejects(h.workflow.downloadApprovedArtifact(requestId),/creation is currently unavailable/i);
  await assert.rejects(h.workflow.submit({}),/submissions are currently unavailable/i);
  assert.deepEqual(h.calls,[['list'],['getArtifact',requestId]]);
});

test('approved PDF download GETs the stored artifact and saves exact bytes without changing request state',async()=>{
  const created=[],revoked=[];
  const h=uiHarness({urlOverrides:{created,revoked}});
  await h.load;
  await h.workflow.downloadApprovedArtifact(requestId);
  assert.deepEqual(h.calls,[['list'],['getArtifact',requestId]]);
  assert.equal(h.downloads.length,1);
  assert.equal(h.downloads[0].download,`afc-approved-${requestId}.pdf`);
  assert.equal(created.length,1);
  assert.deepEqual(Array.from(new Uint8Array(await created[0].blob.arrayBuffer())),[37,80,68,70]);
  assert.deepEqual(revoked,[h.downloads[0].href]);
  assert.equal(h.calls.some(call=>/submit|approve|recommend|reject|withdraw/i.test(call[0])),false);
});

test('approved PDF download creates only after authorized ARTIFACT_NOT_FOUND and suppresses duplicate in-flight creation',async()=>{
  let finishCreate,posts=0;
  const creating=new Promise(resolve=>{finishCreate=resolve});
  const h=uiHarness({clientOverrides:{
    async getApprovedAfcArtifact(id){h.calls.push(['getArtifact',id]);throw Object.assign(Error('The approved PDF has not been created.'),{status:404,code:'ARTIFACT_NOT_FOUND'})},
    async createApprovedAfcArtifact(id){posts++;h.calls.push(['createArtifact',id]);return creating}
  }});
  await h.load;
  const first=h.workflow.downloadApprovedArtifact(requestId);
  const second=h.workflow.downloadApprovedArtifact(requestId);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(posts,1);
  assert.equal(h.calls.filter(call=>call[0]==='createArtifact').length,1);
  finishCreate({bytes:Uint8Array.from([1,2]),contentType:'application/pdf',contentDisposition:`attachment; filename="afc-approved-${requestId}.pdf"`});
  await Promise.all([first,second]);
  assert.equal(h.downloads.length,1);
});

test('approved PDF download does not POST after other GET errors and rejects non-approved rows',async()=>{
  const h=uiHarness({clientOverrides:{async getApprovedAfcArtifact(id){h.calls.push(['getArtifact',id]);throw Object.assign(Error('Unavailable'),{status:404,code:'REQUEST_NOT_FOUND'})}}});
  await h.load;
  assert.throws(()=>h.workflow.downloadApprovedArtifact('pending-id'),/finally approved/i);
  await assert.rejects(h.workflow.downloadApprovedArtifact(requestId),/Unavailable/);
  assert.equal(h.calls.filter(call=>call[0]==='createArtifact').length,0);
});

test('approved PDF download ignores an unsafe server filename and uses the request UUID fallback',async()=>{
  const h=uiHarness({clientOverrides:{async getApprovedAfcArtifact(id){h.calls.push(['getArtifact',id]);return{
    bytes:Uint8Array.from([1]),contentType:'application/pdf',contentDisposition:'attachment; filename="../../outside.pdf"'
  }}}});
  await h.load;
  await h.workflow.downloadApprovedArtifact(requestId);
  assert.equal(h.downloads[0].download,`afc-approved-${requestId}.pdf`);
});
