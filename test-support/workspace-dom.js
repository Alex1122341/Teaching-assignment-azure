'use strict';
function domHarness(width=1024,{autoMount=true,config={}}={}){
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
 doc.createElement=t=>new Node(t);doc.documentElement=new Node('html');doc.body=new Node('body');const masthead=new Node('header'),header=new Node('div'),main=new Node('main'),overlay=new Node('section');masthead.append(header);doc.body.append(masthead,main,overlay);
 doc.querySelector=()=>doc.modal;doc.querySelectorAll=()=>[masthead,main];
 const win={innerWidth:width,MutationObserver:class{observe(){}},ResizeObserver:class{observe(){}},addEventListener:(name,fn)=>events[name]=fn};
 const destination=new Node('button');destination.textContent='HICC–CC List';destination.id='existing-directory';header.append(destination);
 const privateNode=new Node('button');privateNode.textContent='User Management';privateNode.className='hidden';header.append(privateNode);
 const {mount}=require('../frontend/scripts/workspace-navigation'),options={document:doc,window:win,header,globalNodes:[],groups:[{label:'Teaching',entries:[{node:destination,icon:'H'}]},{label:'Administration',entries:[{node:privateNode,icon:'U'}]}],...config};
 const api=autoMount?mount(options):null;return {api,options,mount,doc,win,events,created,destination,privateNode,main,overlay,menu:created.find(n=>n.className==='paws-navigation-toggle'),nav:created.find(n=>n.className==='paws-navigation')};
}
module.exports={domHarness};
