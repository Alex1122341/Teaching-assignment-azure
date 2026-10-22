'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const ctx={window:{}};
vm.runInNewContext(read('faculty-name.js'),ctx);
const names=ctx.window.PAWS_FACULTY_NAME;
test('faculty name display uses last name, comma, first name, preferring structured source',()=>{
 assert.equal(names.format({preferredFirstName:'David C.',preferredLastName:'Hall',displayName:'Wrong Person'}),'Hall, David C.');
 assert.equal(names.format({PreferredFirstName:'Anne',PreferredLastName:'de la Cruz'}),'de la Cruz, Anne');
 assert.equal(names.format({firstName:'Mary Jane',lastName:'Smith'}),'Smith, Mary Jane');
 assert.equal(names.format({displayName:'John Smith'}),'Smith, John');
 assert.equal(names.format('David Hall'),'Hall, David');
 assert.equal(names.format('Hall, David'),'Hall, David');
 assert.equal(names.format(names.format('David Hall')),'Hall, David');
});
test('faculty name display preserves non-person labels, IDs and email placeholders',()=>{
 for(const value of ['Locum','TBD','Other / Unassigned','Unknown faculty','Faculty 001','Faculty not provided','Instructor not provided','Name unavailable','admin@ucalgary.ca','11111111-1111-4111-8111-111111111111']){
  assert.equal(names.format(value),value);
 }
 assert.equal(names.format(''), '');
 assert.equal(names.format(null,'Name unavailable'),'Name unavailable');
});
test('rendering name lists preserves separators, roles and original input',()=>{
 const raw='David Hall; Mary Smith\nHall, David (Primary); Locum';
 assert.equal(names.formatList(raw),'Hall, David; Smith, Mary\nHall, David (Primary); Locum');
 assert.equal(names.formatList(names.formatList(raw)),names.formatList(raw));
 const record=Object.freeze({preferredFirstName:'David',preferredLastName:'Hall',displayName:'David Hall'});
 assert.equal(names.format(record),'Hall, David');
 assert.equal(record.displayName,'David Hall','presentation must not mutate API/persistence data');
});
test('faculty-name helper is loaded on every standalone faculty UI page before controllers',()=>{
 for(const [page,controller] of [['index.html','timetable.js'],['faculty-admin.html','faculty-admin.js'],['teaching-assignments.html','teaching-assignments.js'],['user-management.html','user-management.js']]){
  const html=read(page),helper=html.indexOf('src="faculty-name.js"'),entry=html.indexOf('src="'+controller+'"');
  assert.ok(helper>=0&&entry>helper,page+' must load shared formatter before the page controller');
 }
});
test('UI-specific name sinks format without changing request/storage contracts',()=>{
 const expected={
  'timetable.js':['displayFacultyList(s.instructor','displayFaculty(swapFacultyName'],
  'ccc-schedule.js':['PAWS_FACULTY_NAME?.format?.(row.facultyName)'],
  'faculty-admin.js':['PAWS_FACULTY_NAME.format(record'],
  'faculty-admin-doe-worksheet.js':['showFaculty(row.displayName'],
  'faculty-admin-trainees.js':['showFaculty(r.displayName)'],
  'faculty-availability.js':['showFaculty(r)'],
  'adfa-swap-panel.js':['showFaculty(candidate.displayName)'],
  'faculty-admin-ccc-replacement.js':['PAWS_FACULTY_NAME?.format?.(r.displayName'],
  'teaching-assignments.js':['displayFaculty(a.facultyName'],
  'user-management.js':['displayFaculty(user.name)'],
  'workspace-tasks.js':['showFaculty(task.displayName'],
  'approval-workflow.js':['displayFacultyList(assignedArray(s)'],
  'afc-workflow-sql.js':['showFaculty(request.facultyName)']
 };
 for(const [file,patterns] of Object.entries(expected))for(const text of patterns)assert.ok(read(file).includes(text),file+' missing '+text);
 const user=read('user-management.js');
 assert.ok(user.includes('name:facultyName(faculty)'),'canonical account provisioning name stays raw');
 const timetable=read('timetable.js');
 assert.ok(timetable.includes('function swapFacultyName(f)'),'original assignment-name aliases retained');
});
