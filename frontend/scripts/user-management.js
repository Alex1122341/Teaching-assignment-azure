(function(root,factory){
 'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)root.PAWS_USER_MANAGEMENT=api;
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 function createUserManagement({api,onChange,randomId=()=>crypto.randomUUID()}){
  let revision=0;
  const empty=()=>({access:null,catalog:null,accounts:[],total:0,offset:0,search:'',groups:[],candidates:[],collaborationWriteEnabled:false,groupError:null,selected:null,preview:null,operation:null,uncertain:false,saved:null,history:null,legacy:null,loading:false,error:null});
  let state=empty();
  const emit=()=>onChange({...state,accounts:state.accounts.slice(),groups:state.groups.slice(),candidates:state.candidates.slice()});
  function clear(){revision++;state=empty();emit();}
  const requireOwner=()=>{if(state.access?.canManageAccounts!==true)throw Error('Owner access is required.');};
  const editable=()=>{requireOwner();if(state.uncertain)throw Error('Confirm the pending operation before making another change.');if(state.loading)throw Error('Wait for the current request.');};
  async function load({search='',offset=0}={}){
   if(state.uncertain)throw Error('Confirm the pending operation before reloading accounts.');
   const current=++revision;state={...empty(),search,offset,loading:true};emit();
   try{
    const access=await api.effectiveAccess();if(current!==revision)return;
    state.access=access;
    if(access?.allowed!==true){state.loading=false;emit();return;}
    const operations=[];
    if(access.canManageAccounts===true)operations.push((async()=>{
     const [catalog,page]=await Promise.all([api.accessCatalog(),api.accessAccounts({search,offset})]);
     if(current!==revision)return;state={...state,catalog,accounts:page.accounts,total:page.total,offset:page.offset};
    })());
    if(access.canManageGroups===true)operations.push((async()=>{
     try{const data=await api.collaborationGroups();if(current!==revision)return;state={...state,groups:data.groups,candidates:data.candidates,collaborationWriteEnabled:data.writeEnabled===true};}
     catch(error){if(current===revision)state.groupError=error.message;}
    })());
    await Promise.all(operations);if(current!==revision)return;state.loading=false;emit();
   }catch(error){if(current!==revision)return;state={...empty(),access:state.access,search,offset,error:error.message,loading:false};emit();}
  }
  function selectAccount(uid){
   editable();const selected=state.accounts.find(row=>row.uid===uid);
   if(!selected?.editable)throw Error('This account is protected or needs review.');
   state={...state,selected:{...selected},preview:null,operation:null,saved:null,error:null};emit();
  }
  function cancelPreview(){editable();state={...state,preview:null,operation:null,error:null};emit();}
  async function preview(changes,reason){
   editable();if(!state.selected)throw Error('Select an account before previewing.');
   if(!state.catalog?.writeEnabled)throw Error('Access changes are currently disabled.');
   if(typeof reason!=='string'||!reason.trim()||reason.trim().length>1000)throw Error('A reason of 1–1000 characters is required.');
   const current=revision,target=state.selected;state={...state,loading:true,error:null,preview:null,operation:null,saved:null};emit();
   try{const result=await api.previewAccountAccess({targetUid:target.uid,expectedVersion:target.version,changes,reason:reason.trim()});if(current!==revision)return;state={...state,loading:false,preview:result,operation:{previewId:result.previewId,operationId:randomId()}};emit();}
   catch(error){if(current===revision){state={...state,loading:false,error:error.message};emit();}throw error;}
  }
  async function commit(){
   requireOwner();if(state.loading)throw Error('Wait for the current request.');
   if(!state.preview||!state.operation)throw Error('Preview the exact change before confirming.');
   const current=revision,operation={...state.operation};state={...state,loading:true,error:null};emit();
   try{
    const saved=await api.commitAccountAccess(operation);if(current!==revision)return;
    state={...state,loading:false,saved,selected:{...saved.profile},accounts:state.accounts.map(row=>row.uid===saved.profile.uid?saved.profile:row),preview:null,operation:null,uncertain:false};emit();
   }catch(error){
    if(current===revision){
     const definite=['ACCESS_STALE','ACCESS_PREVIEW_EXPIRED','LAST_OWNER','SELF_LOCKOUT','ACCESS_NO_CHANGE','INVALID_ACCESS_CHANGE','WRITE_DISABLED'].includes(error.code);
     state={...state,loading:false,error:error.message,uncertain:!definite,...(definite?{preview:null,operation:null}:{})};emit();
    }throw error;
   }
  }
  async function history(input={}){
   requireOwner();const current=revision;try{const result=await api.accountAccessHistory(input);if(current===revision){state={...state,history:result};emit();}}catch(error){if(current===revision){state.error=error.message;emit();}throw error;}
  }
  async function legacyHistory(input={}){
   requireOwner();const current=revision;try{const result=await api.legacyAccessHistory(input);if(current===revision){state={...state,legacy:result};emit();}}catch(error){if(current===revision){state.error=error.message;emit();}throw error;}
  }
  return Object.freeze({load,clear,selectAccount,cancelPreview,preview,commit,history,legacyHistory});
 }
 return {createUserManagement};
});

