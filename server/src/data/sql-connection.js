'use strict';
const { AsyncLocalStorage } = require('node:async_hooks');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_KEYS = new Map([
  ['server', 'server'],
  ['datasource', 'server'],
  ['address', 'server'],
  ['addr', 'server'],
  ['networkaddress', 'server'],
  ['port', 'port'],
  ['database', 'database'],
  ['initialcatalog', 'database'],
  ['encrypt', 'encrypt'],
  ['trustservercertificate', 'trustServerCertificate']
]);

function normalizeKey(key) {
  return key.toLowerCase().replace(/\s+/g, '');
}

function resolveSqlDriver(value) {
  const driver = value === undefined || value === null ? '' : String(value).trim().toLowerCase();
  if (!driver || driver === 'tedious') return 'tedious';
  if (driver === 'msnodesqlv8') return 'msnodesqlv8';
  throw Error('Unsupported PAWS_SQL_DRIVER: choose empty, tedious, or msnodesqlv8');
}

function parseBooleanFlag(value, name) {
  if (value === undefined) return false;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw Error(`${name} must be true or false`);
}

function parseConnectionString(connectionString) {
  const values = {};
  for (const segment of connectionString.split(';')) {
    if (!segment.trim()) continue;
    const separator = segment.indexOf('=');
    if (separator < 1) throw Error('PAWS_SQL_CONNECTION_STRING contains an invalid segment');
    const key = segment.slice(0, separator).trim();
    const value = segment.slice(separator + 1).trim();
    const logicalKey = ALLOWED_KEYS.get(normalizeKey(key));
    if (!logicalKey) throw Error(`SQL connection option is not allowed: ${key}`);
    if (values[logicalKey] !== undefined && values[logicalKey] !== value) {
      throw Error(`Conflicting values supplied for ${logicalKey}`);
    }
    values[logicalKey] = value;
  }
  return values;
}

function parseServer(serverValue) {
  const server = serverValue.replace(/^tcp:/i, '');
  const comma = server.lastIndexOf(',');
  if (comma > -1 && /^\d+$/.test(server.slice(comma + 1))) {
    return { server: server.slice(0, comma), port: Number(server.slice(comma + 1)) };
  }
  return { server };
}

function buildWindowsConnectionConfig({ connectionString, allowSelfSigned }) {
  const values = parseConnectionString(connectionString);
  const serverValue = values.server;
  const database = values.database;
  if (!serverValue || !database) throw Error('Windows SQL configuration requires server and database');

  if (values.encrypt !== undefined && values.encrypt.toLowerCase() !== 'true') {
    throw Error('Encrypt must be true in Windows SQL mode');
  }
  if (values.trustServerCertificate !== undefined && !['true', 'false'].includes(values.trustServerCertificate.toLowerCase())) {
    throw Error('TrustServerCertificate must be true or false');
  }
  const trustServerCertificate = values.trustServerCertificate === undefined
    ? false
    : values.trustServerCertificate.toLowerCase() === 'true';
  if (trustServerCertificate && !allowSelfSigned) {
    throw Error('TrustServerCertificate=true requires PAWS_SQL_ALLOW_SELF_SIGNED=true for test-only use');
  }

  const endpoint = parseServer(serverValue);
  if (values.port !== undefined) {
    if (!/^\d+$/.test(values.port) || Number(values.port) < 1 || Number(values.port) > 65535) {
      throw Error('SQL port must be an integer from 1 to 65535');
    }
    if (endpoint.port !== undefined && endpoint.port !== Number(values.port)) {
      throw Error('Conflicting values supplied for port');
    }
    endpoint.port = Number(values.port);
  }
  if (endpoint.port !== undefined && (endpoint.port < 1 || endpoint.port > 65535)) {
    throw Error('SQL port must be an integer from 1 to 65535');
  }
  const odbcValue = value => String(value).replace(/}/g, '}}');
  const server = endpoint.port === undefined ? endpoint.server : endpoint.server + ',' + endpoint.port;
  const odbcConnectionString = [
    'Driver={ODBC Driver 18 for SQL Server}',
    'Server={' + odbcValue(server) + '}',
    'Database={' + odbcValue(database) + '}',
    'Trusted_Connection=Yes',
    'Encrypt=Yes',
    'TrustServerCertificate=' + (trustServerCertificate ? 'Yes' : 'No')
  ].join(';') + ';';
  return {
    ...endpoint,
    database,
    connectionString: odbcConnectionString,
    options: {
      encrypt: true,
      trustServerCertificate,
      trustedConnection: true
    }
  };
}

