'use strict';

// An unpublished, loopback-only transport for the Testing read slice. It is not
// the Production University API or a declaration of release readiness.
const http = require('node:http');
const { once } = require('node:events');
const TESTING_ORIGIN = 'https://paws-testing-ucvm-20261022.web.app';
const SAME_SITE_ORIGIN = 'https://tester-teaching.web.app';
const ALLOWED_PATHS = new Set(['/api/v1/me', '/api/v1/sessions', '/api/v1/dashboard/leadership-directory', '/api/v1/ccc-schedule', '/api/v1/calendar-activities', '/api/v1/calendar-activities/capabilities']);

async function startTestingHttpServer({ runtime, port = 18788, allowSameSite = false } = {}) {
  if (typeof runtime !== 'function') throw new TypeError('Testing runtime is required');
  if (port !== 0 && port !== 18788) throw new Error('Invalid Testing port');
  if (typeof allowSameSite !== 'boolean') throw new Error('Invalid same-site policy');
  const allowedOrigins = new Set([TESTING_ORIGIN]);
  if (allowSameSite) allowedOrigins.add(SAME_SITE_ORIGIN);
  const server = http.createServer(async (incoming, outgoing) => {
    const origin = incoming.headers.origin;
    const cors = allowedOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : { Vary: 'Origin' };
    const send = (status, body) => {
      const payload = JSON.stringify(body);
      outgoing.writeHead(status, { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Length': Buffer.byteLength(payload) });
      outgoing.end(payload);
    };
    if (origin && !allowedOrigins.has(origin)) return send(403, { error: { code: 'CORS_ORIGIN_DENIED' } });
    let url;
    try {
      url = new URL(incoming.url || '/', 'http://127.0.0.1');
      if (url.origin !== 'http://127.0.0.1') throw new Error('Invalid URL');
    } catch (_) { return send(400, { error: { code: 'INVALID_URL' } }); }
    if (!ALLOWED_PATHS.has(url.pathname)) return send(404, { error: { code: 'NOT_FOUND' } });
    if (incoming.method === 'OPTIONS') {
      const headers = String(incoming.headers['access-control-request-headers'] || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
      if (!allowedOrigins.has(origin) || incoming.headers['access-control-request-method'] !== 'GET' || headers.some(x => x !== 'authorization')) {
        return send(403, { error: { code: 'CORS_PREFLIGHT_DENIED' } });
      }
      outgoing.writeHead(204, { ...cors, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization', 'Cache-Control': 'no-store' });
      return outgoing.end();
    }
    if (incoming.method !== 'GET') return send(405, { error: { code: 'METHOD_NOT_ALLOWED' } });
    if (incoming.headers['transfer-encoding'] || (incoming.headers['content-length'] && incoming.headers['content-length'] !== '0')) return send(400, { error: { code: 'BODY_NOT_ALLOWED' } });
    try {
      const headers = new Headers();
      if (incoming.headers.authorization) headers.set('authorization', incoming.headers.authorization);
      const result = await runtime(new Request(url, { method: 'GET', headers }));
      if (!Number.isInteger(result?.status) || result.status < 200 || result.status > 599 || !result.jsonBody || typeof result.jsonBody !== 'object') throw new Error('Invalid runtime result');
      return send(result.status, result.jsonBody);
    } catch (_) {
      return send(503, { error: { code: 'SERVICE_UNAVAILABLE', message: 'The Testing service is temporarily unavailable.' } });
    }
  });
  server.requestTimeout = 15000;
  server.listen(port, '127.0.0.1');
  await once(server, 'listening');
  return server;
}

module.exports = { startTestingHttpServer };
