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

const {domHarness}=require('../test-support/workspace-dom');

test('office presentation options preserve generic title and office background without Calendar scope',()=>{
 const h=domHarness(1024,{config:{pageTitle:'Faculty Dashboard',shellClass:'paws-office-shell',backgroundSelector:'.office-background',measureHeader:true}});
 assert.equal(h.doc.body.classList.contains('paws-office-shell'),true);assert.equal(h.doc.body.classList.contains('paws-calendar-shell'),false);
 assert.equal(h.created.find(n=>n.className==='paws-page-title').textContent,'Faculty Dashboard');
 h.api.sync(true);h.menu.onclick();assert.equal(h.main.inert,true);h.api.sync(false);assert.equal(h.main.inert,false);
});

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
