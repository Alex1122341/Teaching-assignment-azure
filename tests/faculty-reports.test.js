'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createController,renderTable,buildDefinition,mount}=require('../frontend/scripts/faculty-reports');
const catalog=require('../server/src/reports/report-definition').catalog();
const def=()=>({academicYear:'2026-27',datasets:[{source:'roles',columns:['facultyName','effectiveDoe'],search:'',match:'all',filters:[],sort:{field:'facultyName',direction:'asc'}}]});
test('adding a condition preserves the expanded source configuration',async()=>{
 const nodes=new Map(),node=()=>({value:'',innerHTML:'',textContent:'',disabled:false}),get=selector=>{if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);};
 get('[data-report-year]').value='2026-27';const config={dataset:{reportConfig:'workload'},querySelector:s=>({value:({'[data-report-search]':'','[data-report-match]':'all','[data-report-sort]':'facultyName','[data-report-direction]':'asc'})[s]}),querySelectorAll:()=>[]};
 const host={innerHTML:'',querySelector:get,querySelectorAll:selector=>selector.includes('[data-report-config]')?[config]:[]};
 const view=mount(host,{api:{reportCatalog:async()=>catalog},getUser:()=>({uid:'owner',role:'owner'}),getAcademicYear:()=>'2026-27',isAdministrator:()=>true});await view.ready;
 const button={disabled:false,matches:selector=>selector==='[data-report-add-condition]',closest:()=>config};host.onclick({target:{closest:()=>button}});
 assert.match(get('[data-report-builder]').innerHTML,/data-report-config="workload" open/);assert.match(get('[data-report-builder]').innerHTML,/data-report-condition="0"/);view.destroy();
});
const preview=()=>({snapshot:'s',academicYear:'2026-27',expiresAt:'2099-01-01',tables:[{source:'roles',label:'Roles',columns:[{id:'facultyName',label:'Faculty',type:'text'},{id:'effectiveDoe',label:'DOE',type:'number',unit:'%'}],rows:[['de la Cruz, Ana',0],['Example, Sam',null]],total:73,offset:0,pageSize:50,coverage:['Whole appointment DOE is not additive.']}]});
function fixture(){let user={uid:'owner',role:'owner'},support='',year='2026-27';const calls=[],downloads=[],copied=[];const api={reportCatalog:async()=>catalog,reportQuery:async d=>{calls.push(d);return preview();},reportPage:async(s,source,offset)=>({...preview().tables[0],snapshot:s,offset,rows:[['Example, Next',-2]]}),reportExport:async(s,format,source)=>{calls.push({s,format,source});return {fileName:'file',fileBase64:'Zg=='};}};const c=createController({api,getUser:()=>user,getAcademicYear:()=>year,getContext:()=>support,isAdministrator:u=>u?.role==='owner',download:f=>downloads.push(f),copy:t=>copied.push(t)});return {c,api,calls,downloads,copied,setUser:v=>user=v,setContext:v=>support=v,setYear:v=>year=v};}
test('selectable source and column order, typed conditions, and separate output scopes are preserved',async()=>{
 const h=fixture();await h.c.initialize();h.c.update(def());await h.c.preview();assert.deepEqual(h.calls[0],def());assert.equal(h.c.state().result.tables[0].total,73);
 await h.c.export('csv');await h.c.export('xlsx');assert.deepEqual(h.calls.slice(1),[{s:'s',format:'csv',source:'roles'},{s:'s',format:'xlsx',source:undefined}]);assert.equal(h.downloads.length,2);
 await h.c.page(50);await h.c.copy();assert.equal(h.copied[0],'Faculty\tDOE (%)\r\nExample, Next\t-2');
 h.c.update({...def(),datasets:[]});await h.c.preview();assert.equal(h.c.state().result,null);assert.match(h.c.state().error,/source/i);assert.equal(h.calls.length,3);
});
test('changes to query, identity, support, year or destruction discard pending reads and downloads',async()=>{
 for(const change of ['query','user','support','year','destroy']){const h=fixture();await h.c.initialize();h.c.update(def());let finish;h.api.reportQuery=()=>new Promise(r=>finish=r);const p=h.c.preview();if(change==='query')h.c.update({...def(),academicYear:'2027-28'});if(change==='user')h.setUser({uid:'other',role:'owner'});if(change==='support')h.setContext('delegated');if(change==='year')h.setYear('2027-28');if(change==='destroy')h.c.destroy();finish(preview());await p;assert.equal(h.c.state().result,null,change);}
 const h=fixture();await h.c.initialize();h.c.update(def());await h.c.preview();let finish;h.api.reportExport=()=>new Promise(r=>finish=r);const p=h.c.export('csv');h.setUser(null);finish({fileBase64:'Zg=='});await p;assert.equal(h.downloads.length,0);assert.equal(h.c.state().result,null);
});
test('catalog loading and permission errors clear private state, while retry can recover',async()=>{
 const h=fixture();let finish;h.api.reportCatalog=()=>new Promise(r=>finish=r);const p=h.c.initialize();h.c.destroy();finish(catalog);await p;assert.equal(h.c.state().catalog,null);
 const other=fixture();await other.c.initialize();other.c.update(def());await other.c.preview();other.api.reportPage=async()=>{throw Object.assign(Error('Access denied'),{status:403});};await other.c.page(50);assert.equal(other.c.state().result,null);assert.equal(other.c.state().busy,false);await other.c.preview();assert.equal(other.c.state().result.snapshot,'s');
});
test('builder types numbers explicitly, blank predicates omit values, and table preserves missing/zero',()=>{
 const data=buildDefinition(catalog,{academicYear:'2026-27',datasets:[{...def().datasets[0],filters:[{field:'effectiveDoe',op:'gte',value:'0'},{field:'facultyName',op:'isNotEmpty',value:'ignored'}]}]});assert.equal(data.datasets[0].filters[0].value,0);assert.deepEqual(data.datasets[0].filters[1],{field:'facultyName',op:'isNotEmpty'});
 const t=preview().tables[0];t.rows[0][0]='<script>name</script>';const html=renderTable(t);assert.match(html,/&lt;script/);assert.doesNotMatch(html,/<script>/);assert.match(html,/>0%<\/td>/);assert.match(html,/>N\/A<\/td>/);assert.match(html,/report-number/);
});
