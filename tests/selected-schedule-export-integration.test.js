'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const sourceFunction=require('../test-support/source-function');
const {createPawsDataClient}=require('../paws-data-client');
const {createDataApi}=require('../server/src/data/data-api');
const {createSqlSessionRepository}=require('../server/src/data/sql-session-repository');
const own='11111111-1111-4111-8111-111111111111';
function pipeline(profile){
 const calls={queries:[],requests:[],tokens:0};
 const dto=id=>({id,academicYear:'2026-27',curriculumYear:2,courseCode:'206',courseName:'Synthetic course',date:'2026-11-05',startTime:'09:00:00',endTime:'10:00:00',topic:`Topic ${id}`,sessionType:'LAB',room:'A',instructorNames:'Synthetic Faculty',assignmentsJson:JSON.stringify([{facultyId:own,displayName:'Synthetic Faculty',teachingRole:'LAB',active:1}])});
 const repository=createSqlSessionRepository({query:async(sql,params)=>{calls.queries.push({sql,params});return params.facultyId?[dto('own')]:[dto('own'),dto('other')];}});
 const api=createDataApi({verifyToken:async token=>{assert.equal(token,'synthetic-token');return{uid:'synthetic-uid'};},findUser:async uid=>{assert.equal(uid,'synthetic-uid');return profile;},listSessions:repository.list});
 const client=createPawsDataClient({tokenProvider:async()=>{calls.tokens++;return'synthetic-token';},fetchImpl:async(url,init)=>{
  calls.requests.push({url,init});assert.equal(init.method,'GET');const parsed=new URL(url);assert.equal(parsed.pathname,'/api/v1/sessions');
  const reply=await api.sessions(init.headers.Authorization.slice(7),Object.fromEntries(parsed.searchParams));return{ok:reply.status===200,status:reply.status,json:async()=>reply.body};
 }});
 const context={Date,Map,Set,Promise,console,currentUser:{uid:'synthetic-uid'},UCVM_PAWS_DATA:client,allSessionsCache:null,allSessionsOwnerUid:'',allSessionsLoading:null,allSessionsLoadingUid:'',allSessionsLoadGeneration:0,sessionCache:new Map(),pageDataSubscribers:new Set()};context.window=context;vm.createContext(context);
 const text=fs.readFileSync('timetable.js','utf8');
 for(const name of ['SPRING_BASE_MONDAY','FALL_BASE_MONDAY','WINTER_BASE_MONDAY','WEEK_COUNT']){const line=text.split('\n').find(line=>line.includes(`const ${name} =`));assert.ok(line);vm.runInContext(line,context);}
 for(const file of ['scheduling-core.js','timetable-selection.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
 for(const name of ['addDays','parseYmd','academicPositionForDate','splitInstructorNames','mapPawsSessionRow','fetchPawsSessions','fullSessionCacheForUser','publishPageData','ensureAllSessions'])vm.runInContext(sourceFunction('timetable.js',name),context);
 return{context,calls};
}

test('selected report uses real client/API/repository/loader with server-resolved role scope and no mutation',async()=>{
 for(const role of ['faculty','hicc','visc','administrator','owner','adfa_general','adfa_regular','adc','lab']){
  const scoped=['faculty','hicc','visc'].includes(role),{context,calls}=pipeline({active:true,mustChangePassword:false,baseRole:role,facultyId:own});
  const rows=await context.ensureAllSessions({refresh:true,notify:false});const model=context.UCVM_TIMETABLE_SELECTION.createExport(rows);model.selectAll();
  assert.equal(model.size,scoped?1:2,role);assert.equal(calls.tokens,1);assert.equal(calls.queries.length,1);
  assert.match(calls.queries[0].sql,/FROM paws\.vCalendarSession/);
  if(scoped){assert.equal(calls.queries[0].params.facultyId,own);assert.match(calls.queries[0].sql,/sa\.FacultyId = @facultyId/);}else assert.equal(calls.queries[0].params.facultyId,undefined);
  assert.doesNotMatch(model.csv(),new RegExp(own+'|assignmentsJson|facultyId|UCID|Email|DOE'));
  assert.match(model.csv(),/"09:00","10:00"/);assert.equal(model.preview()[0].visc,'Not provided');
  await context.ensureAllSessions({refresh:true,notify:false});assert.equal(calls.queries.length,2,'download fresh-read path reaches API/SQL again');
 }
});

test('unauthorized profiles fail before the session query and revocation defeats the next fresh export read',async()=>{
 for(const profile of [null,{active:false,baseRole:'administrator'},{active:true,mustChangePassword:true,baseRole:'administrator'},{active:true,mustChangePassword:false,baseRole:'viewer'},{active:true,mustChangePassword:false,baseRole:'faculty',facultyId:null}]){
  const {context,calls}=pipeline(profile);await assert.rejects(context.ensureAllSessions({refresh:true,notify:false}),error=>error.status===403);
  assert.equal(calls.queries.length,0);assert.equal(context.allSessionsCache,null);
 }
 const profile={active:true,mustChangePassword:false,baseRole:'faculty',facultyId:own},{context,calls}=pipeline(profile);
 assert.equal((await context.ensureAllSessions({refresh:true,notify:false})).length,1);profile.active=false;
 await assert.rejects(context.ensureAllSessions({refresh:true,notify:false}),error=>error.status===403);assert.equal(calls.queries.length,1);
});
