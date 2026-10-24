'use strict';
const { repositoryPath } = require('../tools/build/frontend-paths');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createController,renderRows,renderSummary,mount}=require('../frontend/scripts/faculty-admin-trainees.js');
const row=(i=0)=>({facultyId:'id'+i,displayName:'Example '+i,rawCounts:[0,null,53,0,0,0,0],sourceDoe:null,currentRawDoe:2,currentAppliedDoe:1,sourceStatus:'source_missing',privateNotes:{E:'private trainee note'},sourceRef:{sheet:'# Trainees',row:3,column:'A'}});
function fixture(){let user={uid:'owner',role:'owner'},year='2026-27';const queries=[],exports=[],downloads=[];
 const api={dashboardTrainees:p=>new Promise((resolve,reject)=>queries.push({p,resolve,reject})),exportDashboardTrainees:async p=>{exports.push(p);return {bytes:new Uint8Array([1]),contentType:'text/csv; charset=utf-8'};}};
 const c=createController({api,getAcademicYear:()=>year,getUser:()=>user,download:f=>downloads.push(f)});
 return {c,queries,exports,downloads,setYear:v=>year=v,setUser:v=>user=v};
}
const result=(rows=[row()],nextCursor=null)=>({academicYear:'2026-27',rows,total:26,nextCursor,summary:{supervisionAssignments:53,categories:{preceptor:53},missingCountCells:1,sourceIssues:1,rawSupervisionDoe:2,appliedSupervisionDoe:1,facultyWithTrainees:1},coverage:['Counts are supervision assignments.']});
test('opening and load-more use selected year/25 rows without duplicates; filter changes reset cursor',async()=>{
 const h=fixture(),open=h.c.refresh();assert.equal(h.queries[0].p.academicYear,'2026-27');assert.equal(h.queries[0].p.limit,25);
 h.queries[0].resolve(result(Array.from({length:25},(_,i)=>row(i)),'next'));await open;
 const next=h.c.more();assert.equal(h.queries[1].p.cursor,'next');h.queries[1].resolve(result([row(24),row(25)]));await next;assert.equal(h.c.state().rows.length,26);
 const query=h.c.refresh({query:'student',category:'preceptor'});assert.equal(h.queries[2].p.cursor,undefined);h.queries[2].resolve(result());await query;
 await h.c.export();assert.deepEqual(h.exports,[{academicYear:'2026-27',query:'student',category:'preceptor'}]);assert.equal(h.downloads.length,1);
});
test('year switch, clear and destroy discard delayed responses and private notes',async()=>{
 for(const method of ['clear','destroy']){const h=fixture(),p=h.c.refresh();h.c[method]();h.queries[0].resolve(result());await p;assert.deepEqual(h.c.state().rows,[]);await h.c.export();assert.equal(h.exports.length,0);}
 const h=fixture(),old=h.c.refresh();h.setYear('2027-28');const next=h.c.refresh();h.queries[1].resolve({...result([]),academicYear:'2027-28'});await next;h.queries[0].resolve(result());await old;assert.equal(h.c.state().academicYear,'2027-28');assert.deepEqual(h.c.state().rows,[]);
});
test('account change and filter edits invalidate exports and pending private results',async()=>{
 const h=fixture(),p=h.c.refresh();h.setUser({uid:'faculty',role:'faculty'});h.queries[0].resolve(result());await p;assert.deepEqual(h.c.state().rows,[]);
 const h2=fixture(),p2=h2.c.refresh();h2.queries[0].resolve(result());await p2;h2.c.dirty();await h2.c.export();assert.equal(h2.exports.length,0);
});
test('late CSV is discarded after logout and changing year',async()=>{
 for(const action of ['logout','year']){let user={uid:'owner',role:'owner'},finish;const files=[],api={dashboardTrainees:async()=>result(),exportDashboardTrainees:()=>new Promise(r=>finish=r)};
  const c=createController({api,getAcademicYear:()=>'2026-27',getUser:()=>user,download:file=>files.push(file)});await c.refresh();const pending=c.export();
  if(action==='logout'){user=null;c.clear();}else{c.dirty();}
  finish({bytes:new Uint8Array([1]),contentType:'text/csv; charset=utf-8'});await pending;assert.deepEqual(files,[]);
 }
});
test('ordinary refresh and changing keywords retain the explicitly selected year',async()=>{
 const h=fixture(),p=h.c.refresh({academicYear:'2027-28'});h.queries[0].resolve({...result(),academicYear:'2027-28'});await p;
 const again=h.c.refresh();assert.equal(h.queries[1].p.academicYear,'2027-28');h.queries[1].resolve({...result(),academicYear:'2027-28'});await again;
 const search=h.c.refresh({query:'different'});assert.equal(h.queries[2].p.academicYear,'2027-28');h.queries[2].resolve({...result(),academicYear:'2027-28'});await search;
});
test('lazy tab teardown retains only academic year for the same account',async()=>{
 const vm=require('node:vm');let options;const window={addEventListener(){},PAWS_TRAINEES:{mount:(_h,p)=>{options=p;return {refresh(){},destroy(){}};}}},document={readyState:'loading',querySelector:()=>true};
 vm.runInNewContext(fs.readFileSync(repositoryPath(process.cwd(), 'asset-loader.js'),'utf8'),{window,document,setTimeout});let user={uid:'owner',role:'owner'};
 const entry=window.UCVM_ASSETS.createTraineeEntry({host:{innerHTML:''},getAcademicYear:()=>'2026-27',getUser:()=>user});await entry.open();options.onAcademicYearChange('2027-28');entry.clear();await entry.open();assert.equal(options.getAcademicYear(),'2027-28');
 user={uid:'other',role:'faculty'};entry.clear();await entry.open();assert.equal(options.getAcademicYear(),'2026-27');
});
test('render separates missing/zero/source/current DOE, escapes text and omits other-faculty totals for self',()=>{
 const html=renderRows([{...row(),displayName:'<img src=x>',privateNotes:{E:'<script>note</script>'}}]);
 assert.match(html,/Not provided/);assert.match(html,/>0<\/td>/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img|<script>|private trainee note/);assert.match(html,/<details/);assert.match(html,/&lt;script&gt;note/);
 const summary=result().summary;assert.match(renderSummary(summary,true),/Faculty with trainees/);assert.doesNotMatch(renderSummary(summary,false),/Faculty with trainees/);assert.match(renderSummary(summary,true),/Seven|Preceptor|Fourth-year preceptor/);
});
test('mount clears rendered notes and delayed rows on signout',async()=>{
 const nodes=new Map(),node=()=>({value:'',innerHTML:'',textContent:'',disabled:false,addEventListener(){}});
 const host={innerHTML:'',querySelector:s=>{if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);},querySelectorAll:()=>[]};
 const h=fixture();let finish;const api={dashboardTrainees:()=>new Promise(r=>finish=r)};
 const view=mount(host,{api,getAcademicYear:()=>'2026-27',getUser:()=>({uid:'self',role:'faculty'})});view.clear();finish(result());await new Promise(r=>setImmediate(r));assert.equal(host.innerHTML,'');assert.doesNotMatch(nodes.get('[data-trainee-rows]')?.innerHTML||'',/private trainee note/);view.destroy();
});
test('Dashboard wires lazy assets, self navigation and cleanup within the reviewed 63k LF byte bound including auth generation guards',()=>{
 const html=fs.readFileSync(repositoryPath(process.cwd(), 'faculty-admin.html'),'utf8'),src=fs.readFileSync(repositoryPath(process.cwd(), 'faculty-admin.js'),'utf8'),loader=fs.readFileSync(repositoryPath(process.cwd(), 'asset-loader.js'),'utf8');
 assert.match(html,/data-tab="trainees"/);assert.match(html,/id="trainees-view"/);assert.doesNotMatch(html,/<script src="faculty-admin-trainees.js"/);
 assert.match(loader,/ensureTrainees/);assert.match(src,/traineesEntry/);assert.match(src,/traineesEntry\?\.clear/);assert.match(src,/\['lookup','trainees','availability'\]/);assert.ok(Buffer.byteLength(src.replace(/\r\n/g,'\n'))<63000);
});
