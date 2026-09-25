'use strict';
function createSqlConnection({connectionString,sql}){if(!connectionString)throw Error('PAWS_SQL_CONNECTION_STRING is required');let pool;return {async query(text,params={}){pool=pool||await new sql.ConnectionPool(connectionString).connect();const request=pool.request();for(const [name,value] of Object.entries(params))if(value!==undefined&&value!==null)request.input(name,value);const result=await request.query(text);return result.recordset||[];},async health(){await this.query('SELECT TOP (1) 1 AS ok FROM paws.UserProfile');return true;}};}
module.exports={createSqlConnection};
