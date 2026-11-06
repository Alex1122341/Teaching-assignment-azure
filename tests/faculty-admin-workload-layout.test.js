'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const names=require('../frontend/scripts/faculty-name');

test('profile places one combined Workload / Contract section first, with summary host before folded contract details',()=>{
  const pane={innerHTML:''},calls=[];
  const esc=value=>String(value??'');
  const rendererContext={window:{}};
  vm.runInNewContext(fs.readFileSync('frontend/scripts/faculty-admin-doe-renderer.js','utf8'),rendererContext);
  const renderer=rendererContext.window.UCVM_FACULTY_DOE_RENDERER.create({esc,number:value=>value==null?null:Number(value),formatDoe:value=>value==null?'None':Number(value).toFixed(2)+'%',display:esc,effectiveRoleDoe:()=>({}),groupTeachingAssignments:()=>[]});
  const source=fs.readFileSync('frontend/scripts/faculty-admin.js','utf8');
  const functionSource=source.slice(source.indexOf('  function renderApiDetail('),source.indexOf('  function renderFacultyAfc('));
  const context={
    facultyArchive:null,$:id=>id==='profile-pane'?pane:null,esc,present:value=>value!=null&&value!=='',
    facultyName:value=>names.format(value),field:()=>'',section:title=>`<section>${title}</section>`,apiSection:title=>`<section>${title}</section>`,apiTable:()=>'',
    effectiveRoleDoe:()=>({}),renderFacultyAfc:()=>'<section>AFC marker</section>',renderTeachingCourses:()=>'<section>Teaching marker</section>',
    selfMode:false,currentUser:{},dashboardAdmin:()=>false,facultyAdminWriteEnabled:false,
    facultyManagement:{actions:()=>'',relationshipWarning:()=>''},...renderer,
    currentAcademicYear:()=> '2026-27',text:value=>String(value??''),
    loadDetailDoeWorksheet:(...args)=>calls.push(args),window:{PAWS_ROLE_PERIODS:{status:()=>({label:'Active'}),summary:()=>''}}
  };
  vm.runInNewContext(functionSource+'; renderApiDetail(input);',{...context,input:{
    faculty:{facultyId:'faculty-1',preferredFirstName:'Avery',preferredLastName:'Sample'},academicYear:'2027-28',
    contractDoe:{academicYear:'2027-28',teachingDoe:20,allocations:[]},doeRuleBook:{academicYear:'2027-28',rules:[]},
    teachingAssignments:[{contributorCategory:'Sessional',contributorLabel:'Visiting lecturer'}]
  }});
  const sections=pane.innerHTML.slice(pane.innerHTML.indexOf('<div class="profile-sections">'));
  assert.match(sections, /^<div class="profile-sections"><section class="section wide doe-workload-contract"><div class="section-title">Workload \/ Contract · 2027-28<\/div><div id="faculty-doe-worksheet">/);
  assert.ok(sections.indexOf('id="faculty-doe-worksheet"')<sections.indexOf('Contract allocations'));
  assert.ok(sections.indexOf('Contract allocations')<sections.indexOf('DOE Rule Reference'));
  assert.ok(sections.indexOf('DOE Rule Reference')<sections.indexOf('AFC marker'));
  assert.equal((pane.innerHTML.match(/id="faculty-doe-worksheet"/g)||[]).length,1);
  assert.equal((pane.innerHTML.match(/Workload \/ Contract/g)||[]).length,1);
  assert.match(pane.innerHTML,/Sessional · Visiting lecturer/);
  assert.equal(calls.length,1);
  assert.deepEqual(calls[0].slice(0,2),['faculty-1','2027-28']);
  assert.equal(calls[0][2].teachingDoe,20);
});