function buildSqlConnectionConfig({ connectionString, miClientId, driver, allowSelfSigned = false } = {}) {
  const selectedDriver = resolveSqlDriver(driver);
  if (!connectionString) throw Error('PAWS_SQL_CONNECTION_STRING is required');
  if (typeof allowSelfSigned !== 'boolean') throw Error('allowSelfSigned must be a boolean');
  if (allowSelfSigned && selectedDriver !== 'msnodesqlv8') {
    throw Error('PAWS_SQL_ALLOW_SELF_SIGNED is only valid in msnodesqlv8 test mode');
  }
  if (selectedDriver === 'msnodesqlv8' && miClientId) {
    throw Error('PAWS_SQL_DRIVER=msnodesqlv8 cannot be combined with PAWS_SQL_MI_CLIENT_ID');
  }
  if (selectedDriver === 'msnodesqlv8') {
    return buildWindowsConnectionConfig({ connectionString, allowSelfSigned });
  }
  if (!miClientId) return connectionString;
  if (!UUID.test(miClientId)) throw Error('PAWS_SQL_MI_CLIENT_ID must be a UUID');

  const values = parseConnectionString(connectionString);
  const serverValue = values.server;
  const database = values.database;
  if (!serverValue || !database) throw Error('Managed identity configuration requires server and database');
  if (values.encrypt !== undefined && values.encrypt.toLowerCase() !== 'true') {
    throw Error('Encrypt must be true in managed identity mode');
  }
  if (values.trustServerCertificate !== undefined && values.trustServerCertificate.toLowerCase() !== 'false') {
    throw Error('TrustServerCertificate must be false in managed identity mode');
  }

  return {
    ...parseServer(serverValue),
    database,
    authentication: {
      type: 'azure-active-directory-default',
      options: { clientId: miClientId }
    },
    options: {
      encrypt: true,
      trustServerCertificate: false
    }
  };
}

