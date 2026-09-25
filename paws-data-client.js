(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.createPawsDataClient=api.createPawsDataClient;try{root.UCVM_PAWS_DATA=api.createPawsDataClient({backend:root.UCVM_PAWS_SESSION_BACKEND,tokenProvider:async function(){var user=root.firebase&&root.firebase.auth().currentUser;return user?user.getIdToken():'';},fetchImpl:root.fetch&&root.fetch.bind(root)});}catch(error){root.UCVM_PAWS_DATA={configurationError:error,sessionBackend:function(){return 'invalid';},sessionWritesEnabled:function(){return false;}};}}
})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  function createPawsDataClient(options){
    options=options||{};var backend=options.backend||'firestore';
    if(backend!=='firestore'&&backend!=='azure-sql')throw new Error('Invalid session backend');
    var tokenProvider=options.tokenProvider||async function(){return '';},fetchImpl=options.fetchImpl;
    async function request(path){
      if(backend!=='azure-sql')throw new Error('Firestore owner must perform this operation');
      var token=await tokenProvider();if(!token)throw new Error('Authentication required');
      if(typeof fetchImpl!=='function')throw new Error('Azure SQL API unavailable');
      var response=await fetchImpl(path,{method:'GET',headers:{Accept:'application/json',Authorization:'Bearer '+token},credentials:'same-origin'});
      var body={};try{body=await response.json();}catch(_error){}
      if(!response.ok){var detail=body&&body.error||{};var error=new Error(detail.message||'Request failed');error.code=detail.code||('HTTP_'+response.status);throw error;}
      return body;
    }
    return {sessionBackend:function(){return backend;},sessionWritesEnabled:function(){return backend==='firestore';},currentUser:async function(){return (await request('/api/v1/me')).profile;},listSessions:async function(range){var q=new URLSearchParams({start:range.start,end:range.end});return (await request('/api/v1/sessions?'+q.toString())).sessions||[];}};
  }
  return {createPawsDataClient:createPawsDataClient};
});
