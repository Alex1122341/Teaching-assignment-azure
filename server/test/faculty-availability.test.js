'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createFacultyAvailabilityApi}=require('../src/availability/faculty-availability-api');
const {createFacultyAvailabilityFunctions}=require('../src/runtime/swa-faculty-availability-functions');
const {createSqlFacultyAvailabilityRepository}=require('../src/data/sql-faculty-availability-repository');
const facultyId='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const authorized={baseRole:'adfa_regular',active:true,mustChangePassword:false};
const make=(profile=authorized)=>createFacultyAvailabilityApi({
 verifyToken:async token=>{if(token!=='ok')throw Error('invalid');return{uid:'actor'}},
 findUser:async()=>profile,
 repository:{list:async query=>({items:[],total:0,nextCursor:null,coverage:{undatedSessions:0,undatedRoles:0},today:'2026-10-20',input:query})}
});
test('requires authenticated user and rejects other Faculty in self service',async()=>{
 assert.equal((await make().list('',facultyId)).status,401);
 assert.equal((await make({baseRole:'faculty',facultyId,active:true,mustChangePassword:false}).list('ok',other)).status,403);
 assert.equal((await make({baseRole:'hicc',facultyId,active:true,mustChangePassword:false}).list('ok',facultyId)).status,200);
 assert.equal((await make({baseRole:'faculty',facultyId,active:false,mustChangePassword:false}).list('ok',facultyId)).status,403);
});
test('date rules: default upcoming, from past, inclusive range, impossible dates',async()=>{
 const api=make();
 assert.equal((await api.list('ok',facultyId)).body.input.mode,'upcoming');
 assert.equal((await api.list('ok',facultyId,{mode:'from',startDate:'2025-05-01'})).status,200);
 assert.equal((await api.list('ok',facultyId,{mode:'range',startDate:'2025-01-01',endDate:'2025-01-31'})).status,200);
 for(const x of [{mode:'range',startDate:'2027-02-30',endDate:'2027-03-01'},{mode:'range',startDate:'2026-09-10',endDate:'2026-09-01'},{mode:'from'}, {mode:'upcoming',startDate:'2026-09-01'}, {mode:'range',startDate:'2026-10-01'}])
  assert.equal((await api.list('ok',facultyId,x)).status,400);
});
test('bounded cursor and kind validation prevents unauthorized broad reads',async()=>{
 const api=make();
 assert.equal((await api.list('ok',facultyId,{limit:'101'})).status,400);
 assert.equal((await api.list('ok',facultyId,{cursor:'-1'})).status,400);
 assert.equal((await api.list('ok',facultyId,{kind:'sensitive'})).status,400);
 assert.equal((await api.list('ok','bad-uid')).status,400);
});
test('SQL adapter is only the reviewed read-only procedure with canonical identity',async()=>{
 const calls=[];
 const repository=createSqlFacultyAvailabilityRepository({query:async(text,args)=>{calls.push({text,args});return[{responseJson:JSON.stringify({items:[],total:0})}]}});
 await repository.list({actorFirebaseUid:'actor',facultyId,mode:'range',startDate:'2024-01-01',endDate:'2024-03-01',kind:'afc',cursor:0,limit:50});
 assert.match(calls[0].text,/EXEC paws_api.ListFacultyAvailability/);
 assert.equal(calls[0].args.facultyId,facultyId);
 assert.doesNotMatch(calls[0].text,/\b(?:INSERT|UPDATE|DELETE|MERGE)\b/i);
});
test('route validates methods, query duplication and return shape',async()=>{
 const route=createFacultyAvailabilityFunctions({api:make()});
 const r=(url,method='GET')=>route({url:'https://localhost'+url,method,headers:{get:()=> 'Bearer ok'}});
 assert.equal((await r('/api/v1/faculty/'+facultyId+'/availability')).status,200);
 assert.equal((await r('/api/v1/faculty/'+facultyId+'/availability','POST')).status,405);
 assert.equal((await r('/api/v1/faculty/'+facultyId+'/availability?kind=all&kind=afc')).status,400);
});
