'use strict';
// Compatibility entry point; the Testing implementation lives in tools/testing.
if (require.main === module) {
  const { spawnSync } = require('node:child_process');
  const result = spawnSync(process.execPath, [require.resolve('../testing/db/university-admin-sql.js'), ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
  if (result.error) { console.error('Testing compatibility entry point failed.'); process.exitCode = 1; }
  else process.exitCode = result.status === null ? 1 : result.status;
} else module.exports = require('../testing/db/university-admin-sql.js');
