'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createSqlAccountAccessRepository}=require('../src/data/sql-account-access-repository');

test('account receipts canonicalize SQL GUIDs without changing case-sensitive Firebase identities',async()=>{
 const operationId='5d4e1c5a-b696-4cf2-8a1b-24a1548fc71e',previewId='bd44056f-2571-404b-99cb-a406c9e89c1f';
 const stored={operationId:operationId.toUpperCase(),previewId:previewId.toUpperCase(),actorUid:'OwnerMixedCase',targetUid:'FacultyMixedCase'};
 const repo=createSqlAccountAccessRepository({query:async()=>[{receiptJson:JSON.stringify(stored)}]});
 assert.deepEqual(await repo.operation(operationId),{...stored,operationId,previewId});
});

test('SQL account reads are bounded, parameterized and exclude confidential faculty fields',async()=>{
 const calls=[],profile={firebaseUid:'account',displayName:'Taylor Example',baseRole:'faculty',active:true,version:'0000000000000001'};
 const repo=createSqlAccountAccessRepository({query:async(sql,params)=>{calls.push({sql,params});return [profile];}});
 assert.deepEqual(await repo.read("a'; DELETE secret--"),profile);assert.deepEqual(calls[0].params,{uid:"a'; DELETE secret--"});assert.doesNotMatch(calls[0].sql,/DELETE secret/);
 assert.deepEqual(await repo.list(),[profile]);assert.match(calls[1].sql,/TOP\s*\(1001\)/i);
 assert.match(calls[0].sql,/AccessVersion/);assert.doesNotMatch(calls.map(x=>x.sql).join(' '),/SELECT\s+\*|\bUcid\b|\bFte\b|\bRank\b|\bDoe\b/i);
});

test('SQL access mutation delegates one exact command and returns its persisted receipt',async()=>{
 const args={actorUid:'owner',actorVersion:'0000000000000001',targetUid:'account',expectedVersion:'0000000000000002',after:{role:'faculty',active:false,facultyId:null},reason:'Approved removal',intentHash:'a'.repeat(64),operationId:'10000000-0000-4000-8000-000000000001',previewId:'10000000-0000-4000-8000-000000000002'};
 const receipt={...args,profile:{firebaseUid:'account',version:'0000000000000003'},before:{role:'faculty',active:true,facultyId:null},createdAtUtc:'2026-10-26T18:00:00Z'};let called;
 const repo=createSqlAccountAccessRepository({query:async(sql,params)=>{called={sql,params};return [{receiptJson:JSON.stringify(receipt)}];}});
 assert.deepEqual(await repo.commit(args),receipt);assert.match(called.sql,/EXEC paws_api\.SetAccountAccess/);assert.deepEqual(called.params,{actorUid:'owner',actorVersion:'0000000000000001',targetUid:'account',expectedVersion:'0000000000000002',role:'faculty',active:false,facultyId:null,reason:'Approved removal',intentHash:'a'.repeat(64),operationId:args.operationId,previewId:args.previewId});
 assert.doesNotMatch(called.sql,/INSERT|UPDATE paws\./i);
});

test('collaboration directory reads canonical people without login contacts or HR data',async()=>{
 let statement;const rows=[{firebaseUid:'member',facultyId:'10000000-0000-4000-8000-000000000001',displayName:'Taylor Example',baseRole:'faculty',active:true,facultyActive:true}];
 const repo=createSqlAccountAccessRepository({query:async sql=>{statement=sql;return rows;}});
 assert.deepEqual(await repo.collaborators(),rows);assert.match(statement,/TOP\s*\(1001\)/i);assert.match(statement,/JOIN paws\.Faculty/i);assert.match(statement,/PreferredLastName/);assert.doesNotMatch(statement,/SELECT\s+\*|\bEmail\b|\bUcid\b|\bFte\b|\bRank\b|\bDoe\b/i);
});
