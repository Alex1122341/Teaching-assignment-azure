'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const ID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',SHA='A'.repeat(64),file={name:'CCC.xlsx',size:4,type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',arrayBuffer:async()=>new Uint8Array([1,2,3,4]).buffer};
function batch(options={}){return {batchId:ID,academicYear:'2026-27',dataset:'ccc-calendar',sourceSha256:SHA,status:'staged',previewVersion:'0000000000000001',manifestSha256:SHA,expiresAtUtc:'2026-10-17T20:00:00Z',preview:{issues:[],rows:[{sourceRow:2,displayName:'<script>Faculty</script>',label:'CCC',startDate:'2026-11-02',endDate:'2026-11-04',issues:[]}],targets:[{activityId:'old',label:'Old CCC',startDate:'2026-10-01',endDate:'2026-10-01'}]},...options};}
function harness({source=batch(),gate=true,failure=null,defer=null}={}){
 const {createController}=require('../faculty-admin-ccc-replacement');let uid='actor',keys=0;const calls=[],nodes=new Map(),host={innerHTML:'',querySelector:s=>{if(!nodes.has(s))nodes.set(s,{});return nodes.get(s);}};
 const api={cccReplacementCapabilities:async()=>({writeCapabilities:{cccReplaceStage:true,cccReplaceCommit:gate}}),stageCccReplacement:async p=>{calls.push(['stage',p]);return {...source,manifestSha256:null};},getCccReplacement:async()=>source,previewCccReplacement:async(id,p)=>{calls.push(['preview',p]);return source;},commitCccReplacement:async(id,p)=>{calls.push(['commit',p]);if(defer)return defer;if(failure)throw failure;return {receiptId:ID,insertedCount:1,deletedCount:1};}};
 const c=createController({api,host,getUser:()=>({uid}),randomUUID:()=> 'key-'+(++keys),sha256:async()=>SHA,now:()=>Date.parse('2026-10-17T19:00:00Z')});return {c,api,calls,host,setUid:value=>{uid=value;}};
}
test('CCC full replacement mounts only in the existing admin import page and clears on logout',()=>{
 const fs=require('node:fs'),path=require('node:path'),read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');assert.match(read('faculty-admin.html'),/id="ccc-replacement"/);assert.match(read('faculty-admin.js'),/PAWS_CCC_REPLACEMENT/);assert.match(read('faculty-admin.js'),/cccReplace\?\.clear\(\)/);assert.match(read('tools/static-assets.json'),/faculty-admin-ccc-replacement.js/);
});
test('CCC full old/new preview is escaped, date-only and requires explicit whole-year acknowledgment',async()=>{
 const h=harness();await h.c.open();await h.c.selectFile(file);await h.c.stage();assert.match(h.host.innerHTML,/Old CCC/);assert.match(h.host.innerHTML,/2026-11-04/);assert.match(h.host.innerHTML,/Time not provided/);assert.doesNotMatch(h.host.innerHTML,/<script>/);await h.c.commit();assert.equal(h.calls.filter(x=>x[0]==='commit').length,0);h.c.setConfirmed(true);await h.c.commit();const p=h.calls.find(x=>x[0]==='commit')[1];assert.equal(p.completeDataset,true);assert.equal(p.dataset,'ccc-calendar');assert.equal(p.academicYear,'2026-27');assert.match(h.host.innerHTML,/Replacement confirmed/);
});
test('CCC invalid source, year, blocking rows, expired preview and disabled commit cannot replace',async()=>{
 for(const source of [batch({expiresAtUtc:'2020-01-01T00:00:00Z'}),batch({preview:{issues:['CROSS_YEAR_TARGET'],rows:[],targets:[]}}),batch({preview:{issues:[],rows:[{issues:['UNKNOWN_COURSE']}],targets:[]}})]){const h=harness({source});await h.c.open();await h.c.selectFile(file);await h.c.stage();h.c.setConfirmed(true);await h.c.commit();assert.equal(h.calls.filter(x=>x[0]==='commit').length,0);}
 const h=harness({gate:false});await h.c.open();await h.c.setYear('2026');await h.c.selectFile(file);await h.c.stage();assert.equal(h.calls.length,0);await h.c.setYear('2026-27');for(const f of [{...file,name:'x.csv'},{...file,size:524289}]){await h.c.selectFile(f);await h.c.stage();}assert.equal(h.calls.length,0);await h.c.selectFile(file);await h.c.stage();h.c.setConfirmed(true);await h.c.commit();assert.equal(h.calls.filter(x=>x[0]==='commit').length,0);
});
test('CCC uncertain commits retry exactly the same bindings without accepting new sources',async()=>{
 const h=harness({failure:Object.assign(Error('Unavailable'),{status:503})});await h.c.open();await h.c.selectFile(file);await h.c.stage();h.c.setConfirmed(true);await h.c.commit();await h.c.setYear('2027-28');await h.c.selectFile({...file,name:'Other.xlsx'});await h.c.refresh();await h.c.commit();const calls=h.calls.filter(x=>x[0]==='commit');assert.equal(calls.length,2);assert.deepEqual(calls[0][1],calls[1][1]);assert.match(h.host.innerHTML,/same request key/i);
});
test('CCC conflicts invalidate confirmation and require a fresh preview',async()=>{
 const h=harness({failure:Object.assign(Error('Changed'),{status:409,code:'PREVIEW_CONFLICT'})});await h.c.open();await h.c.selectFile(file);await h.c.stage();h.c.setConfirmed(true);await h.c.commit();await h.c.commit();assert.equal(h.calls.filter(x=>x[0]==='commit').length,1);assert.match(h.host.innerHTML,/fresh preview/i);await h.c.refresh();await h.c.commit();assert.equal(h.calls.filter(x=>x[0]==='commit').length,1);
});
test('CCC account change discards pending receipt and private source state',async()=>{
 let finish;const h=harness({defer:new Promise(r=>{finish=r;})});await h.c.open();await h.c.selectFile(file);await h.c.stage();h.c.setConfirmed(true);const pending=h.c.commit();h.setUid('other');h.c.clear();finish({receiptId:ID,insertedCount:1,deletedCount:1});await pending;assert.equal(h.host.innerHTML,'');
});
test('CCC late preview cannot repopulate source state after logout and reopening',async()=>{
 const h=harness();let finish,started;const begun=new Promise(r=>{started=r;});h.api.previewCccReplacement=()=>{started();return new Promise(r=>{finish=r;});};await h.c.open();await h.c.selectFile(file);const pending=h.c.stage();await begun;h.c.clear();h.setUid('other');await h.c.open();finish(batch());await pending;await h.c.open();assert.doesNotMatch(h.host.innerHTML,/Old CCC|<script>|All proposed CCC activities/);
});
test('CCC preview labels existing rows without database identifiers',async()=>{
 const source=batch();source.preview.targets[0].activityId=ID;const h=harness({source});await h.c.open();await h.c.selectFile(file);await h.c.stage();assert.doesNotMatch(h.host.innerHTML,new RegExp(ID));
});
test('trusted staged MASTER preview shows complete assigned and Locum rows with source cells',async()=>{
 const source=batch();source.preview.formatVersion=2;source.preview.rows[0].staffingKind='assigned';source.preview.slotCounts={total:2,assigned:1,unassigned:1};source.preview.rows.push({sourceRow:3,staffingKind:'unassigned',staffingLabel:'Locum',blockLabel:'Example <Block>',sourceRef:{row:25,column:'D'},startDate:'2026-11-02',endDate:'2026-11-02',label:'CCC',issues:[]});
 const h=harness({source});h.api.getCccReplacement=async()=>source;await h.c.open();await h.c.loadBatch(ID);
 assert.match(h.host.innerHTML,/1 assigned/);assert.match(h.host.innerHTML,/1 unassigned/);assert.match(h.host.innerHTML,/Locum/);assert.match(h.host.innerHTML,/D25/);assert.match(h.host.innerHTML,/Example &lt;Block&gt;/);assert.doesNotMatch(h.host.innerHTML,/<Block>/);
});
