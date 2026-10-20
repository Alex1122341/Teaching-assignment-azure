'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.azure-production'),app=path.join(out,'app');
fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(app,{recursive:true});
const assets=JSON.parse(fs.readFileSync(path.join(root,'tools','static-assets.json'),'utf8'));
if(new Set(assets).size!==assets.length)throw Error('Static asset manifest contains duplicates.');
for(const relative of assets){if(typeof relative!=='string'||path.isAbsolute(relative)||relative.includes('..'))throw Error(`Unsafe static asset path: ${relative}`);const source=path.join(root,relative),destination=path.join(app,relative);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(source,destination);}
execFileSync(process.execPath,[path.join(root,'tools','build-swa-api.js'),'--output',path.join(out,'api')],{cwd:root,stdio:'inherit'});
console.log(JSON.stringify({output:out,app,api:path.join(out,'api')}));
