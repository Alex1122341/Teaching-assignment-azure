'use strict';

const { createSwaSqlRuntime } = require('./swa-sql-runtime');
const { createUniversityHttpServer } = require('./university-http-server');

function listenPort(env) {
  const value = env.PAWS_API_PORT === undefined ? '8787' : String(env.PAWS_API_PORT);
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) {
    throw new Error('PAWS_API_PORT must be an integer from 1 to 65535');
  }
  return Number(value);
}

const delay = ms => new Promise(resolve => { const timer = setTimeout(resolve, ms); if (timer.unref) timer.unref(); });

async function verifyBeforeListening({ runtime, isStopping = () => false, wait = delay, log = line => console.error(line), maxDelayMs = 60000 }) {
  if (typeof runtime.assertEnvironment !== 'function') return true;
  for (let attempt = 1; ; attempt += 1) {
    try {
      await runtime.assertEnvironment();
      return true;
    } catch (error) {
      if (error && error.code === 'ENVIRONMENT_MISCONFIGURED') {
        log(JSON.stringify({ event: 'paws_api_environment_rejected', code: 'ENVIRONMENT_MISCONFIGURED' }));
        throw error;
      }
      const retryInMs = Math.min(maxDelayMs, 1000 * 2 ** Math.min(attempt - 1, 6));
      log(JSON.stringify({ event: 'paws_api_sql_unavailable_retrying', attempt, retryInMs }));
      if (isStopping()) return false;
      await wait(retryInMs);
      if (isStopping()) return false;
    }
  }
}

function start() {
  const env = process.env;
  const runtime = createSwaSqlRuntime({ env });
  const server = createUniversityHttpServer({ runtime, env });
  const port = listenPort(env);
  const host = env.PAWS_API_HOST || '127.0.0.1';
  let stopping = false;

  // Refuse to listen until the SQL database declares the configured environment. A wrong
  // environment stops the process; SQL that is merely unreachable is retried with backoff, so a
  // brief database outage at boot doesn't leave the service down.
  verifyBeforeListening({ runtime, isStopping: () => stopping }).then(verified => {
    if (!verified || stopping) return;
    server.listen(port, host, () => {
      console.log(JSON.stringify({ event: 'paws_api_listening', host, port, environment: runtime.environment }));
    });
  }, () => {
    process.exitCode = 1;
    runtime.close().catch(() => {});
  });

  const shutdown = signal => {
    if (stopping) return;
    stopping = true;
    console.log(JSON.stringify({ event: 'paws_api_shutdown', signal }));
    const timeout = setTimeout(() => server.closeAllConnections(), 15000);
    timeout.unref();
    server.close(async error => {
      clearTimeout(timeout);
      try {
        await runtime.close();
      } catch (_) {
        console.error(JSON.stringify({ event: 'paws_api_sql_close_failed' }));
        process.exitCode = 1;
      }
      if (error) {
        console.error(JSON.stringify({ event: 'paws_api_http_close_failed' }));
        process.exitCode = 1;
      }
    });
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  return server;
}

if (require.main === module) {
  try { start(); } catch (_) {
    console.error(JSON.stringify({ event: 'paws_api_start_failed' }));
    process.exitCode = 1;
  }
}

module.exports = { start, listenPort, verifyBeforeListening };
