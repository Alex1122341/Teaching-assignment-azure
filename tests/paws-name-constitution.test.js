'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('PAWS Constitution makes the shared Last name, First name rule mandatory',()=>{
 const rule=fs.readFileSync(path.join(root,'PAWS_CONSTITUTION.md'),'utf8');
 assert.match(rule,/Last name, First name/);assert.match(rule,/compound surnames/);
 assert.match(rule,/Historical PDFs/);assert.match(rule,/Names are presentation, not identity/);
 assert.match(fs.readFileSync(path.join(root,'AGENTS.md'),'utf8'),/PAWS_CONSTITUTION\.md/);
});
test('browser and server use identical idempotent person-name rules',()=>{
 const clientSource=fs.readFileSync(path.join(root,'frontend/scripts/faculty-name.js'),'utf8').replace(/\r\n/g,'\n');
 const serverSource=fs.readFileSync(path.join(root,'server/src/domain/person-name.js'),'utf8').replace(/\r\n/g,'\n');
 assert.equal(clientSource,serverSource);
 const client=require('../frontend/scripts/faculty-name'),server=require('../server/src/domain/person-name');
 for(const [value,expected] of [
  [{preferredFirstName:'Mary Jane',preferredLastName:'de la Cruz'},'de la Cruz, Mary Jane'],
  [{firstName:'Jean-Luc',lastName:"O’Neill"},'O’Neill, Jean-Luc'],
  [{preferredFirstName:'',preferredLastName:'',firstName:'Mary Jane',lastName:'de la Cruz',displayName:'Mary Jane de la Cruz'},'de la Cruz, Mary Jane'],
  ['Hall, David C.','Hall, David C.'],['David Hall','Hall, David'],
  ['Not provided','Not provided'],['Faculty name not recorded','Faculty name not recorded'],
  ['PAWS user','PAWS user'],['TBD - New Clin Path Hire - AG','TBD - New Clin Path Hire - AG']
 ]){assert.equal(client.format(value),expected);assert.equal(server.format(value),expected);assert.equal(client.format(client.format(value)),expected);}
 assert.equal(client.format({lastName:'de la Cruz',displayName:'de la Cruz'}),'de la Cruz');
 const names='David Hall; Mary Smith\nLocum';assert.equal(client.formatList(names),'Hall, David; Smith, Mary\nLocum');
 assert.equal(server.formatList(names),client.formatList(names));
});
test('leadership names format once at their authorized API projection with structured context',()=>{
 const source=fs.readFileSync(path.join(root,'server/src/roles/leadership-directory-api.js'),'utf8');
 assert.match(source,/names\.format\(\{firstName:row\.facultyFirstName,lastName:row\.facultyLastName/);
});

test('history person labels follow the shared rule while original change values remain readable',()=>{
 const history=require('../frontend/scripts/change-history');
 const html=history.renderRows([{actor:'David Hall',affectedFaculty:'Mary Smith',previousValue:'David Hall',updatedValue:'Mary Smith'}]);
 assert.match(html,/Hall, David/);assert.match(html,/Smith, Mary/);
 assert.match(html,/From <\/span>David Hall/);assert.match(html,/To <\/span>Mary Smith/);
 const directory=require('../frontend/scripts/leadership-directory');
 const table=directory.renderTable('visc',[{roleType:'VISC',scope:'Anatomy',facultyName:'<Smith>, Mary',status:'active'}]);
 assert.match(table,/&lt;Smith&gt;, Mary/);assert.doesNotMatch(table,/<Smith>/);
});

test('history pages load the formatter before capturing it',()=>{
 for(const page of ['index.html','faculty-admin.html']){
  const html=fs.readFileSync(path.join(root,'frontend/pages',page),'utf8');
  assert.ok(html.indexOf('src="faculty-name.js"')<html.indexOf('src="change-history.js"'),page);
 }
});

test('calendar CN parameters quote comma names and encode parameter metacharacters',()=>{
 const vm=require('node:vm'),sourceFunction=require('../test-support/source-function');
 const context={};vm.createContext(context);
 vm.runInContext(sourceFunction('timetable.js','icsParameter'),context);
 assert.equal(context.icsParameter('Hall, David'),'"Hall, David"');
 assert.equal(context.icsParameter('Hall, D"A^\nNext'),'"Hall, D^\'A^^^nNext"');
});
