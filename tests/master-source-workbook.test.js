'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {readMasterSource}=require('../tools/master-refresh/source-workbook.cjs');
const {fixture,ids}=require('../server/test/fixtures/master-refresh-workbook.cjs');
test('all three staff columns survive and Locum does not become a fake faculty',async()=>{
 const {bytes,context}=await fixture();const r=await readMasterSource(bytes,context);
 assert.equal(r.cccSlots.length,3);assert.equal(new Set(r.cccSlots.map(s=>s.slotKey)).size,3);
 assert.deepEqual(r.cccSlots.map(s=>s.sourceRef.column),['C','D','E']);
 assert.deepEqual(r.cccSlots.map(s=>s.facultyId),[ids[0],ids[1],null]);
 assert.equal(r.cccSlots[2].staffingKind,'unassigned');assert.equal(r.cccSlots[2].staffingLabel,'Locum');
 assert.equal(r.cccSlots[0].startDate,'2026-11-02');
});
test('parser ignores guide/footer and retains missing trainee quantities',async()=>{
 const {bytes,context}=await fixture();const r=await readMasterSource(bytes,context);
 assert.equal(r.trainees.length,2);assert.deepEqual(r.trainees[0].rawCounts,[1,null,53,null,null,null,null]);
 assert.equal(r.trainees[0].sourceTotal,54);assert.equal(r.trainees[1].sourceDoe,null);
 assert.equal(r.trainees[0].rawCounts[2],53);assert.equal(r.appointments.length,2);assert.equal(r.roleDefinitions.length,1);
 assert.equal(r.rotations.length,2);assert.equal(r.rotations[0].workingDateStatus,'needs_review');assert.deepEqual(r.rotations[0].workingDates,[]);
 assert.equal(r.cccAllocations[0].shifts,1);assert.equal(r.cccAllocations[0].sourceDoe,.5);
});
test('source formula and cached value are separate evidence',async()=>{
 const {bytes,context}=await fixture();const r=await readMasterSource(bytes,context);
 assert.equal(r.cccAllocations[0].cellEvidence.shifts.formula,'COUNTIF(C6:E6,N2)');
 assert.equal(r.cccAllocations[0].cellEvidence.shifts.cached,1);
});
test('cached formula zero stays an explicit zero in annual CCC and trainee DOE',async()=>{
 const {bytes,context}=await fixture({mutate:b=>{
  const c=b.getWorksheet('CCC');c.getCell('N3').value='Example, Blair';c.getCell('Q3').value={formula:'0*1',result:0};c.getCell('S3').value={formula:'0*.5',result:0};c.getCell('U3').value={formula:'0*.25',result:0};
  b.getWorksheet('# Trainees').getCell('AA4').value={formula:'0*1',result:0};
 }});
 const r=await readMasterSource(bytes,context);assert.equal(r.cccAllocations.length,2);assert.equal(r.cccAllocations[1].sourceDoe,0);assert.equal(r.cccAllocations[1].shifts,0);assert.equal(r.trainees[1].sourceDoe,0);
});
test('CCC total caption beside Locum is not an invalid annual allocation',async()=>{
 const {bytes,context}=await fixture({mutate:b=>{const c=b.getWorksheet('CCC');c.getCell('N4').value='Locum';c.getCell('Q4').value='TOTAL';}});
 const r=await readMasterSource(bytes,context);assert.equal(r.cccAllocations.length,1);assert.equal(r.issues.some(i=>i.code==='INVALID_QUANTITY'),false);
});
test('wrong workbook hash is rejected before accepting a source',async()=>{
 const {bytes,context}=await fixture();await assert.rejects(readMasterSource(bytes,{...context,expectedSourceSha256:'0'.repeat(64)}),{code:'SOURCE_HASH_MISMATCH'});
});
test('required tab and header changes block source import',async()=>{
 for(const mutate of [b=>b.removeWorksheet('VISCs'),b=>b.getWorksheet('HICCs').getCell('A2').value='Unknown']){
  const {bytes,context}=await fixture({mutate});await assert.rejects(readMasterSource(bytes,context),{code:'MASTER_LAYOUT_INVALID'});
 }
});
test('ambiguous aliases never guess a faculty identity',async()=>{
 const {bytes,context}=await fixture();context.aliases=[{aliasName:'Example, Alex',facultyId:ids[1]}];
 const r=await readMasterSource(bytes,context);assert.equal(r.appointments[0].facultyId,null);assert.ok(r.issues.some(i=>i.code==='AMBIGUOUS_FACULTY'));
});
test('inactive and unresolved faculty are retained as issues without activation',async()=>{
 const {bytes,context}=await fixture({mutate:b=>b.getWorksheet('VISCs').getCell('B3').value='Unknown, Person'});context.faculty[0].active=false;
 const r=await readMasterSource(bytes,context);assert.ok(r.issues.some(i=>i.code==='INACTIVE_FACULTY'));assert.ok(r.issues.some(i=>i.code==='UNRESOLVED_FACULTY'));
 assert.equal(r.appointments[0].facultyId,ids[0]);
});
test('invalid numeric counts cannot be accepted as zero',async()=>{
 const {bytes,context}=await fixture({mutate:b=>b.getWorksheet('# Trainees').getCell('H3').value='unknown'});
 const r=await readMasterSource(bytes,context);assert.ok(r.issues.some(i=>i.code==='INVALID_QUANTITY'));assert.equal(r.trainees[0].rawCounts[2],null);
});
test('source digest and normalized manifest are deterministic without workbook edits',async()=>{
 const {bytes,context}=await fixture();const before=Buffer.from(bytes);const a=await readMasterSource(bytes,context),b=await readMasterSource(bytes,context);
 assert.deepEqual(bytes,before);assert.equal(a.manifestSha256,b.manifestSha256);assert.equal(a.sourceSha256,context.expectedSourceSha256.toUpperCase());
});
test('date-group table filters outside the source do not prevent reading source cells',async()=>{
 const JSZip=require('jszip'),{createHash}=require('node:crypto');
 const f=await fixture({mutate:b=>b.getWorksheet('Other 0').addTable({name:'AuxDateFilter',ref:'A1',headerRow:true,columns:[{name:'Date'}],rows:[[new Date('2027-04-08T00:00:00Z')]]})});
 const zip=await JSZip.loadAsync(f.bytes),file=Object.keys(zip.files).find(n=>/^xl\/tables\/table\d+\.xml$/.test(n));
 const xml=await zip.file(file).async('string');
 const changed=xml.replace(/<autoFilter\b[^>]*(?:\/>|>[\s\S]*?<\/autoFilter>)/,'<autoFilter ref="A1:A2"><filterColumn colId="0"><filters><dateGroupItem year="2027" month="4" day="7" dateTimeGrouping="day"/><dateGroupItem year="2027" month="4" day="8" dateTimeGrouping="day"/><dateGroupItem year="2027" month="4" day="9" dateTimeGrouping="day"/></filters></filterColumn></autoFilter>');
 assert.notEqual(changed,xml,'synthetic date filter must replace a real table autoFilter');zip.file(file,changed);
 const bytes=await zip.generateAsync({type:'nodebuffer'}),context={...f.context,expectedSourceSha256:createHash('sha256').update(bytes).digest('hex')};
 const r=await readMasterSource(bytes,context);assert.equal(r.cccSlots.length,3);assert.equal(r.sourceSha256,context.expectedSourceSha256.toUpperCase());
});