(function(root){
 'use strict';if(!root?.document||!root.UCVM||!root.UCVM_PAWS_DATA||!root.PAWS_USER_MANAGEMENT)return;
 const doc=root.document,$=id=>doc.getElementById(id),api=root.UCVM_PAWS_DATA,{auth}=root.UCVM.init(),esc=root.UCVM.esc;
 const person=value=>root.PAWS_FACULTY_NAME.format(value),role=value=>root.UCVM.label(value||'Not provided');
 let state=null,editorKey='',groupKey='',selectedGroup=null,creationId=null,groupBusy=false;
 const status=(message,error=false)=>{$('status').textContent=message;$('status').classList.toggle('error',error);};
 const run=work=>Promise.resolve().then(work).catch(error=>status(error.message,true));
 const facultyLabel=id=>state?.catalog?.faculty.find(row=>row.facultyId===id)?.displayName||(id?'Linked faculty':'Not linked');
 const scopeLabel=scope=>role(scope?.role)+' · '+(scope?.active?'Active':'Disabled')+' · '+facultyLabel(scope?.facultyId);
 const time=value=>value?new Date(value).toLocaleString('en-CA',{timeZone:'America/Edmonton'}):'Not recorded';
 const controller=root.PAWS_USER_MANAGEMENT.createUserManagement({api,onChange:render});
 function render(next){
  state=next;const access=state.access,isOwner=access?.canManageAccounts===true;
  $('identity').textContent=access?person(access.displayName||'Not provided')+' · '+role(access.role):'Checking sign-in…';
  $('self-summary').hidden=!access;$('self-summary').classList.toggle('access-summary-compact',isOwner);$('content').hidden=!access?.allowed;$('accounts').hidden=!isOwner;$('access-history').hidden=!isOwner;$('groups').hidden=access?.canManageGroups!==true;
  $('directory-link').hidden=!access?.allowed||!root.UCVM.canOpenFacultyDashboard({role:access.role});
  $('access-summary').innerHTML=access?'<div><dt>Role</dt><dd>'+esc(role(access.role))+'</dd></div><div><dt>Status</dt><dd>'+esc(({ready:'Ready',inactive:'Inactive',password_required:'Password change required',not_provisioned:'Not provisioned',needs_review:'Review required'})[access.status]||'Review required')+'</dd></div><div><dt>Authority</dt><dd>University account profile</dd></div>':'';
  status(state.error||(state.loading?'Loading…':state.uncertain?'The outcome needs confirmation. Retry the same operation below.':access?.allowed?'Access verified.':access?'This account cannot use PAWS. Contact an Owner for review.':'Checking access…'),Boolean(state.error||state.uncertain));
  for(const id of ['account-reset','refresh','account-prev','account-next','history-load'])$(id).disabled=state.loading||state.uncertain;
  if(!isOwner){editorKey='';$('accounts-body').innerHTML='';$('history-body').innerHTML='';$('legacy-body').innerHTML='';return renderGroups();}
  $('write-status').textContent=state.catalog?.writeEnabled?'Changes enabled':'Read only';
  $('write-status').classList.toggle('available',state.catalog?.writeEnabled===true);
  $('account-count').textContent=state.error?'Results unavailable':state.total+' account'+(state.total===1?'':'s');$('account-page').textContent=state.total?(state.offset+1)+'–'+Math.min(state.offset+50,state.total)+' of '+state.total:state.error?'Unavailable':'0 results';
  $('account-prev').disabled=state.loading||state.uncertain||state.offset===0;$('account-next').disabled=state.loading||state.uncertain||state.offset+50>=state.total;
  $('accounts-body').innerHTML=state.accounts.map(row=>'<tr><td><strong>'+esc(person(row.displayName))+'</strong><small>'+esc(row.email||'Email not provided')+'</small></td><td>'+esc(role(row.role))+'</td><td><span class="status-pill">'+esc(!row.active?'Disabled':row.mustChangePassword?'Password required':'Active')+'</span></td><td>'+esc(facultyLabel(row.facultyId))+'</td><td><button type="button" data-edit="'+esc(row.uid)+'" '+(!row.editable||state.loading||state.uncertain?'disabled':'')+'>'+(!row.editable?'Protected / review':'Edit access')+'</button></td></tr>').join('')||'<tr><td colspan="5">'+(state.loading?'Loading accounts…':'No matching accounts.')+'</td></tr>';
  doc.querySelectorAll('[data-edit]').forEach(button=>button.onclick=()=>run(()=>{controller.selectAccount(button.dataset.edit);$('account-editor').scrollIntoView({block:'nearest'});$('account-role').focus();}));
  renderEditor();renderGroups();renderHistory();
 }
 function renderEditor(){
  const row=state.selected;$('account-editor').hidden=!row;
  if(!row){editorKey='';return;}
  const key=row.uid+'/'+row.version;
  if(editorKey!==key){
   editorKey=key;$('edit-title').textContent='Edit access · '+person(row.displayName);$('edit-identity').textContent=row.email||'Email not provided';$('account-uid').textContent=row.uid;
   $('account-role').innerHTML=(state.catalog?.roles||[]).map(value=>'<option value="'+esc(value)+'">'+esc(role(value))+'</option>').join('');$('account-role').value=row.role;
   $('account-faculty').innerHTML='<option value="">Not linked</option>'+(state.catalog?.faculty||[]).map(value=>'<option value="'+esc(value.facultyId)+'">'+esc(person(value.displayName))+'</option>').join('');
   if(row.facultyId&&!state.catalog?.faculty.some(value=>value.facultyId===row.facultyId)){const option=doc.createElement('option');option.value=row.facultyId;option.textContent='Existing inactive or unavailable faculty link';$('account-faculty').append(option);}
   $('account-faculty').value=row.facultyId||'';$('account-active').checked=row.active;$('account-reason').value='';
   $('password-state').textContent=row.mustChangePassword?'Password change is still required. This editor preserves that requirement.':'Existing password policy is preserved.';
  }
  $('account-fields').disabled=state.loading||state.uncertain||Boolean(state.preview)||!state.catalog?.writeEnabled;
  const preview=state.preview,box=$('access-preview');box.hidden=!preview;
  if(preview){
   box.innerHTML='<h4>Confirm exact access change</h4><p><strong>'+esc(person(preview.target.displayName))+'</strong></p><div class="table-scroll"><table><thead><tr><th>Before</th><th>After</th></tr></thead><tbody><tr><td>'+esc(scopeLabel(preview.before))+'</td><td>'+esc(scopeLabel(preview.after))+'</td></tr></tbody></table></div><p><strong>Reason:</strong> '+esc(preview.reason)+'</p><div class="actions"><button type="button" id="access-confirm" class="primary" '+(state.loading?'disabled':'')+'>'+(state.uncertain?'Confirm same operation':'Confirm and save')+'</button><button type="button" id="preview-cancel" '+(state.loading||state.uncertain?'disabled':'')+'>Back to edit</button></div>'+(state.uncertain?'<p class="muted">The saved result is not yet confirmed. Keep this page open and retry the same operation. No new intent will be submitted.</p>':'');
   $('access-confirm').onclick=()=>run(()=>controller.commit());$('preview-cancel').onclick=()=>run(()=>controller.cancelPreview());
  }
  const saved=state.saved;$('save-result').textContent=saved?(saved.superseded?'Saved operation confirmed. This account has changed again; current access is shown.':saved.replayed?'Previously saved operation confirmed.':'Saved access confirmed from the current account profile.')+' Operation: '+saved.operation.operationId:'';
 }
 function renderGroups(){
  if(!state.access?.canManageGroups){selectedGroup=null;groupKey='';$('group-members').innerHTML='';return;}
  $('groups-title').textContent=state.access.canManageAccounts?'HICC groups':'My HICC groups';
  $('group-new').hidden=!state.access.canManageAccounts;$('group-new').disabled=state.loading||!state.collaborationWriteEnabled;
  $('group-status').textContent=state.groupError||(state.loading?'Loading groups…':state.collaborationWriteEnabled?'':'Group changes are currently disabled.');
  const key=JSON.stringify([state.groups,state.candidates,state.collaborationWriteEnabled,state.access.role]);
  if(key===groupKey)return;groupKey=key;
  const previous=selectedGroup?.id;$('group-picker').innerHTML=state.groups.length?state.groups.map(group=>'<option value="'+esc(group.id)+'">'+esc(group.name)+'</option>').join(''):'<option value="">No collaboration groups</option>';
  if(previous&&state.groups.some(group=>group.id===previous))$('group-picker').value=previous;
  selectGroup(state.groups.find(group=>group.id===$('group-picker').value)||null);
 }
 function selectGroup(group){
  selectedGroup=group;creationId=null;$('group-form').hidden=!group;if(!group)return;
  const details=state.access.canManageAccounts===true;$('group-name').value=group.name||'';$('group-courses').value=(group.courseIds||[]).join(', ');
  $('group-owner').innerHTML=state.candidates.filter(row=>row.role==='hicc').map(row=>'<option value="'+esc(row.facultyId)+'">'+esc(person(row.displayName))+'</option>').join('');
  $('group-owner').value=group.ownerFacultyId||'';for(const id of ['group-name','group-owner','group-courses'])$(id).disabled=!details;
  const members=new Set((group.members||[]).map(row=>row.facultyId));
  const candidates=[...state.candidates,...(group.members||[]).filter(row=>!state.candidates.some(candidate=>candidate.facultyId===row.facultyId))];
  $('group-members').innerHTML=candidates.map(row=>'<label class="check"><input type="checkbox" value="'+esc(row.facultyId)+'" '+(members.has(row.facultyId)?'checked ':'')+(!row.available?'disabled ':'')+'><span>'+esc(person(row.displayName))+' <small>'+esc(role(row.role))+(row.available?'':' · Unavailable')+'</small></span></label>').join('');
  $('group-unresolved').textContent=group.unresolvedMemberships?group.unresolvedMemberships+' historical memberships have unresolved identities. They will be retained for review.':'';
  $('group-fields').disabled=groupBusy||!state.collaborationWriteEnabled;
 }
 function renderHistory(){
  const history=state.history;if(history){$('history-body').innerHTML=history.rows.map(row=>'<tr><td>'+esc(time(row.createdAtUtc))+'</td><td>'+esc(person(row.targetName))+'</td><td>'+esc(scopeLabel(row.before))+' → '+esc(scopeLabel(row.after))+'</td><td>'+esc(row.reason)+'</td><td>'+esc(person(row.actorName))+'</td></tr>').join('')||'<tr><td colspan="5">No saved permission changes.</td></tr>';$('history-count').textContent=history.total+' saved changes';$('history-prev').disabled=state.loading||history.offset===0;$('history-next').disabled=state.loading||history.offset+50>=history.total;}else{$('history-body').innerHTML='<tr><td colspan="5">Load history to review saved permission changes.</td></tr>';}
  const legacy=state.legacy;if(legacy){$('legacy-body').innerHTML=legacy.rows.map(row=>'<p><strong>'+esc(time(row.changedAt))+'</strong> · '+esc(person(row.actorName))+' · '+esc(row.action)+' · '+esc(person(row.targetName))+' <span class="muted">'+esc(row.source==='legacy_compatibility'?'Legacy compatibility evidence':'SQL-authorized collaboration')+'</span></p>').join('')||'<p>No activity in this page.</p>';$('legacy-next').hidden=!legacy.nextCursor;}
 }
 $('account-search-form').onsubmit=event=>{event.preventDefault();run(()=>controller.load({search:$('account-search').value.trim()}));};
 $('account-reset').onclick=()=>{$('account-search').value='';run(()=>controller.load());};
 $('refresh').onclick=()=>run(()=>controller.load({search:state.search,offset:state.offset}));
 $('account-prev').onclick=()=>run(()=>controller.load({search:state.search,offset:Math.max(0,state.offset-50)}));
 $('account-next').onclick=()=>run(()=>controller.load({search:state.search,offset:state.offset+50}));
 $('account-form').onsubmit=event=>{event.preventDefault();run(async()=>{await controller.preview({role:$('account-role').value,active:$('account-active').checked,facultyId:$('account-faculty').value||null},$('account-reason').value);if(state.preview)$('access-preview').focus();});};
 $('account-cancel').onclick=()=>{$('account-editor').hidden=true;};
 $('history-load').onclick=()=>run(()=>controller.history({offset:0}));
 $('history-prev').onclick=()=>run(()=>controller.history({offset:Math.max(0,state.history.offset-50)}));
 $('history-next').onclick=()=>run(()=>controller.history({offset:state.history.offset+50}));
 $('legacy-load').onclick=()=>run(()=>controller.legacyHistory());
 $('legacy-next').onclick=()=>run(()=>controller.legacyHistory({cursor:state.legacy.nextCursor}));
 $('group-picker').onchange=()=>selectGroup(state.groups.find(group=>group.id===$('group-picker').value)||null);
 $('group-new').onclick=()=>{selectGroup({id:null,name:'',ownerFacultyId:null,courseIds:[],members:[]});creationId=root.crypto.randomUUID();$('group-name').focus();};
 $('group-owner').onchange=()=>{for(const input of $('group-members').querySelectorAll('input'))if(input.value===$('group-owner').value)input.checked=true;};
 $('group-form').onsubmit=event=>{event.preventDefault();if(groupBusy||!selectedGroup||!state.collaborationWriteEnabled)return;run(async()=>{
  groupBusy=true;$('group-fields').disabled=true;$('group-status').textContent='Saving collaboration group…';
  try{
   const input={expectedVersion:selectedGroup.version,memberFacultyIds:[...$('group-members').querySelectorAll('input:checked')].filter(el=>!el.disabled).map(el=>el.value)};
   const data=state.access.canManageAccounts?await api.saveCollaborationGroup(selectedGroup.id,{...(selectedGroup.id?{expectedVersion:input.expectedVersion}:{creationId}),memberFacultyIds:input.memberFacultyIds,name:$('group-name').value.trim(),ownerFacultyId:$('group-owner').value,courseIds:$('group-courses').value.split(',').map(value=>value.trim()).filter(Boolean)}):await api.saveCollaborationMembers(selectedGroup.id,input);
   selectedGroup=data.group;creationId=null;groupKey='';await controller.load({search:state.search,offset:state.offset});$('group-status').textContent='Saved collaboration group confirmed.';
  }catch(error){$('group-status').textContent=error.message+' Reload groups to confirm the outcome before making another change.';throw error;}
  finally{groupBusy=false;$('group-fields').disabled=!state.collaborationWriteEnabled;}
 });};
 $('signout').onclick=()=>auth.signOut();root.addEventListener('paws-access-invalidated',()=>controller.clear());
 auth.onAuthStateChanged(user=>{controller.clear();if(!user){root.location.replace('index.html');return;}if(!root.PAWS_SUPPORT?.contextId?.())run(()=>controller.load());});
})(typeof window==='undefined'?null:window);
