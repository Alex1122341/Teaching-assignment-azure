(function(root){
 'use strict';if(!root?.document||!root.UCVM||!root.UCVM_PAWS_DATA)return;
 const doc=root.document;if((root.location.pathname.split('/').pop()||'index.html')!=='index.html')return;
 const {auth}=root.UCVM.init(),esc=root.UCVM.esc;let profile=null,generation=0,view=null;
 const authorized=()=>auth.currentUser&&profile?.active===true&&root.UCVM.admin(profile);
 function clear(){generation++;view?.clear();view=null;profile=null;doc.getElementById('availability-lookup-btn')?.remove();}
 function inject(){
  const bar=doc.querySelector('.cal-toolbar-right');if(!bar||!authorized())return;
  let button=doc.getElementById('availability-lookup-btn');if(!button){button=doc.createElement('button');button.type='button';button.id='availability-lookup-btn';button.className='workflow-btn';button.textContent='Availability';bar.insertBefore(button,bar.firstChild);}button.onclick=open;
 }
 async function open(){
  if(!authorized())return;const modal=doc.getElementById('modal');if(!modal)return;const current=++generation;
  modal.innerHTML='<div class="modal-box workflow-modal-box" role="dialog" aria-modal="true" aria-labelledby="calendar-availability-title"><div class="modal-header"><div id="calendar-availability-title" class="modal-title">Faculty availability</div><div class="modal-subtitle">Read-only University commitments and coverage warnings</div></div><div class="modal-body" id="calendar-availability-host">Loading authorized availability…</div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-close>Close</button></div></div>';modal.classList.add('open');
  modal.querySelector('[data-close]').onclick=()=>{generation++;view?.clear();view=null;modal.classList.remove('open');modal.innerHTML='';};
  try{
   if(!doc.querySelector('link[data-calendar-availability]')){const link=doc.createElement('link');link.rel='stylesheet';link.href='faculty-availability.css';link.dataset.calendarAvailability='1';doc.head.appendChild(link);}
   await root.UCVM_ASSETS.loadScriptOnce('faculty-availability.js','PAWS_FACULTY_AVAILABILITY');
   if(current!==generation||!authorized())return;
   view=root.PAWS_FACULTY_AVAILABILITY.createFacultyAvailability({api:root.UCVM_PAWS_DATA,host:doc.getElementById('calendar-availability-host'),getSelfMode:()=>false});await view.open();
  }catch(error){if(current===generation){const host=doc.getElementById('calendar-availability-host');if(host)host.innerHTML='<p role="alert">'+esc(error.message||'Availability could not be loaded. Reopen to retry.')+'</p>';}}
 }
 root.addEventListener('paws-profile',event=>{profile=event.detail?.profile||null;if(!authorized())doc.getElementById('availability-lookup-btn')?.remove();else inject();});
 root.addEventListener('paws-access-invalidated',clear);new MutationObserver(inject).observe(doc.documentElement,{childList:true,subtree:true});
 auth.onAuthStateChanged(async user=>{clear();if(!user)return;const current=generation;try{const value=await root.UCVM_PAWS_DATA.currentUser();if(current!==generation||auth.currentUser?.uid!==user.uid)return;profile=value;inject();}catch(_){/* effective access failure remains explicit in the main session guard */}});
})(typeof window==='undefined'?null:window);
