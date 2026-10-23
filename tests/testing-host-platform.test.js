'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const file=path.resolve(__dirname,'../tools/testing-host/host-platform.js'),api=fs.existsSync(file)?require(file):{};
function fn(name){assert.equal(typeof api[name],'function',name+' must enforce the native host boundary');return api[name];}
test('private credentials cannot override runtime target Firebase identity or gates',()=>{
 const build=fn('buildRuntimeEnvironment'),profile={apiPort:18788,firebaseProjectId:'paws-testing-ucvm-20261022',allowedOrigin:'https://paws-testing-ucvm-20261022.web.app',target:{host:'itappvetopsdb01',database:'VetMed-Ops-Testing',environmentId:'7e570000-0000-4000-8000-00000000c0de'},gateMap:{}};
 const manifest={commitSha:'1'.repeat(40),baselineCommit:'2'.repeat(40)},credential={project_id:profile.firebaseProjectId,client_email:'service@example.test',private_key:'private-only'};
 const env=build(profile,manifest,{firebaseServiceAccount:credential},{PAWS_ENVIRONMENT:'production',PAWS_SQL_MI_CLIENT_ID:'wrong',PATH:'C:\\Tools',SystemRoot:'C:\\Windows'});
 assert.equal(env.PAWS_ENVIRONMENT,'testing');assert.equal(env.PAWS_SQL_DRIVER,'msnodesqlv8');assert.equal(env.PAWS_API_HOST,'127.0.0.1');assert.equal(env.PAWS_SQL_MI_CLIENT_ID,undefined);
 assert.match(env.PAWS_SQL_CONNECTION_STRING,/Database=VetMed-Ops-Testing/);assert.equal(env.PAWS_API_PORT,'18788');
 assert.throws(()=>build(profile,manifest,{firebaseServiceAccount:{...credential,project_id:'tester-teaching'}}),/credential|Testing/i);
 assert.throws(()=>build(profile,manifest,{firebaseServiceAccount:credential,PAWS_ENVIRONMENT:'production'}),/credential|configuration/i);
 const clean=fn('cleanOsEnvironment')({PATH:'C:\\Tools',NODE_OPTIONS:'--require evil',FIREBASE_SERVICE_ACCOUNT_JSON:'DO_NOT_LOG_SECRET',GH_TOKEN:'DO_NOT_LOG_SECRET'});
 assert.deepEqual(clean,{PATH:'C:\\Tools'});
});
test('Windows process command-line matching is exact and rejects extra arguments',()=>{
 const match=fn('matchesCommandLine'),exe='C:\\Tools\\node.exe',entry='C:\\Private Folder\\api\\server\\src\\runtime\\university-api.js';
 assert.equal(match('"'+exe+'" "'+entry+'"',exe,entry),true);
 assert.equal(match('"'+exe+'" "'+entry+'.other"',exe,entry),false);
 assert.equal(match('"'+exe+'" --require evil.js "'+entry+'"',exe,entry),false);
});
test('supervisor wrapper exposes only approved actions and uses Node22 without echoing secret JSON',()=>{
 const script=path.resolve(__dirname,'../tools/testing-host/Invoke-PawsTestingHost.ps1');
 assert.ok(fs.existsSync(script),'supervisor wrapper must exist');
 const text=fs.readFileSync(script,'utf8');assert.match(text,/ValidateSet\('Stage','Start','Check','Stop'\)/);assert.match(text,/HOST_CONFIGURATION_INVALID/);
 assert.doesNotMatch(text,/Write-(?:Output|Host|Error)\s+\$_|Write-(?:Output|Host|Error)\s+\$config\b/);
});

test('School preparation is fixed to private P drive and refuses existing directories without installing or starting services',()=>{
 const text=fs.readFileSync(path.resolve(__dirname,'../tools/testing-host/Prepare-UniversityTestingHost.ps1'),'utf8');
 assert.match(text,/ITAPPVETOPSDB01/);assert.match(text,/P:\\PAWS\\Testing/);
 assert.match(text,/PREPARED_NOT_READY/);assert.match(text,/FileMode\]::CreateNew/);
 assert.match(text,/SetAccessRuleProtection\(\$true,\$false\)/);
 assert.match(text,/Get-Content[^\r\n]*\$DbaScriptPath[^\r\n]*-Encoding UTF8/);
 assert.doesNotMatch(text,/Start-Process|Start-Service|Restart-Service|Stop-Process|msiexec|SqlLocalDB|TrustServerCertificate=true/i);
});
