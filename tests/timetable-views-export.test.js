const { repositoryPath } = require('../tools/build/frontend-paths');
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const root=repositoryPath(__dirname,'..');
const html=['index.html','timetable.js'].map(name=>fs.readFileSync(repositoryPath(root,name),'utf8')).join('\n');

test('course filter supports selecting several courses',()=>{
 assert.match(html,/id="filter-course-options"/);
 assert.match(html,/selectedCourses/);
 assert.match(html,/data-course-choice/);
 assert.doesNotMatch(html,/id="filter-course">/);
});

test('timetable has day, week, month and future list views',()=>{
 for(const id of ['cal-day-btn','cal-week-btn','cal-month-btn','cal-list-btn'])assert.match(html,new RegExp(`id="${id}"`));
 assert.match(html,/function renderDay/);
 assert.match(html,/function renderList/);
 assert.match(html,/viewMode\s*=\s*roleIsFaculty\(currentUser\)\s*\?\s*'day'/);
 assert.match(html,/roleIsFaculty/);
});

test('CCC and work activities share the complete type picker and never become generated teaching sessions',()=>{
 assert.match(html,/id="activity-type-filter"/);assert.match(html,/renderRangeLane/);assert.doesNotMatch(html,/ccc_events|expandCccEvents|loadCccEvents/);
 assert.match(fs.readFileSync(repositoryPath(root,'calendar-activities.js'),'utf8'),/listCalendarActivities/);
});

test('CSV and calendar exports use filters and support date, academic, and all scopes',()=>{
 assert.match(html,/id="export-calendar"/);
 assert.match(html,/text\/calendar/);
 assert.match(html,/BEGIN:VCALENDAR/);
 for(const scope of ['date','academic','all'])assert.match(html,new RegExp(`value="${scope}"`));
 assert.match(html,/ensureAllSessions/);
 assert.match(html,/exportFilteredRows/);
});
