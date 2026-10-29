'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const sourceFunction=require('../test-support/source-function');
test('Calendar admin directory uses the authorized canonical SQL roster without legacy DOE index facts',async()=>{
 const calls=[],user={uid:'owner'},ctx={currentUser:user,facultyDirectory:[],facultyLoading:null,db:{collection(){throw Error('No compatibility business read');}},UCVM:{admin:()=>true},window:{UCVM_PAWS_DATA:{dashboardFaculty:async input=>{calls.push(input);return [{facultyId:'canonical',displayName:'de la Cruz, Mary Jane',active:true,email:'business@example.test'}];}},dispatchEvent(){}},Event:class{},swapFacultyName:r=>r.displayName,console:{error(){}},toast(){}};
 vm.createContext(ctx);vm.runInContext(sourceFunction('timetable.js','ensureFacultyDirectory'),ctx);
 const rows=await ctx.ensureFacultyDirectory();assert.equal(rows.length,1);assert.equal(rows[0].__id,'canonical');assert.equal(rows[0].email,'business@example.test');assert.equal(rows[0].__indexAssignedTeachingDOE,undefined);assert.deepEqual(JSON.parse(JSON.stringify(calls)),[{limit:500,status:'active'}]);
});
test('Calendar own faculty enrichment uses the scoped detail API and drops a late different-identity response',async()=>{
 let done;const ctx={currentUser:{uid:'A',profile:{facultyId:'canonical-a'}},currentFacultyRecord:null,currentFacultyLoading:null,currentFacultyLoadingKey:'',db:{collection(){throw Error('No compatibility read');}},window:{UCVM_PAWS_DATA:{dashboardFacultyById:id=>{assert.equal(id,'canonical-a');return new Promise(resolve=>done=resolve);}}},publishPageData(){},clearCurrentFaculty(){},console:{error(){}}};
 vm.createContext(ctx);vm.runInContext(sourceFunction('timetable.js','ensureCurrentFaculty'),ctx);
 const pending=ctx.ensureCurrentFaculty();assert.equal(typeof done,'function');ctx.currentUser={uid:'B',profile:{facultyId:'canonical-b'}};done({faculty:{facultyId:'canonical-a',displayName:'Person, A'}});await pending;assert.equal(ctx.currentFacultyRecord,null);
});
test('Calendar availability entry reuses the existing scoped SQL availability panel without parallel privacy logic',()=>{
 const source=fs.readFileSync('frontend/scripts/availability-lookup.js','utf8');
 assert.match(source,/PAWS_FACULTY_AVAILABILITY/);assert.match(source,/createFacultyAvailability/);assert.match(source,/loadScriptOnce\('faculty-availability.js'/);
 assert.doesNotMatch(source,/db\.(?:doc|collection)|awayFromCampusRecords|function assess\(/);
});
