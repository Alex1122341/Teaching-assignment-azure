'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createHistoryController,renderRows}=require('../change-history');
const {createPawsDataClient}=require('../paws-data-client');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('client closes filter/page/export fields and sends authenticated GET only',async()=>{
 const calls=[],client=createPawsDataClient({tokenProvider:async()=>'synthetic',fetchImpl:async(url,init)=>{calls.push({url,init});return {ok:true,json:async()=>({rows:[]})};}});
 await client.changeHistory({scope:'mine',course:'206',actorFirebaseUid:'spoof',facultyId:'private'});
 await client.changeHistoryPage('handle',100);await client.changeHistoryExport('handle','xlsx');
 assert.deepEqual(Object.fromEntries(new URL(calls[0].url).searchParams),{scope:'mine',course:'206'});
 assert.match(calls[1].url,/\/change-history\/page\?snapshot=handle&offset=100/);assert.match(calls[2].url,/\/change-history\/export\?snapshot=handle&format=xlsx/);
 for(const {init} of calls){assert.equal(init.headers.Authorization,'Bearer synthetic');assert.equal(init.method||'GET','GET');assert.equal(init.body,undefined);}
});
function harness(){
 const queries=[],pages=[],exports=[],downloads=[],states=[];
 const api={changeHistory:filters=>new Promise((resolve,reject)=>queries.push({filters,resolve,reject})),changeHistoryPage:(snapshot,offset)=>new Promise(resolve=>pages.push({snapshot,offset,resolve})),changeHistoryExport:async(snapshot,format)=>{exports.push({snapshot,format});return {rowCount:202,fileBase64:'c2FmZQ=='};}};
 const controller=createHistoryController({api,scope:'mine',onState:s=>states.push(s),download:file=>downloads.push(file)});
 return {controller,queries,pages,exports,downloads,states};
}
const result=(snapshot='one')=>({snapshot,total:202,offset:0,pageSize:100,rows:[{field:'Room',updatedValue:'New'}],facets:{},coverage:[],expiresAt:'2026-10-17T01:00:00Z'});
test('filter edits disable export and stale SQL responses cannot replace newer query',async()=>{
 const h=harness();const first=h.controller.refresh({course:'201'}),second=h.controller.refresh({course:'206'});
 h.queries[1].resolve(result('two'));await second;h.queries[0].resolve(result('one'));await first;assert.equal(h.controller.state().snapshot,'two');
 h.controller.dirty();assert.equal(h.controller.state().canExport,false);await h.controller.export('csv');assert.equal(h.exports.length,0);
});
test('pages and all-filtered export use one snapshot and exports do not iterate visible DOM rows',async()=>{
 const h=harness(),q=h.controller.refresh({course:'206'});h.queries[0].resolve(result());await q;
 const page=h.controller.page(100);assert.deepEqual(h.pages[0].snapshot,'one');h.pages[0].resolve({...result(),offset:100,rows:[{field:'Room',updatedValue:'Page2'}]});await page;
 await h.controller.export('xlsx');assert.deepEqual(h.exports,[{snapshot:'one',format:'xlsx'}]);assert.equal(h.downloads[0].rowCount,202);assert.equal(h.queries.length,1);
});
test('clear and destroy invalidate pending responses, remove rows and revoke downloads',async()=>{
 for(const method of ['clear','destroy']){const h=harness(),q=h.controller.refresh({});h.controller[method]();h.queries[0].resolve(result());await q;assert.equal(h.controller.state().rows.length,0);assert.equal(h.controller.state().snapshot,null);await h.controller.export('csv');assert.equal(h.exports.length,0);}
});
test('expired/failed requests clear handles and show a refresh instruction',async()=>{
 const h=harness(),q=h.controller.refresh({});h.queries[0].reject(Object.assign(Error('Apply filters again'),{code:'HISTORY_REFRESH_REQUIRED'}));await q;
 assert.equal(h.controller.state().canExport,false);assert.match(h.controller.state().message,/Apply filters again/);
});
test('rendered source values are escaped, UTC and Calgary time are labelled, and no raw JSON is injected',()=>{
 const html=renderRows([{changeDate:'2026-10-16T12:00:00Z',updatedValue:'<img src=x onerror=bad()>',previousValue:'x',course:'206',session:'<script>bad</script>',field:'Topic'}]);
 assert.doesNotMatch(html,/<img|<script>/);assert.match(html,/&lt;img/);assert.match(html,/Calgary/);assert.match(html,/UTC/);
});
test('all three Beta entry points use the shared SQL history and include self-mode Dashboard entry',()=>{
 const index=fs.readFileSync('index.html','utf8'),dashboard=fs.readFileSync('faculty-admin.html','utf8'),panel=fs.readFileSync('afc-timetable-panel.js','utf8');
 for(const html of [index,dashboard]){assert.match(html,/change-history\.js/);assert.match(html,/change-history\.css/);}
 assert.match(index,/id="cal-changes-btn"/);assert.match(dashboard,/id="faculty-history-btn"/);
 assert.match(panel,/scope:.*mine/);assert.doesNotMatch(panel,/UCVM\.logs\(/);
 assert.ok(JSON.parse(fs.readFileSync('tools/static-assets.json','utf8')).includes('change-history.js'));
});

test('Dashboard renders one expandable operation with all child AFC and field changes',()=>{
 const {renderOperationRows}=require('../change-history');
 const html=renderOperationRows([{
  changeDate:'2026-10-20T16:10:00Z',title:'2 AFC Records Created',domain:'AFC',actor:'ADFAD Admin',
  recordCount:2,changeCount:4,startDate:'2026-11-09',endDate:'2026-11-10',
  records:[
   {affectedFaculty:'Faculty <One>',startDate:'2026-11-09',endDate:'2026-11-09',changes:[{field:'Start date',previousValue:'Not recorded',updatedValue:'2026-11-09'},{field:'Purpose',previousValue:'Not recorded',updatedValue:'University Travel'}]},
   {affectedFaculty:'Faculty Two',startDate:'2026-11-10',endDate:'2026-11-10',changes:[{field:'End date',previousValue:'Not recorded',updatedValue:'2026-11-10'},{field:'Purpose',previousValue:'Not recorded',updatedValue:'<script>alert(1)</script>'}]}
  ]
 }]);
 assert.equal((html.match(/class="history-operation-row"/g)||[]).length,1);
 assert.match(html,/<details class="history-operation-group"><summary/);
 assert.match(html,/2 AFC Records Created/);
 assert.match(html,/Record 1 of 2/);
 assert.match(html,/Record 2 of 2/);
 assert.match(html,/University Travel/);
 assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
 assert.doesNotMatch(html,/<script>/);
 assert.doesNotMatch(html,/Faculty <One>/);
});

test('Dashboard controller carries restored archive timestamp in state and clears it on authorization change',async()=>{
 const ctrl=createHistoryController({scope:'dashboard',api:{
  changeHistory:async()=>({snapshot:'token',total:0,rows:[],offset:0,pageSize:100,facets:{},coverage:[],historyArchiveStartUtc:'2026-10-05T00:00:00.000Z'}),
  changeHistoryPage:async()=>({rows:[],total:0,offset:0,pageSize:100}),
  changeHistoryExport:async()=>({rowCount:0,fileBase64:''})
 }});
 await ctrl.refresh({});
 assert.equal(ctrl.state().historyArchiveStartUtc,'2026-10-05T00:00:00.000Z');
 ctrl.clear();
 assert.equal(ctrl.state().historyArchiveStartUtc,undefined);
 assert.equal(ctrl.state().canExport,false);
});

test('Dashboard UI offers all academic years, retains detailed safe operations, and does not alter other history scopes',()=>{
 const ui=fs.readFileSync('change-history.js','utf8');
 assert.match(ui,/scope==='dashboard'\?'all'/);
 assert.match(ui,/All recorded years/);
 assert.match(ui,/data-history-archive-note/);
 assert.match(ui,/grouped by recorded submission/);
 assert.doesNotMatch(ui,/New Dashboard History since|data-history-reset-note/);
 assert.match(ui,/scope==='dashboard'\?renderOperationRows\(state.rows\):renderRows\(state.rows\)/);
});
