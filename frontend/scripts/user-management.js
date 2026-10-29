(function(root,factory){
 'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)root.PAWS_USER_MANAGEMENT=api;
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 function createUserManagement({api,onChange,randomId=()=>crypto.randomUUID()}){
  let revision=0,leadershipRevision=0,historyRequest=0;
  const empty=()=>({access:null,catalog:null,accounts:[],total:0,offset:0,search:'',groups:[],candidates:[],collaborationWriteEnabled:false,groupError:null,selected:null,preview:null,operation:null,uncertain:false,saved:null,history:null,legacy:null,leadership:null,leadershipHistory:null,loading:false,error:null});
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
   leadershipRevision++;state={...state,selected:{...selected},preview:null,operation:null,saved:null,error:null,leadership:null,leadershipHistory:null};emit();
  }
  function cancelPreview(){editable();state={...state,preview:null,operation:null,error:null};emit();}
  async function preview(changes,reason){
   editable();if(!state.selected)throw Error('Select an account before previewing.');
   if(!state.catalog?.writeEnabled)throw Error('Access changes are currently disabled.');
   if(typeof reason!=='string'||!reason.trim()||reason.trim().length>1000)throw Error('A reason of 1–1000 characters is required.');
   const current=revision,target=state.selected;state={...state,loading:true,error:null,preview:null,operation:null,saved:null,leadership:null};emit();
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
  async function leadershipHistory(input){
   requireOwner();if(!state.selected)throw Error('Select an account before loading history.');const current=revision,scope=leadershipRevision,request=++historyRequest,target=state.selected;
   try{const result=await api.leadershipAccessHistory({targetUid:target.uid,...input});if(current!==revision||scope!==leadershipRevision||request!==historyRequest||state.selected?.uid!==target.uid)return;state={...state,leadershipHistory:result};emit();}
   catch(error){if(current===revision&&scope===leadershipRevision&&request===historyRequest){state.error=error.message;emit();}throw error;}
  }
  function clearLeadership(){editable();leadershipRevision++;state={...state,leadership:null,leadershipHistory:null,error:null};emit();}
  async function loadLeadership(academicYear){
   editable();if(!state.selected)throw Error('Select an account before loading responsibilities.');
   const current=revision,target=state.selected;leadershipRevision++;state={...state,loading:true,error:null,leadership:null,leadershipHistory:null,preview:null,operation:null};emit();
   try{const catalog=await api.leadershipAccessCatalog({targetUid:target.uid,academicYear});if(current!==revision)return;state={...state,loading:false,leadership:{catalog,preview:null,operation:null,saved:null}};emit();}
   catch(error){if(current===revision){state={...state,loading:false,error:error.message};emit();}throw error;}
  }
  async function previewLeadership(changes,reason){
   editable();const catalog=state.leadership?.catalog;if(!catalog||!catalog.writeEnabled)throw Error('Load writable leadership choices before previewing.');
   if(typeof reason!=='string'||!reason.trim()||reason.trim().length>1000)throw Error('A reason of 1–1000 characters is required.');
   const current=revision;state={...state,loading:true,error:null,leadership:{catalog,preview:null,operation:null,saved:null}};emit();
   try{const preview=await api.previewLeadershipAccess({targetUid:catalog.target.uid,academicYear:catalog.academicYear,expectedVersion:catalog.target.version,expectedAuthorityVersion:catalog.authorityVersion,changes,reason:reason.trim()});if(current!==revision)return;state={...state,loading:false,leadership:{catalog,preview,operation:{previewId:preview.previewId,operationId:randomId()},saved:null}};emit();}
   catch(error){if(current===revision){state={...state,loading:false,error:error.message};emit();}throw error;}
  }
  function cancelLeadership(){editable();if(!state.leadership)return;state={...state,leadership:{...state.leadership,preview:null,operation:null},error:null};emit();}
  async function commitLeadership(){
   requireOwner();if(state.loading)throw Error('Wait for the current request.');
   const leadership=state.leadership;if(!leadership?.preview||!leadership.operation)throw Error('Preview the exact leadership change before confirming.');
   const current=revision,operation={...leadership.operation};state={...state,loading:true,error:null};emit();
   try{const saved=await api.commitLeadershipAccess(operation);if(current!==revision)return;state={...state,loading:false,uncertain:false,leadership:{...leadership,catalog:{...leadership.catalog,writeEnabled:false},preview:null,operation:null,saved}};emit();}
   catch(error){if(current===revision){const definite=['LEADERSHIP_STALE','LEADERSHIP_PREVIEW_EXPIRED','LEADERSHIP_SOURCE_CHANGED','LEADERSHIP_OVERLAP','INVALID_LEADERSHIP_CHANGE','WRITE_DISABLED','PROTECTED_ACCOUNT','TARGET_ACCESS_INELIGIBLE'].includes(error.code);state={...state,loading:false,error:error.message,uncertain:!definite,leadership:{...leadership,...(definite?{preview:null,operation:null}:{})}};emit();}throw error;}
  }
  return Object.freeze({load,clear,selectAccount,cancelPreview,preview,commit,history,legacyHistory,loadLeadership,previewLeadership,commitLeadership,cancelLeadership,leadershipHistory,clearLeadership});
 }
 function leadershipPreviewRows(changes,catalog){return changes.map(change=>{const assignment=change.action==='revoke'?catalog.assignments.find(row=>row.assignmentId===change.assignmentId):null,definition=catalog.definitions.find(row=>row.responsibilityId===change.responsibilityId);return {...definition,...assignment,...change};});}
 function collaborationOwnerModel(candidates,group){
  const current=group?.id&&group.ownerFacultyId;
  const choices=candidates.filter(row=>row.role==='hicc'||current&&row.facultyId===current);
  if(current&&!choices.some(row=>row.facultyId===current))choices.push({facultyId:current,displayName:group.ownerName||'Name unavailable',available:false});
  return {choices,selectedId:current||'',placeholder:group?.id&&!current?'Current owner needs review':'Select HICC owner'};
 }
 return {createUserManagement,leadershipPreviewRows,collaborationOwnerModel};
});

