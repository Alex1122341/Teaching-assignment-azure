'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const file=path.resolve(__dirname,'../tools/testing-host/host-policy.js'),api=fs.existsSync(file)?require(file):{};
const {GATE_ENV}=require('../server/src/data/write-gates');
const profile={computerName:'ITAPPVETOPSDB01',windowsIdentity:'UC\\synthetic',apiPort:18788,
 target:{profile:'university-testing',host:'itappvetopsdb01',physicalServer:'ITAPPVETOPSDB01',database:'VetMed-Ops-Testing',environmentId:'7e570000-0000-4000-8000-00000000c0de'},
 firebaseProjectId:'paws-testing-ucvm-20261022',allowedOrigin:'https://paws-testing-ucvm-20261022.web.app',
 gateMap:Object.fromEntries(Object.keys(GATE_ENV).map(key=>[key,false])),privateRoot:'P:\\PAWS\\Testing\\Host',
 releaseManifestPath:'P:\\PAWS\\Testing\\Host\\releases\\candidate.json'};
const proc={pid:1234,startTime:'2026-10-22T20:00:00.000Z',executable:'C:\\Tools\\node22\\node.exe',executableSha256:'a'.repeat(64),entrypoint:'version/server/src/runtime/university-api.js'};
function harness(extra={}){
 const mutationCalls=[],killedPids=[];
 const observed={computerName:profile.computerName,windowsIdentity:profile.windowsIdentity,localAppData:'C:\\Users\\synthetic\\AppData\\Local',freeBytes:12*1024**3,unsafePaths:false,
  resetActive:false,manifestVerified:true,dependenciesVerified:true,nodeMajor:22,port:{host:'127.0.0.1',port:18788,process:proc},
  recordedProcess:proc,actualTunnelOrigin:'https://synthetic-test.trycloudflare.com',manifest:{commitSha:'1'.repeat(40),apiOrigin:'https://synthetic-test.trycloudflare.com',provenance:'candidate-only'},
  health:{environment:'testing',releaseSha:'1'.repeat(40),sqlHealthy:true,gates:profile.gateMap},...extra};
 return {observed,mutationCalls,killedPids,deps:{async observe(){return observed;},
  async start(){mutationCalls.push('start');return proc;},async stop(pid){mutationCalls.push('stop');killedPids.push(pid);return {listenerFree:true,resetInhibited:true};}}};
}
function fn(name){assert.equal(typeof api[name],'function',name+' must implement desktop host policy');return api[name];}
test('Check has no mutation calls',async()=>{
 const h=harness(),receipt=await fn('runHostAction')('Check',profile,h.deps);
 assert.equal(receipt.status,'READY');assert.deepEqual(h.mutationCalls,[]);
});
test('Stop never kills an unowned PID',async()=>{
 for(const extra of [{recordedProcess:{...proc,pid:5678}},{recordedProcess:{...proc,startTime:'different'}},
  {recordedProcess:{...proc,executableSha256:'b'.repeat(64)}},{recordedProcess:null}]){
  const h=harness(extra),receipt=await fn('runHostAction')('Stop',profile,h.deps);
  assert.equal(receipt.status,'NOT_READY');assert.deepEqual(h.killedPids,[]);
 }
 const h=harness(),stopped=await fn('runHostAction')('Stop',profile,h.deps);assert.equal(stopped.status,'STOPPED');assert.deepEqual(h.killedPids,[1234]);
 assert.equal(stopped.computerName,'ITAPPVETOPSDB01');assert.equal(stopped.target.environmentId,profile.target.environmentId);assert.equal(stopped.listenerFree,true);assert.equal(stopped.resetInhibited,true);
 const waiting=harness({port:null,actualProcess:proc});assert.equal((await fn('runHostAction')('Stop',profile,waiting.deps)).status,'STOPPED');assert.deepEqual(waiting.killedPids,[1234]);
});
test('tunnel origin drift invalidates readiness',async()=>{
 const h=harness({actualTunnelOrigin:'https://changed.trycloudflare.com'}),receipt=await fn('runHostAction')('Check',profile,h.deps);
 assert.equal(receipt.status,'NOT_READY');assert.deepEqual(h.mutationCalls,[]);
});
test('Start rejects concurrent reset foreign listeners invalid artifacts and wrong Node without mutation',async()=>{
 for(const extra of [{resetActive:true},{manifestVerified:false},{dependenciesVerified:false},{nodeMajor:24},
  {port:{host:'0.0.0.0',port:18788,process:proc}},{recordedProcess:null},
  {port:null,manifest:{},actualTunnelOrigin:undefined}]){
  const h=harness(extra);const receipt=await fn('runHostAction')('Start',profile,h.deps);
  assert.equal(receipt.status,'NOT_READY');assert.deepEqual(h.mutationCalls,[]);
 }
 const h=harness({port:null,recordedProcess:null});assert.equal((await fn('runHostAction')('Start',profile,h.deps)).status,'STARTED');assert.deepEqual(h.mutationCalls,['start']);
});
test('host profile requires exact machine user University DB private paths and explicit gate map',()=>{
 const validate=fn('validateHostProfile'),h=harness();assert.equal(validate(profile,h.observed).apiPort,18788);
 for(const changed of [{computerName:'OTHER'},{computerName:'VET-C31293'},{windowsIdentity:'UC\\OTHER'},{apiPort:18787},{firebaseProjectId:'tester-teaching'},
  {target:{...profile.target,database:'VetMed-Ops'}},{privateRoot:'C:\\repo'},{privateRoot:'P:\\PAWS\\Testing'},
  {releaseManifestPath:'C:\\elsewhere\\manifest.json'},{gateMap:{}},{allowedOrigin:'https://tester-teaching.web.app'}]){
  assert.throws(()=>validate({...profile,...changed},h.observed),/host|profile|target|Testing|identity|private|gate|origin/i);
 }
 assert.throws(()=>validate(profile,{...h.observed,unsafePaths:true}),/path|private|host/i);
});
