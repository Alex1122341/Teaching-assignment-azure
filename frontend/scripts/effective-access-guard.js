(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(!root?.document)return;
 let controller;
 root.UCVM_EFFECTIVE_ACCESS={start(auth){
  if(controller)return controller;
  const guard=api.createEffectiveAccessGuard({load:()=>root.UCVM_PAWS_DATA.effectiveAccess(),onChange:reason=>{
   root.dispatchEvent(new root.CustomEvent('paws-access-invalidated',{detail:{reason}}));
   const panel=root.document.createElement('main');panel.className='user-shell';panel.setAttribute('role','alert');
   const title=root.document.createElement('h1');title.textContent=reason==='unverified'?'Access could not be checked':'Your access has changed';
   const message=root.document.createElement('p');message.textContent='Reload to verify your current access before continuing.';
   const reload=root.document.createElement('button');reload.type='button';reload.className='primary';reload.textContent='Reload';reload.onclick=()=>root.location.reload();
   const signout=root.document.createElement('button');signout.type='button';signout.textContent='Sign out';signout.onclick=()=>Promise.resolve(auth.signOut()).finally(()=>root.location.replace('index.html'));
   panel.append(title,message,reload,signout);root.document.body.replaceChildren(panel);reload.focus();
   if(reason==='password_required')root.location.replace('password.html');
  }});
  root.UCVM_EFFECTIVE_ACCESS.guard=guard;
  const stop=guard.start(root,()=>Boolean(auth.currentUser)&&!root.PAWS_SUPPORT?.contextId?.());
  let initialUid=null;
  const unsubscribe=auth.onAuthStateChanged(user=>{
   if(initialUid&&initialUid!==user?.uid){guard.invalidate('changed');return;}
   if(user){initialUid=user.uid;if(!root.PAWS_SUPPORT?.contextId?.())void guard.check();}
  });
  controller={guard,stop(){stop();unsubscribe?.();}};return controller;
 }};
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const revoked=new Set(['PROFILE_REQUIRED','PASSWORD_CHANGE_REQUIRED','ROLE_DENIED','FACULTY_LINK_REQUIRED','ACCESS_CHANGED','SESSION_REAUTH_REQUIRED']);
 function createEffectiveAccessGuard({load,onChange}){
  let signature=null,profileSignature=null,generation=0,blocked=false,pending=null;
  function invalidate(reason){if(blocked)return;blocked=true;generation++;onChange(reason);}
  function observe(access){
   if(blocked)return;
   if(!access||access.allowed!==true||access.status!=='ready'){invalidate(access?.status==='password_required'?'password_required':'changed');return;}
   if(typeof access.version!=='string'||! /^[a-f0-9]{16}$/i.test(access.version)){invalidate('unverified');return;}
   const next=JSON.stringify([access.role,access.facultyId||null,access.version]);
   if(profileSignature!==null&&profileSignature!==JSON.stringify([access.role,access.facultyId||null])){invalidate('changed');return;}
   if(signature!==null&&signature!==next){invalidate('changed');return;}
   signature=next;
  }
  function check(){
   if(blocked)return Promise.resolve();if(pending)return pending;
   pending=Promise.resolve().then(load).then(observe,()=>invalidate('unverified')).finally(()=>{pending=null;});return pending;
  }
  function observeProfile(profile){
   if(blocked)return;
   if(profile?.active!==true||profile?.mustChangePassword===true){invalidate(profile?.mustChangePassword?'password_required':'changed');return;}
   const next=JSON.stringify([profile.role||profile.baseRole,profile.facultyId||null]);
   if(signature!==null){const binding=JSON.parse(signature);if(next!==JSON.stringify(binding.slice(0,2))){invalidate('changed');return;}}
   if(profileSignature!==null&&next!==profileSignature){invalidate('changed');return;}profileSignature=next;
  }
  return Object.freeze({observe,observeProfile,check,invalidate,capture:()=>generation,current:token=>!blocked&&token===generation,
   reject(error){if(revoked.has(error?.code))invalidate('changed');},
   start(surface,enabled=()=>true){const run=()=>{if(enabled())void check();};surface.addEventListener('focus',run);const timer=surface.setInterval(run,60000);return ()=>{surface.removeEventListener('focus',run);surface.clearInterval(timer);};}
  });
 }
 return {createEffectiveAccessGuard};
});
