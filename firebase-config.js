(function(root){
  'use strict';
  var requested=root.UCVM_PAWS_SESSION_BACKEND;
  root.UCVM_PAWS_SESSION_BACKEND=requested===undefined||requested===null||requested===''?'firestore':(requested==='firestore'||requested==='azure-sql'?requested:'invalid');
})(typeof window==='undefined'?globalThis:window);
