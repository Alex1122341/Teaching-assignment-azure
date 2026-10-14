'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
test('calendar roles are exact scoped procedure grants with no live memberships or direct DML',()=>{
 const sql=fs.readFileSync(path.resolve(__dirname,'../../database/azure-sql/041_calendar_activity_permissions.sql'),'utf8');
 for(const role of ['paws_runtime_calendar_read','paws_runtime_calendar_stage','paws_runtime_calendar_commit','paws_runtime_calendar_time','paws_calendar_recovery_admin'])assert.match(sql,new RegExp('CREATE ROLE '+role+' AUTHORIZATION dbo'));
 assert.match(sql,/GRANT EXECUTE ON OBJECT::paws_api.ListCalendarActivities TO paws_runtime_calendar_read/);
 assert.doesNotMatch(sql,/ADD\s+MEMBER|GRANT\s+(?:INSERT|UPDATE|DELETE)|GRANT\s+EXECUTE\s+ON\s+SCHEMA|GRANT\s+CONTROL/i);
 assert.match(sql,/DB_NAME\(\)/);assert.match(sql,/BEGIN TRANSACTION/);
});