(function(root){
 'use strict';if(!root?.document||!root.UCVM||!root.UCVM_PAWS_DATA||!root.PAWS_USER_MANAGEMENT)return;
 const doc=root.document,$=id=>doc.getElementById(id),api=root.UCVM_PAWS_DATA,{auth}=root.UCVM.init(),esc=root.UCVM.esc;
 const person=value=>root.PAWS_FACULTY_NAME.format(value),role=value=>root.UCVM.label(value||'Not provided');
 let state=null,editorKey='',leadershipKey='',groupKey='',selectedGroup=null,creationId=null,groupBusy=false;
 const status=(message,error=false)=>{$('status').textContent=message;$('status').classList.toggle('error',error);};
 const run=work=>Promise.resolve().then(work).catch(error=>status(error.message,true));
 const facultyLabel=id=>state?.catalog?.faculty.find(row=>row.facultyId===id)?.displayName||(id?'Linked faculty':'Not linked');
 const scopeLabel=scope=>role(scope?.role)+' · '+(scope?.active?'Active':'Disabled')+' · '+facultyLabel(scope?.facultyId);
 const time=value=>value?new Date(/(?:Z|[+-]\d\d:\d\d)$/i.test(value)?value:value+'Z').toLocaleString('en-CA',{timeZone:'America/Edmonton'}):'Not recorded';
 const controller=root.PAWS_USER_MANAGEMENT.createUserManagement({api,onChange:render});
 function render(next){
  state=next;const access=state.access,isOwner=access?.canManageAccounts===true;
  $('identity').textContent=access?person(access.displayName||'Not provided')+' · '+role(access.role):'Checking sign-in…';
  $('self-summary').hidden=!access;$('self-summary').classList.toggle('access-summary-compact',isOwner);$('content').hidden=!access?.allowed;$('accounts').hidden=!isOwner;$('access-history').hidden=!isOwner;$('groups').hidden=access?.canManageGroups!==true;
  $('directory-link').hidden=!access?.allowed||!root.UCVM.canOpenFacultyDashboard({role:access.role});
  $('access-summary').innerHTML=access?'<div><dt>Role</dt><dd>'+esc(role(access.role))+'</dd></div><div><dt>Status</dt><dd>'+esc(({ready:'Ready',inactive:'Inactive',password_required:'Password change required',not_provisioned:'Not provisioned',needs_review:'Review required'})[access.status]||'Review required')+'</dd></div><div><dt>Authority</dt><dd>University account profile</dd></div>':'';
  const own=access?.responsibilities||[];
  $('own-teaching-roles').innerHTML=access?'<p class="muted">Current academic year: '+esc(access.academicYear||'Not applicable')+'</p>'+(own.length?'<div class="table-scroll"><table class="access-table"><thead><tr><th>Responsibility</th><th>Course / area</th><th>Start</th><th>End (inclusive)</th></tr></thead><tbody>'+own.map(row=>'<tr><td>'+esc(row.kind==='hicc'?'HICC / Course Coordinator':'VISC')+'</td><td>'+esc(teachingScope(row))+'</td><td>'+esc(row.startDate)+'</td><td>'+esc(row.endDate)+'</td></tr>').join('')+'</tbody></table></div>':'<p class="muted">No additional teaching responsibilities are active.</p>'):'';
  status(state.error||(state.loading?'Loading…':state.uncertain?'The outcome needs confirmation. Retry the same operation below.':access?.allowed?'Access verified.':access?'This account cannot use PAWS. Contact an Owner for review.':'Checking access…'),Boolean(state.error||state.uncertain));
  for(const id of ['account-reset','refresh','account-prev','account-next','history-load'])$(id).disabled=state.loading||state.uncertain;
  if(!isOwner){editorKey='';$('accounts-body').innerHTML='';$('history-body').innerHTML='';$('legacy-body').innerHTML='';return renderGroups();}
  $('write-status').textContent=state.catalog?.writeEnabled?'Changes enabled':'Read only';
  $('write-status').classList.toggle('available',state.catalog?.writeEnabled===true);
  $('account-count').textContent=state.error?'Results unavailable':state.total+' account'+(state.total===1?'':'s');$('account-page').textContent=state.total?(state.offset+1)+'–'+Math.min(state.offset+50,state.total)+' of '+state.total:state.error?'Unavailable':'0 results';
  $('account-prev').disabled=state.loading||state.uncertain||state.offset===0;$('account-next').disabled=state.loading||state.uncertain||state.offset+50>=state.total;
  $('accounts-body').innerHTML=state.accounts.map(row=>'<tr><td><strong>'+esc(person(row.displayName))+'</strong><small>'+esc(row.email||'Email not provided')+'</small></td><td>'+esc(role(row.role))+'</td><td><span class="status-pill">'+esc(!row.active?'Disabled':row.mustChangePassword?'Password required':'Active')+'</span></td><td>'+esc(facultyLabel(row.facultyId))+'</td><td><button type="button" data-edit="'+esc(row.uid)+'" '+(!row.editable||state.loading||state.uncertain?'disabled':'')+'>'+(!row.editable?'Protected / review':'Edit access')+'</button></td></tr>').join('')||'<tr><td colspan="5">'+(state.loading?'Loading accounts…':'No matching accounts.')+'</td></tr>';
  doc.querySelectorAll('[data-edit]').forEach(button=>button.onclick=()=>run(()=>{controller.selectAccount(button.dataset.edit);$('account-editor').scrollIntoView({block:'nearest'});$('account-role').focus();}));
  renderEditor();renderLeadership();renderGroups();renderHistory();
 }
 function renderEditor(){
  const row=state.selected;$('account-editor').hidden=!row;
  if(!row){editorKey='';leadershipKey='';return;}
  const key=row.uid+'/'+row.version;
  if(editorKey!==key){
   editorKey=key;$('edit-title').textContent='Edit access · '+person(row.displayName);$('edit-identity').textContent=row.email||'Email not provided';$('account-uid').textContent=row.uid;
   $('leadership-year').value=state.access.academicYear||'';
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
 function teachingScope(row){return [...(row.courses||[]).map(value=>value.courseCode),...(row.groups||[]).map(value=>value.name)].join(', ')||'Scope not provided';}
 function inclusiveEnd(value){return value?new Date(Date.parse(value+'T12:00:00Z')-86400000).toISOString().slice(0,10):'Not provided';}
 function renderLeadership(){
  const data=state.leadership,catalog=data?.catalog,locked=state.loading||state.uncertain||Boolean(data?.preview);
  $('leadership-load').disabled=locked;$('leadership-year').disabled=locked;
  $('leadership-form').hidden=!catalog;$('leadership-fields').disabled=locked||!catalog?.writeEnabled;
  const key=catalog?catalog.target.uid+'/'+catalog.academicYear+'/'+catalog.authorityVersion:'';
  if(key!==leadershipKey){
   leadershipKey=key;$('leadership-current').innerHTML='';$('leadership-source').innerHTML='';$('leadership-definition').innerHTML='';$('leadership-reason').value='';
   if(catalog){
    $('leadership-source').innerHTML='<option value="">Select a recorded appointment</option>'+catalog.sources.map(row=>'<option value="'+esc(row.sourceRoleAssignmentId)+'">'+esc((row.kind==='hicc'?'HICC / Course Coordinator':'VISC')+' · '+row.description+' · '+row.status)+'</option>').join('');
    $('leadership-current').innerHTML='<p class="muted">'+catalog.assignments.length+' recorded responsibilities · '+esc(catalog.academicYear)+(catalog.writeEnabled?'':' · Read only')+'</p>'+(catalog.assignments.length?'<div class="table-scroll"><table class="access-table"><thead><tr><th>Course / area</th><th>Start</th><th>End (inclusive)</th><th>Action</th></tr></thead><tbody>'+catalog.assignments.map(row=>{const definition=catalog.definitions.find(item=>item.responsibilityId===row.responsibilityId);return '<tr><td>'+esc(definition?teachingScope(definition):'Definition needs review')+'</td><td>'+esc(row.startDate)+'</td><td>'+esc(inclusiveEnd(row.endExclusive))+'</td><td>'+(row.managed?'<button type="button" data-revoke-leadership="'+esc(row.assignmentId)+'">Preview revoke</button>':'Existing assignment · separate review')+'</td></tr>';}).join('')+'</tbody></table></div>':'<p class="muted">No assigned responsibilities in this academic year.</p>');
   }
  }
  doc.querySelectorAll('[data-revoke-leadership]').forEach(button=>{button.disabled=locked||!catalog?.writeEnabled;button.onclick=()=>run(()=>{const row=catalog.assignments.find(item=>item.assignmentId===button.dataset.revokeLeadership);return controller.previewLeadership([{action:'revoke',assignmentId:row.assignmentId,expectedVersion:row.version}],$('leadership-reason').value);});});
  const preview=data?.preview;$('leadership-preview').hidden=!preview;
  if(preview){$('leadership-preview').innerHTML='<h4>Confirm teaching responsibility change</h4><p>'+esc(person(state.selected.displayName))+' · '+esc(preview.academicYear)+' · Base role retained: '+esc(role(state.selected.role))+'</p><div class="table-scroll"><table class="access-table"><thead><tr><th>Change</th><th>Course / area</th><th>Start</th><th>End (inclusive)</th></tr></thead><tbody>'+root.PAWS_USER_MANAGEMENT.leadershipPreviewRows(preview.changes,catalog).map(row=>'<tr><td>'+esc(row.action==='grant'?(row.kind==='hicc'?'Grant HICC / Course Coordinator':'Grant VISC'):'Revoke responsibility')+'</td><td>'+esc(teachingScope(row))+(row.usesApprovedDefaultDates?'<small>Academic-year default approved</small>':'')+'</td><td>'+esc(row.startDate||'N/A')+'</td><td>'+esc(row.endDate||inclusiveEnd(row.endExclusive))+'</td></tr>').join('')+'</tbody></table></div><p><strong>Reason:</strong> '+esc(preview.reason)+'</p><div class="actions"><button type="button" class="primary" id="leadership-confirm" '+(state.loading?'disabled':'')+'>'+(state.uncertain?'Confirm same operation':'Confirm responsibility change')+'</button><button type="button" id="leadership-back" '+(state.loading||state.uncertain?'disabled':'')+'>Back to edit</button></div>'+(state.uncertain?'<p class="muted">Keep this page open and retry this same operation to confirm the saved outcome.</p>':'');$('leadership-confirm').onclick=()=>run(()=>controller.commitLeadership());$('leadership-back').onclick=()=>run(()=>controller.cancelLeadership());}
  $('leadership-result').textContent=data?.saved?(data.saved.superseded?'Saved operation confirmed; authority has since changed. Reload responsibilities.':'Saved responsibility operation confirmed. Reload responsibilities to see current assignments.'):' ';
  renderLeadershipHistory();
 }
 function renderLeadershipHistory(){
  const history=state.leadershipHistory,query=$('leadership-history-search').value.trim().toLowerCase(),scope=rows=>(rows||[]).map(row=>(row.kind==='hicc'?'HICC / Course Coordinator':row.kind==='visc'?'VISC':'Responsibility')+' · '+(row.scopeRecorded?teachingScope(row):'Historical scope not recorded')+' · '+(row.startDate||'N/A')+' → '+(row.endDate||'N/A')+(row.usesApprovedDefaultDates?' · Approved year default':'')).join('; ')||'None';
  const rows=(history?.rows||[]).map(row=>({row,before:scope(row.before),after:scope(row.after)})).filter(item=>!query||[time(item.row.createdAtUtc),item.row.actorName,item.row.targetName,item.row.reason,item.before,item.after].join(' ').toLowerCase().includes(query));
  $('leadership-history-body').innerHTML=rows.map(({row,before,after})=>'<tr><td>'+esc(time(row.createdAtUtc))+'</td><td>'+esc(before)+'</td><td>'+esc(after)+'</td><td>'+esc(row.reason)+'</td><td>'+esc(person(row.actorName))+'</td></tr>').join('')||'<tr><td colspan="5">'+(history?'No matching changes in this page.':'Choose a year and load responsibility history.')+'</td></tr>';
  $('leadership-history-count').textContent=history?rows.length+' shown in page · '+history.total+' changes · '+history.academicYear:'';
  $('leadership-history-prev').disabled=!history||state.loading||history.offset===0;$('leadership-history-next').disabled=!history||state.loading||history.offset+50>=history.total;
 }
 function leadershipSourceChanged(){
  const catalog=state.leadership?.catalog,source=catalog?.sources.find(row=>row.sourceRoleAssignmentId===$('leadership-source').value);
  const definitions=(catalog?.definitions||[]).filter(row=>row.kind===source?.kind&&(!source.courseId||row.courses.some(item=>item.courseId.toLowerCase()===source.courseId.toLowerCase())));
  $('leadership-definition').innerHTML='<option value="">Select an explicit scope</option>'+definitions.map(row=>'<option value="'+esc(row.responsibilityId)+'">'+esc(row.label+' · '+teachingScope(row))+'</option>').join('');
  $('leadership-default').checked=false;$('leadership-default').disabled=!source?.canUseAcademicYearDefault;
  $('leadership-start').value=source?.periods[0]?.startDate||'';$('leadership-end').value=source?.periods.at(-1)?.endDate||'';
  $('leadership-date-help').textContent=source?.canUseAcademicYearDefault?'This appointment has no recorded dates. Explicitly approve the academic-year default or leave it unassigned.':source?'Dates must be covered continuously by the recorded appointment.':'Choose a recorded appointment to inspect its dates.';
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
  const ownerModel=root.PAWS_USER_MANAGEMENT.collaborationOwnerModel(state.candidates,group);
  $('group-owner').innerHTML='<option value="">'+esc(ownerModel.placeholder)+'</option>'+ownerModel.choices.map(row=>'<option value="'+esc(row.facultyId)+'" '+(row.available===false?'disabled':'')+'>'+esc(person(row.displayName))+'</option>').join('');
  $('group-owner').value=ownerModel.selectedId;for(const id of ['group-name','group-owner','group-courses'])$(id).disabled=!details;
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
 $('leadership-load-form').onsubmit=event=>{event.preventDefault();run(()=>controller.loadLeadership($('leadership-year').value.trim()));};
 $('leadership-source').onchange=leadershipSourceChanged;
 $('leadership-year').oninput=()=>run(()=>controller.clearLeadership());
 $('leadership-history-load').onclick=()=>run(()=>controller.leadershipHistory({academicYear:$('leadership-year').value.trim(),offset:0}));
 $('leadership-history-search').oninput=renderLeadershipHistory;
 $('leadership-history-prev').onclick=()=>run(()=>controller.leadershipHistory({academicYear:state.leadershipHistory.academicYear,offset:Math.max(0,state.leadershipHistory.offset-50)}));
 $('leadership-history-next').onclick=()=>run(()=>controller.leadershipHistory({academicYear:state.leadershipHistory.academicYear,offset:state.leadershipHistory.offset+50}));
 $('leadership-default').onchange=()=>{if($('leadership-default').checked){const year=Number(state.leadership.catalog.academicYear.slice(0,4));$('leadership-start').value=year+'-05-01';$('leadership-end').value=(year+1)+'-04-30';}};
 $('leadership-form').onsubmit=event=>{event.preventDefault();run(async()=>{await controller.previewLeadership([{action:'grant',responsibilityId:$('leadership-definition').value,sourceRoleAssignmentId:$('leadership-source').value,startDate:$('leadership-start').value,endDate:$('leadership-end').value,usesApprovedDefaultDates:$('leadership-default').checked}],$('leadership-reason').value);if(state.leadership?.preview)$('leadership-preview').focus();});};
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
