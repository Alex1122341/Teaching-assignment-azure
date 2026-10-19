'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {compareMasterDoe,prepareMasterPolicyCandidate}=require('../src/master-refresh/master-doe-reconciliation');
const faculty='AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',role='BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB';
const bundle={version:{policyVersionId:'active',academicYear:'2026-27',status:'active',revision:1},rules:[],exceptions:[],references:[],courseMappings:[],subjectMappings:[]};
const fixture=(value=1)=>({source:{academicYear:'2026-27',sourceSha256:'A'.repeat(64),manifestSha256:'B'.repeat(64),appointments:[],rotations:[{facultyId:faculty,identityStatus:'resolved',roleType:'Designated Rotation Coordinator',scope:'Example',sourceDoe:value,facts:{uniqueRotationTypes:1},sourceRef:{sheet:'Rotations',row:2,column:'J'}}],cccAllocations:[],trainees:[],roleDefinitions:[]},currentRoles:[{facultyId:faculty,roleId:role,roleType:'Designated Rotation Coordinator',scope:'Example',mappedDoe:2,overrideDoe:null}],supervision:[],activeBundle:bundle,candidateBundle:bundle});
test('existing 2/source 1 coordinator is held without proposed credit overwrite',async()=>{
 const result=await compareMasterDoe({...fixture(),calculate:async()=>({resultDoe:2})});
 assert.equal(result.held[0].status,'held_mismatch');assert.equal(result.held[0].storedDoe,2);assert.equal(result.held[0].sourceDoe,1);assert.equal(result.matching.length,0);assert.equal(Object.hasOwn(result.held[0],'newDoe'),false);
});
test('source-null retains stored 40 and new null-source receives no generic credit',async()=>{
 const input=fixture(null);input.currentRoles[0].mappedDoe=40;
 const result=await compareMasterDoe({...input,calculate:async()=>({resultDoe:40})});assert.equal(result.held[0].storedDoe,40);assert.equal(result.held[0].status,'source_missing');
 input.currentRoles=[];const next=await compareMasterDoe({...input,calculate:async()=>assert.fail('Missing source new role inferred credit')});assert.equal(next.rows[0].candidateDoe,null);
});
test('canonical identity and stable source ID reach scoped exception calculation unchanged',async()=>{
 const seen=[];const result=await compareMasterDoe({...fixture(2),calculate:async p=>{seen.push(p.facts);return{resultDoe:2};}});
 assert.equal(result.matching.length,1);assert.ok(seen.every(f=>f.facultyId===faculty&&f.sourceEntityId===role));
});
test('zero and negative explicit overrides survive and alter the guard hash',async()=>{
 const first=fixture(0);first.currentRoles[0].overrideDoe=0;
 const a=await compareMasterDoe({...first,calculate:async()=>({resultDoe:0})});assert.equal(a.rows[0].storedDoe,0);
 first.currentRoles[0].overrideDoe=-2;
 const b=await compareMasterDoe({...first,calculate:async()=>({resultDoe:0})});assert.equal(b.rows[0].storedDoe,-2);assert.equal(b.rows[0].status,'held_mismatch');assert.notEqual(a.doeGuardHash,b.doeGuardHash);
});
test('literal grouped VISC scope stays one assignment and CCC deduction is supplied once',async()=>{
 const input=fixture();input.source.rotations=[];input.currentRoles=[];
 input.source.appointments=[{facultyId:faculty,identityStatus:'resolved',roleType:'VISC',scope:'Area A / Area B',sourceDoe:5,facts:{subjectCount:1}}];
 input.source.cccAllocations=[{facultyId:faculty,identityStatus:'resolved',shifts:10,halfDayDeduction:0.5,sourceDoe:4.5}];
 const facts=[];const result=await compareMasterDoe({...input,calculate:async p=>{facts.push(p.facts);return{resultDoe:p.facts.roleType==='CCC'?p.facts.shifts*0.5-p.facts.halfDayDeduction:5};}});
 assert.equal(result.rows.length,2);assert.equal(result.matching.length,2);assert.equal(facts.find(f=>f.roleType==='VISC').subjectKey,'Area A / Area B');assert.equal(result.rows.find(r=>r.roleType==='CCC').candidateDoe,4.5);
});
test('removed allocations are held and never become delete operations',async()=>{
 const input=fixture();input.source.rotations=[];
 const result=await compareMasterDoe({...input,calculate:async()=>assert.fail('Removed role calculated')});assert.equal(result.held[0].status,'held_removal');assert.equal(result.held[0].storedDoe,2);
});
test('Draft preparation requests a fresh clone with exceptions and never publishes',async()=>{
 const calls=[],input=fixture(2),draft={...bundle,version:{...bundle.version,policyVersionId:'new-draft',status:'draft',revision:1}};
 const result=await prepareMasterPolicyCandidate({...input,actorUid:'admin',calculate:async()=>({resultDoe:2}),policyRepository:{clonePolicy:async p=>{calls.push(p);return draft;}},policyService:{saveDraft:async p=>{calls.push(p);return{...draft,version:{...draft.version,revision:2}};},validateDraft:async p=>{calls.push(p);return{valid:true};}}});
 assert.equal(calls[0].includeExceptions,true);assert.equal(calls[0].reuseWorkingDraft,false);assert.equal(calls[1].policyVersionId,'new-draft');assert.equal(calls[1].patch.sourceReference.includes(input.source.sourceSha256),true);assert.equal(result.policyVersionId,'new-draft');assert.equal(result.comparison.matching.length,1);
});
test('actual annual engine applies the existing canonical source-entity exception',async()=>{
 const input=fixture(1);input.currentRoles[0].mappedDoe=1;
 const active={...bundle,exceptions:[{exceptionId:'exception-1',category:'rotation',scopeType:'source_entity',scopeKey:role,facultyId:faculty,fixedDoe:1,enabled:true,reviewStatus:'approved',sourceReference:'Synthetic approved exception'}]};
 const result=await compareMasterDoe({...input,activeBundle:active,candidateBundle:active});
 assert.equal(result.rows[0].activeDoe,1);assert.equal(result.rows[0].candidateDoe,1);assert.equal(result.rows[0].status,'matched');
});
test('policy impact never fills a source-missing role with a default rule',async()=>{
 const {projectRecordedSource}=require('../src/doe/doe-recorded-source-impact');
 const result=await projectRecordedSource({source:{academicYear:'2026-27',facultyId:faculty},line:{sourceEntityType:'legacy_role_assignment',sourceEntityId:role,roleType:'VISC',resultDoe:null,facts:{sourceAllocationStatus:'source_missing'}},calculate:async()=>assert.fail('Default calculation replaced a missing source')});
 assert.equal(result.projectedDoe,null);assert.equal(result.issueCode,'SOURCE_ALLOCATION_MISSING');
});
test('new source-backed CCC quantities take precedence over legacy details',()=>{
 const {sourceFacts}=require('../src/doe/doe-recorded-source-impact');
 const facts=sourceFacts({academicYear:'2026-27',facultyId:faculty},{roleType:'CCC',facts:{shifts:10,halfDayDeduction:0,sourceDetails:'shifts=20 | halfDayDeduction=1'}});
 assert.equal(facts.shifts,10);assert.equal(facts.halfDayDeduction,0);
});
