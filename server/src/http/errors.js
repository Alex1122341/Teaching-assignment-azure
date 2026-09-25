'use strict';
function response(status,code,message,data){return {status,jsonBody:Object.assign({error:{code,message}},data||{})};}
function safeFailure(){return response(503,'SERVICE_UNAVAILABLE','The SQL read service is temporarily unavailable.');}
module.exports={response,safeFailure};