function createSqlConnection({ connectionString, miClientId, driver, allowSelfSigned = false, config, sql, requestTimeoutMs, targetGuard }) {
  if (requestTimeoutMs !== undefined && (!Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs < 1000 || requestTimeoutMs > 120000)) {
    throw Error('SQL request timeout must be an integer from 1000 to 120000 milliseconds');
  }
  const connectionConfig = config || buildSqlConnectionConfig({ connectionString, miClientId, driver, allowSelfSigned });
  const guard = targetGuard ? { text: targetGuard.text, params: { ...targetGuard.params } } : null;
  if (guard && (typeof guard.text !== 'string' || !guard.text.trim() ||
      Object.keys(guard.params).some(name => !/^pawsTarget/.test(name)))) throw Error('Invalid SQL target guard');
  let pool, connecting;
  const transactions = new AsyncLocalStorage();
  return {
    isTransactionActive() { return Boolean(transactions.getStore()); },
    async transaction(callback, {supportOperationId=null}={}) {
      if(transactions.getStore())throw Error('Nested request transaction is unsupported');
      if(!pool)await this.query('SELECT 1 AS ready');
      const transaction=new sql.Transaction(pool);
      let rolledBack=false;transaction.on('rollback',()=>{rolledBack=true;});
      await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      const state={transaction,operationId:supportOperationId,error:null,chain:Promise.resolve()};
      try {
        const result=await transactions.run(state,callback);
        await state.chain;
        if(state.error)throw state.error;
        await transaction.commit();return result;
      }catch(error){if(!rolledBack)await transaction.rollback().catch(()=>{});throw error;}
    },
    async query(text, params = {}, options = {}) {
      if (Object.keys(params).some(name => /^pawsTarget/i.test(name))) throw Error('Reserved SQL target parameter');
      const state=transactions.getStore();
      if(state && !options.transactionQueued){
        const pending=state.chain.then(()=>this.query(text,params,{...options,transactionQueued:true}));
        state.chain=pending.catch(error=>{state.error=state.error||error;});
        return pending;
      }
      const timing = options && options.timing;
      const queryMetric = options && options.queryMetric;
      if (pool) {
        if (timing) timing.record('sql_connect', 0, 'warm');
      } else {
        const connectStarted = timing ? timing.start('sql_connect') : null;
        try {
          if (!connecting) {
            const candidate = new sql.ConnectionPool(connectionConfig);
            // Configure this owned pool before its first connection; concurrent
            // cold requests must share it rather than leak competing pools.
            if (requestTimeoutMs !== undefined) candidate.config.requestTimeout = requestTimeoutMs;
            connecting = Promise.resolve().then(() => candidate.connect()).then(connected => {
              pool = connected;
            }).catch(async error => {
              try { await candidate.close(); } catch (_) { /* retain the original connection failure */ }
              throw error;
            }).finally(() => { connecting = undefined; });
          }
          await connecting;
        } finally {
          if (timing) timing.end('sql_connect', connectStarted, 'cold');
        }
      }
      const request = state ? new sql.Request(state.transaction) : pool.request();
      if(Object.prototype.hasOwnProperty.call(params,'pawsInternalSupportOperation'))throw Error('Reserved SQL parameter');
      if (guard) for (const [name, value] of Object.entries(guard.params)) request.input(name, value);
      if(state?.operationId)request.input('pawsInternalSupportOperation',state.operationId);
      for (const [name, value] of Object.entries(params)) {
        // An explicitly supplied `null` is a real SQL NULL and must be bound:
        // a statement may reference the parameter in an
        // `@p IS NULL OR ...` guard. Only `undefined` (meaning "not supplied")
        // is skipped, so a caller can never leave a referenced variable undeclared.
        if (value !== undefined) request.input(name, value === null ? null : value);
      }
      const queryStarted = timing && queryMetric ? timing.start(queryMetric) : null;
      try {
        // sp_set_session_context takes sql_variant; bind the operation through a typed local so the
        // inferred string parameter type never reaches the sql_variant argument (driver-independent).
        // CONVERT (not TRY_CONVERT): a malformed id must fail the write, never silently skip capture.
        const contextValue=state?.operationId?"DECLARE @pawsInternalSupportOperationValue uniqueidentifier=CONVERT(uniqueidentifier,@pawsInternalSupportOperation);\nEXEC sys.sp_set_session_context @key=N'paws_support_operation',@value=@pawsInternalSupportOperationValue;\n":"EXEC sys.sp_set_session_context @key=N'paws_support_operation',@value=NULL;\n";
        const result = await request.query((guard ? guard.text : '')+contextValue+text);
        return result.recordset || [];
      } catch (error) {
        if (error && (error.number === 55880 || error.originalError?.info?.number === 55880)) {
          error.code = 'ENVIRONMENT_MISCONFIGURED';
          error.message = 'The SQL environment target was rejected.';
        }
        throw error;
      } finally {
        if (timing && queryMetric) timing.end(queryMetric, queryStarted);
      }
    },
    async health() {
      await this.query('SELECT TOP (1) FirebaseUid AS ok FROM paws.UserProfile');
      return true;
    },
    async close() {
      if (connecting) await connecting.catch(() => {});
      if (pool) {
        const current = pool;
        pool = undefined;
        await current.close();
      }
    }
  };
}

module.exports = {
  resolveSqlDriver,
  parseBooleanFlag,
  buildSqlConnectionConfig,
  createSqlConnection
};
