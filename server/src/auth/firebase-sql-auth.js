'use strict';
function createFirebaseSqlAuth({verifyIdToken,expectedProjectId}){return async token=>{if(!token)throw Object.assign(Error('Authentication required'),{status:401});const decoded=await verifyIdToken(token);const audience=decoded.aud,issuer=decoded.iss;if(audience!==expectedProjectId||issuer!==`https://securetoken.google.com/${expectedProjectId}`)throw Object.assign(Error('Token project mismatch'),{status:401});return decoded;};}
module.exports={createFirebaseSqlAuth};
