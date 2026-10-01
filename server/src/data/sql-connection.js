'use strict';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_KEYS = new Map([
  ['server', 'server'],
  ['datasource', 'server'],
  ['address', 'server'],
  ['addr', 'server'],
  ['networkaddress', 'server'],
  ['database', 'database'],
  ['initialcatalog', 'database'],
  ['encrypt', 'encrypt'],
  ['trustservercertificate', 'trustServerCertificate']
]);

function normalizeKey(key) {
  return key.toLowerCase().replace(/\s+/g, '');
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
    if (!logicalKey) throw Error(`Managed identity connection option is not allowed: ${key}`);
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

function buildSqlConnectionConfig({ connectionString, miClientId } = {}) {
  if (!connectionString) throw Error('PAWS_SQL_CONNECTION_STRING is required');
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

function createSqlConnection({ connectionString, miClientId, sql }) {
  const config = buildSqlConnectionConfig({ connectionString, miClientId });
  let pool;
  return {
    async query(text, params = {}, options = {}) {
      const timing = options && options.timing;
      const queryMetric = options && options.queryMetric;
      if (pool) {
        if (timing) timing.record('sql_connect', 0, 'warm');
      } else {
        const connectStarted = timing ? timing.start('sql_connect') : null;
        try {
          pool = pool || await new sql.ConnectionPool(config).connect();
        } finally {
          if (timing) timing.end('sql_connect', connectStarted, 'cold');
        }
      }
      const request = pool.request();
      for (const [name, value] of Object.entries(params)) {
        // An explicitly supplied `null` is a real SQL NULL and must be bound:
        // a statement may reference the parameter in an
        // `@p IS NULL OR ...` guard. Only `undefined` (meaning "not supplied")
        // is skipped, so a caller can never leave a referenced variable
        // undeclared.
        if (value !== undefined) request.input(name, value === null ? null : value);
      }
      const queryStarted = timing && queryMetric ? timing.start(queryMetric) : null;
      try {
        const result = await request.query(text);
        return result.recordset || [];
      } finally {
        if (timing && queryMetric) timing.end(queryMetric, queryStarted);
      }
    },
    async health() {
      await this.query('SELECT TOP (1) FirebaseUid AS ok FROM paws.UserProfile');
      return true;
    }
  };
}

module.exports = { buildSqlConnectionConfig, createSqlConnection };
