(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.PAWS_OFFICE_WORKSPACE=api;
})(typeof window==='undefined'?null:window,function(){
 'use strict';const mounted=new WeakMap();
 // Page controllers own authentication, business capabilities and all local tabs.
 function mount({document:doc,window:win,page,nodes={}}){
  if(!['faculty','assignments'].includes(page))throw new Error('Unsupported office workspace route');
  if(mounted.has(doc))return mounted.get(doc);
  const header=nodes.header||doc.querySelector('.topbar');
  const calendar=nodes.calendar||doc.getElementById('back-btn')||doc.querySelector('.top-actions a[href="index.html"]');
  if(!header||!calendar)throw new Error('Office workspace requires existing header and Calendar action');
  const link=(href,label)=>{const node=doc.createElement('a');node.href=href;node.textContent=label;return node;};
  const assignments=nodes.assignments||link('teaching-assignments.html','Teaching Assignments');
  const dashboard=nodes.dashboard||doc.querySelector('.top-actions a[href="faculty-admin.html"]')||link('faculty-admin.html','Faculty Dashboard');
  const admin=nodes.admin||doc.getElementById('user-management-link');
  const current=page==='faculty'?dashboard:assignments;current.setAttribute('aria-current','page');
  const groups=[{label:'Teaching',entries:[{node:calendar,icon:'▦'},{node:assignments,icon:'≡'}]},{label:'Faculty',entries:[{node:dashboard,icon:'♙'}]}];
  if(admin)groups.push({label:'Administration',entries:[{node:admin,icon:'⚙'}]});
  const shell=win.PAWS_WORKSPACE_NAVIGATION.mount({document:doc,window:win,header,groups,
   globalNodes:nodes.globalNodes||[doc.querySelector('.top-actions')].filter(Boolean),
   pageTitle:page==='faculty'?'Faculty Dashboard':'Teaching Assignments',shellClass:'paws-office-shell',
   backgroundSelector:'.ucalgary-masthead,.masthead,.topbar,.main-content,.page-shell',measureHeader:true});
  const api=Object.freeze({sync(profile){
   const access=win.UCVM;
   const canAssignments=Boolean(access?.canOpenTeachingAssignments(profile)),canDashboard=Boolean(access?.canOpenFacultyDashboard(profile));
   assignments.hidden=!canAssignments;dashboard.hidden=!canDashboard;
   const active=profile?.active===true&&profile.mustChangePassword!==true&&(page==='faculty'?canDashboard:canAssignments);
   doc.body.classList.toggle('paws-office-locked',!active);shell.sync(active);
  }});
  mounted.set(doc,api);api.sync(null);return api;
 }
 return Object.freeze({mount});
});
