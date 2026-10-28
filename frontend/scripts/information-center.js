(function(root,factory){
 'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(!root?.document||!root.UCVM||!root.UCVM_PAWS_DATA)return;
 const page=(root.location.pathname.split('/').pop()||'index.html').toLowerCase();if(page!=='index.html')return;
 const doc=root.document,banner=doc.querySelector('.test-banner'),label=doc.getElementById('ui-banner-label'),message=doc.getElementById('ui-banner-message');if(!banner||!label||!message)return;
 const {auth}=root.UCVM.init(),esc=root.UCVM.esc;let state={messages:[],loading:false,canPublish:false,error:null},opened=false;
 let button=doc.getElementById('information-center-btn');if(!button){button=doc.createElement('button');button.id='information-center-btn';button.className='btn btn-secondary';banner.insertBefore(button,doc.getElementById('auth-setup-btn'));}
 const controller=api.createInformationCenter({api:root.UCVM_PAWS_DATA,onChange:next=>{state=next;render();if(opened)show();}});
 function render(){label.textContent='INFORMATION CENTER';banner.setAttribute('aria-label','Information Center');const latest=state.messages[0];message.textContent=state.loading?'Loading updates…':state.error?'Updates are unavailable. Open to retry.':latest?latest.title+': '+latest.body:'No current announcements.';button.textContent='View updates'+(state.messages.length?' ('+state.messages.length+')':'');}
 function close(){opened=false;const modal=doc.getElementById('modal');if(modal){modal.classList.remove('open');modal.innerHTML='';}button.focus();}
 function show(){
  const modal=doc.getElementById('modal');if(!modal)return;opened=true;
  const cards=state.messages.map(item=>'<article class="workflow-card"><strong>'+esc(item.title)+'</strong><div class="workflow-note">'+esc(item.createdAt?new Date(item.createdAt).toLocaleString('en-CA',{timeZone:'America/Edmonton'}):'Date not provided')+' · '+esc(item.authorName||'UCVM')+'</div><p>'+esc(item.body)+'</p></article>').join('');
  const form=state.canPublish?'<form id="info-form" class="workflow-card"><h3>Publish an update</h3><label class="form-field"><span class="form-label">Title</span><input class="form-input" name="title" maxlength="80" required></label><label class="form-field"><span class="form-label">Message</span><textarea class="form-input" name="body" maxlength="500" rows="4" required></textarea></label><button class="btn btn-primary">Publish</button></form>':'';
  modal.innerHTML='<div class="modal-box workflow-modal-box" role="dialog" aria-modal="true" aria-labelledby="info-title"><div class="modal-header"><div id="info-title" class="modal-title">Information Center</div><div class="modal-subtitle">Timetable, workflow and operational updates</div></div><div class="modal-body">'+(state.error?'<p role="alert">'+esc(state.error)+'</p>':'')+(cards||'<p>No current announcements.</p>')+form+'</div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-refresh '+(state.loading?'disabled':'')+'>Refresh</button><button type="button" class="btn btn-secondary" data-close>Close</button></div></div>';
  modal.classList.add('open');modal.querySelector('[data-close]').onclick=close;modal.querySelector('[data-refresh]').onclick=()=>controller.load();
  const formElement=modal.querySelector('#info-form');if(formElement)formElement.onsubmit=async event=>{event.preventDefault();const values=new FormData(formElement);try{await controller.publish({title:String(values.get('title')).trim(),body:String(values.get('body')).trim()});}catch(_){/* error is rendered by the controller */}};
 }
 button.onclick=show;root.addEventListener('paws-access-invalidated',()=>{opened=false;controller.clear();});
 auth.onAuthStateChanged(user=>{opened=false;controller.clear();if(user&&!root.PAWS_SUPPORT?.contextId?.())void controller.load();});render();
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 function createInformationCenter({api,onChange}){
  let revision=0,state={messages:[],version:null,canPublish:false,loading:false,error:null};
  const emit=()=>onChange({...state,messages:state.messages.slice()});
  function clear(){revision++;state={messages:[],version:null,canPublish:false,loading:false,error:null};emit();}
  async function load(){
   const current=++revision;state={messages:[],version:null,canPublish:false,loading:true,error:null};emit();
   try{const data=await api.announcements();if(current!==revision)return;state={messages:data.messages,version:data.version,canPublish:data.canPublish===true,loading:false,error:null};}
   catch(error){if(current!==revision)return;state={messages:[],version:null,canPublish:false,loading:false,error:error.message||'Updates could not be loaded.'};}emit();
  }
  async function publish({title,body}){
   if(state.loading||!state.canPublish||!state.version)throw Error('Reload and verify publication access before publishing.');
   const current=++revision,expectedVersion=state.version;state={...state,canPublish:false,loading:true,error:null};emit();
   try{const data=await api.publishAnnouncement({expectedVersion,title,body});if(current!==revision)return;state={messages:data.messages,version:data.version,canPublish:data.canPublish===true,loading:false,error:null};emit();}
   catch(error){if(current===revision){state={...state,loading:false,canPublish:false,error:error.message||'Publication could not be confirmed. Reload before retrying.'};emit();}throw error;}
  }
  return Object.freeze({load,publish,clear});
 }
 return {createInformationCenter};
});
