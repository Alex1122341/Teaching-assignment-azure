'use strict';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECRET_KEYS = /^(user\s*id|uid|user(name)?|password|pwd|access\s*token|client\s*secret|authentication)$/i;
const KEY_ALIASES = {
  server: ['server', 'data source', 'address', 'addr', 'network address'],
  database: ['database', 'initial catalog'],
  encrypt: ['encrypt'],
  trustServerCertificate: ['trustservercertificate']
};

function parseConnectionString(connectionString) {
  const values = {};
  for (const segment of connectionString.split(';')) {
    if (!segment.trim()) continue;
    const separator = segment.indexOf('=');
    if (separator < 1) throw Error('PAWS_SQL_CONNECTION_STRING contains an invalid segment');
    const key = segment.slice(0, separator).trim();
    const value = segment.slice(separator + 1).trim();
    if (SECRET_KEYS.test(key)) throw Error('Managed identity configuration must not contain SQL credentials');
    values[key.toLowerCase().replace(/\s+/g, '')] = value;
  }
  return values;
}

function lookup(values, aliases) {
  for (const alias of aliases) {
    const value = values[alias.toLowerCase().replace(/\s+/g, '')];
    if (value) return value;
  }
  return undefined;
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
  const serverValue = lookup(values, KEY_ALIASES.server);
  const database = lookup(values, KEY_ALIASES.database);
  if (!serverValue || !database) throw Error('Managed identity configuration requires server and database');

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
    async query(text, params = {}) {
      pool = pool || await new sql.ConnectionPool(config).connect();
      const request = pool.request();
      for (const [name, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) request.input(name, value);
      }
      const result = await request.query(text);
      return result.recordset || [];
    },
    async health() {
      await this.query('SELECT TOP (1) FirebaseUid AS ok FROM paws.UserProfile');
      return true;
    }
  };
}

module.exports = { buildSqlConnectionConfig, createSqlConnection };
