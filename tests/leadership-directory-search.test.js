'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const lib=require('../frontend/scripts/leadership-directory');
const fs=require('node:fs');
const row=(facultyName,status='active',endDate='2027-04-30',scope='VETM 300')=>({facultyName,status,endDate,scope,roleType:'HICC',startDate:'2026-05-01'});
test('directory search matches every word across only public display fields in either name order',()=>{
 const rows=[row('Müller, Élodie'),row('de la Cruz, Mary Jane'),row('O’Neill, Jean-Luc')];
 assert.deepEqual(lib.viewRows(rows,{query:'elodie muller 300'}),[rows[0]]);
 assert.deepEqual(lib.viewRows(rows,{query:'mary cruz HICC'}),[rows[1]]);
 assert.deepEqual(lib.viewRows(rows,{query:"o'neill jean-luc"}),[rows[2]]);
 assert.deepEqual(lib.viewRows(rows,{query:'muller cruz'}),[]);
 assert.deepEqual(lib.viewRows([{...rows[0],email:'secret@example.test'}],{query:'secret'}),[]);
});
test('search preserves default status population and sorts a copy with unknown dates last',()=>{
 const rows=[row('Zed, Casey','inactive','2026-10-01'),row('Alpha, Avery','dates-needed',null),row('Beta, Bea')];
 const before=JSON.stringify(rows);
 assert.deepEqual(lib.viewRows(rows,{}),rows.slice(1));
 assert.deepEqual(lib.viewRows(rows,{showAll:true,sort:'faculty'}).map(r=>r.facultyName),['Alpha, Avery','Beta, Bea','Zed, Casey']);
 assert.deepEqual(lib.viewRows(rows,{showAll:true,sort:'end-date'}),[rows[0],rows[2],rows[1]]);
 assert.equal(JSON.stringify(rows),before);
 assert.notEqual(lib.viewRows(rows,{showAll:true}),rows);
 assert.deepEqual(lib.viewRows(rows,{query:'inactive'}),[]);
 assert.deepEqual(lib.viewRows(rows,{showAll:true,query:'inactive'}),[rows[0]]);
});
test('query misses explain the active search and provide a clear action with escaped text',()=>{
 const html=lib.renderTable('hicc-cc',[],4,'<Missing>');
 assert.match(html,/No appointments match/);
 assert.match(html,/&lt;Missing&gt;/);
 assert.match(html,/data-leadership-clear/);
 assert.doesNotMatch(html,/<Missing>|inactive or upcoming records are hidden/);
});
test('labelled search/sort, shared tokens and keyboard controls remain inside the existing dialog',()=>{
 const html=fs.readFileSync(require('node:path').join(__dirname,'../frontend/pages/index.html'),'utf8');
 assert.match(html,/Search appointments<input type="search" id="leadership-directory-search"/);
 assert.match(html,/Sort by<select id="leadership-directory-sort"/);
 assert.match(html,/id="leadership-directory-clear" disabled/);
 assert.match(html,/<label class="fbar-label" for="search-input">Search/);
 const source=fs.readFileSync(require('node:path').join(__dirname,'../frontend/scripts/leadership-directory.js'),'utf8');
 assert.match(source,/select:not\(\[disabled\]\)/);
 assert.match(source,/body\.setAttribute\('aria-busy',String\(loading\)\)/);
 assert.match(source,/search\.value='';sort\.value='scope'/);
});
test('refresh moves focus to an enabled dialog control before disabling the focused button',async()=>{
 const vm=require('node:vm'),elements=new Map(),doc={activeElement:null};
 const ids=['overlay','heading','subtitle','close','refresh','show-all','search','sort','clear','status','body'];
 for(const id of ids){const el={value:'',checked:false,hidden:true,isConnected:true,events:{},setAttribute(){},focus(){doc.activeElement=this;},addEventListener(type,fn){this.events[type]=fn;},querySelector(){return {setAttribute(){}};}};let disabled=false;Object.defineProperty(el,'disabled',{get:()=>disabled,set:value=>{disabled=value;if(value&&doc.activeElement===el)doc.activeElement=null;}});elements.set('leadership-directory-'+id,el);}
 doc.getElementById=id=>elements.get(id);
 const response={academicYear:'2026-27',asOfDate:'2026-10-23',hiccCc:[],visc:[]};
 let fetch=()=>Promise.resolve(response);
 const window={document:doc,firebase:{auth:()=>({currentUser:{uid:'fixture'}})},UCVM_PAWS_DATA:{leadershipDirectory:()=>fetch()},addEventListener(){}};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../frontend/scripts/leadership-directory.js'),'utf8'),{window});
 window.PAWS_LEADERSHIP_DIRECTORY.open('hicc-cc','2026-27');await new Promise(resolve=>setImmediate(resolve));
 let finish;fetch=()=>new Promise(resolve=>{finish=resolve;});
 const refresh=elements.get('leadership-directory-refresh');refresh.focus();const pending=refresh.events.click();
 assert.equal(refresh.disabled,true);
 assert.equal(doc.activeElement,elements.get('leadership-directory-search'),'focus stays on an enabled control inside the dialog');
 finish(response);await pending;
});
