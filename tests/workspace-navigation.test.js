'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {repositoryPath}=require('../tools/build/frontend-paths');
const file=()=>repositoryPath(__dirname,'../workspace-navigation.js');
test('adaptive shell reserves usable Calendar width and overlays narrow or simultaneous panels',()=>{
 const {layoutFor}=require(file());
 assert.deepEqual(layoutFor(1440,false,true),{rail:64,drawer:false,tasksOverlay:true});
 assert.deepEqual(layoutFor(1440,true,true),{rail:64,drawer:true,tasksOverlay:true});
 assert.deepEqual(layoutFor(1920,true,true),{rail:224,drawer:false,tasksOverlay:false});
 assert.deepEqual(layoutFor(1024,true,true),{rail:0,drawer:true,tasksOverlay:true});
 assert.deepEqual(layoutFor(390,false,false),{rail:0,drawer:false,tasksOverlay:true});
});
test('navigation has only existing destinations, no data preload, role grant or mock route',()=>{
 const source=fs.readFileSync(file(),'utf8');
 assert.doesNotMatch(source,/fetch\(|firestore|\.collection\(|localStorage|Overview|Reports Builder|location\.(?:assign|replace)/);
 assert.match(source,/WeakMap/,'mount is idempotent per document');
 assert.match(source,/append\(node\)/,'move original elements, retain IDs/listeners');
 assert.doesNotMatch(source,/cloneNode|innerHTML\s*=.*node/);
 assert.match(source,/event\.key==='Escape'/);assert.match(source,/event\.key==='Tab'/);
});
test('business modal layers stay above Tasks and navigation',()=>{
 const css=fs.readFileSync(repositoryPath(__dirname,'../workspace.css'),'utf8');
 assert.match(css,/\.paws-calendar-shell \.modal-container\{z-index:4000\}/);
 assert.match(css,/\.paws-calendar-shell \.afc-timetable-panel\{z-index:4100\}/);
});
test('Calendar heading and day headers use theme-aware foreground and surfaces',()=>{
 const css=fs.readFileSync(repositoryPath(__dirname,'../workspace.css'),'utf8');
 assert.match(css,/\.paws-calendar-shell \.ucalgary-wordmark\{[^}]*color:var\(--workspace-ink\)/);
 assert.match(css,/\.paws-calendar-shell \.tg-day-head[^}]*background:var\(--workspace-soft\)/);
 assert.match(css,/html\.dark \.paws-navigation-section \[aria-current=page\]\{background:#432435;color:#ffc3ce\}/);
});

function domHarness(width=1024){
 const created=[],events={},doc={activeElement:null,modal:null};
 class Node{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.listeners={};this.hidden=false;this.inert=false;this._classes=new Set();this.style={setProperty(){}};this.textContent='';created.push(this);}
  set className(v){this._classes=new Set(v.split(/\s+/).filter(Boolean));}get className(){return [...this._classes].join(' ');}
  get classList(){const s=this._classes;return {add:(...v)=>v.forEach(x=>s.add(x)),contains:x=>s.has(x),toggle:(x,on)=>{if(on??!s.has(x))s.add(x);else s.delete(x);}};}
  append(...nodes){for(const n of nodes){if(n.parentElement)n.parentElement.children=n.parentElement.children.filter(c=>c!==n);n.parentElement=this;this.children.push(n);}}
  prepend(n){this.append(n);this.children.unshift(this.children.pop());}
  insertBefore(n,before){this.append(n);this.children.pop();this.children.splice(this.children.indexOf(before),0,n);}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  setAttribute(k,v){this.attrs[k]=String(v);}removeAttribute(k){delete this.attrs[k];}
  addEventListener(type,fn,capture){(this.listeners[type]??=[]).push({fn,capture});}
  click(){for(const {fn} of this.listeners.click||[])fn();this.onclick?.();}
  focus(){doc.activeElement=this;}
  contains(node){return this===node||this.children.some(n=>n.contains(node));}
  getBoundingClientRect(){return {height:80};}
  getClientRects(){return this.hidden||this.classList.contains('hidden')?[]:[{}];}
  querySelectorAll(){return this.children.flatMap(n=>[n,...n.querySelectorAll()]).filter(n=>n.tagName==='BUTTON'||n.tagName==='A');}
 }
 doc.createElement=t=>new Node(t);doc.body=new Node('body');const masthead=new Node('header'),header=new Node('div'),main=new Node('main'),overlay=new Node('section');masthead.append(header);doc.body.append(masthead,main,overlay);
 doc.querySelector=()=>doc.modal;doc.querySelectorAll=()=>[masthead,main];
 const win={innerWidth:width,MutationObserver:class{observe(){}},ResizeObserver:class{observe(){}},addEventListener:(name,fn)=>events[name]=fn};
 const destination=new Node('button');destination.textContent='HICC–CC List';destination.id='existing-directory';header.append(destination);
 const privateNode=new Node('button');privateNode.textContent='User Management';privateNode.className='hidden';header.append(privateNode);
 const {mount}=require(file()),options={document:doc,window:win,header,globalNodes:[],groups:[{label:'Teaching',entries:[{node:destination,icon:'H'}]},{label:'Administration',entries:[{node:privateNode,icon:'U'}]}]};
 const api=mount(options);return {api,options,mount,doc,win,events,created,destination,privateNode,main,overlay,menu:created.find(n=>n.className==='paws-navigation-toggle'),nav:created.find(n=>n.className==='paws-navigation')};
}
test('real mount retains original controls once, syncs allowed visibility and restores background',()=>{
 const h=domHarness();assert.equal(h.mount(h.options),h.api);assert.equal(h.created.filter(n=>n.id==='existing-directory').length,1);
 assert.equal(h.destination.parentElement.className,'paws-navigation-section');
 h.api.sync(true);assert.equal(h.privateNode.parentElement.hidden,true);h.privateNode.classList.toggle('hidden',false);h.api.sync(true);assert.equal(h.privateNode.parentElement.hidden,false);
 h.menu.onclick();assert.equal(h.nav.attrs['aria-modal'],'true');assert.equal(h.main.inert,true);assert.equal(h.overlay.inert,false,'unrelated modal containers are never background targets');
 h.api.sync(false);assert.equal(h.nav.hidden,true);assert.equal(h.main.inert,false);assert.equal(h.menu.disabled,true);
});
test('destination handler captures surviving menu focus and resize preserves business dialogs',()=>{
 const h=domHarness();h.api.sync(true);h.menu.onclick();let returnFocus;
 h.destination.onclick=()=>{returnFocus=h.doc.activeElement;h.doc.modal=h.overlay;};h.destination.focus();h.destination.click();
 assert.equal(returnFocus,h.menu);assert.equal(h.main.inert,false);
 h.doc.modal=null;h.win.innerWidth=1920;h.menu.onclick();assert.equal(h.doc.body.classList.contains('paws-navigation-expanded'),true);
 h.doc.modal=h.overlay;h.win.innerWidth=1024;h.events.resize();
 assert.equal(h.doc.body.classList.contains('paws-navigation-drawer'),false);assert.equal(h.overlay.inert,false);assert.equal(h.main.inert,false);
});
test('wide navigation dialogs retain a return target that survives a later narrow resize',()=>{
 const h=domHarness(1920);h.api.sync(true);let returnFocus;
 h.destination.onclick=()=>{returnFocus=h.doc.activeElement;h.doc.modal=h.overlay;};h.destination.focus();h.destination.click();
 h.win.innerWidth=390;h.events.resize();assert.equal(returnFocus,h.menu);
});
