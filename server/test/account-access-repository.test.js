'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createSqlAccountAccessRepository}=require('../src/data/sql-account-access-repository');

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
