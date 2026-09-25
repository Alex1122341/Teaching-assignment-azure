const test=require('node:test'),assert=require('node:assert/strict');
const {createSqlUserRepository}=require('../src/data/sql-user-repository');
const {createSqlSessionRepository}=require('../src/data/sql-session-repository');
test('user lookup is read-only and canonical',async()=>{let sql;const r=createSqlUserRepository({query:async(q)=>{sql=q;return []}});assert.equal(await r.findByUid('u'),null);assert.match(sql,/FROM paws\.UserProfile/);assert.doesNotMatch(sql,/INSERT|UPDATE|staging\./i);});
test('session query is canonical, bounded, and can require faculty assignment',async()=>{let seen;const r=createSqlSessionRepository({query:async(q,p)=>{seen={q,p};return []}});await r.list({start:'2026-01-01',end:'2026-01-02',facultyId:'f'});assert.match(seen.q,/paws\.vCalendarSession/);assert.match(seen.q,/paws\.SessionAssignment/);assert.doesNotMatch(seen.q,/staging\./i);assert.equal(seen.p.facultyId,'f');});
