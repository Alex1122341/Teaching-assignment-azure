'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestingHttpServer } = require('../tools/testing/firestore-http');

test('Testing listener refuses the production-adjacent port', async () => {
  let server;
  try {
    server = await startTestingHttpServer({ runtime: async () => ({}), port: 18789 });
    assert.fail('Testing must reject this port');
  } catch (error) {
    assert.match(error.message, /Invalid Testing port/);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
  }
});

test('Testing HTTP adapter restricts origins, methods and routes before dispatch', async t => {
  const calls = [];
  const server = await startTestingHttpServer({ port: 0, runtime: async request => {
    calls.push({ path: new URL(request.url).pathname, token: request.headers.get('authorization') });
    return { status: 200, jsonBody: { environment: 'testing' } };
  } });
  assert.equal(server.address().address, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const origin = 'https://paws-testing-ucvm-20261022.web.app';
  const preflight = await fetch(base + '/api/v1/me', { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'GET', 'access-control-request-headers': 'authorization' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
  assert.equal((await fetch(base + '/api/v1/me', { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization' } })).status, 403);
  assert.equal((await fetch(base + '/api/v1/me', { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'GET', 'access-control-request-headers': 'authorization, x-unsupported' } })).status, 403);
  assert.equal((await fetch(base + '/api/v1/me', { headers: { origin: 'https://tester-teaching.web.app' } })).status, 403);
  assert.equal((await fetch(base + '/api/v1/me', { method: 'POST', headers: { origin } })).status, 405);
  assert.equal((await fetch(base + '/api/health/runtime', { headers: { origin } })).status, 404);
  assert.equal(calls.length, 0);
  const response = await fetch(base + '/api/v1/me', { headers: { origin, authorization: 'Bearer synthetic-token' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(calls, [{ path: '/api/v1/me', token: 'Bearer synthetic-token' }]);
});

test('Testing HTTP adapter rejects unexpected runtime errors without exposing details', async t => {
  const server = await startTestingHttpServer({ port: 0, runtime: async () => { throw new Error('sensitive runtime detail'); } });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/sessions`);
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /sensitive runtime detail/);
});

test('same-site CORS requires an explicit Testing-host opt-in and still refuses writes', async t => {
  const calls = [];
  const server = await startTestingHttpServer({ port: 0, allowSameSite: true, runtime: async request => {
    calls.push(request.method);
    return { status: 401, jsonBody: { error: { code: 'UNAUTHORIZED' } } };
  } });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = 'http://127.0.0.1:' + server.address().port + '/api/v1/me';
  const origin = 'https://tester-teaching.web.app';
  const headers = { origin, 'access-control-request-method': 'GET', 'access-control-request-headers': 'authorization' };
  const preflight = await fetch(url, { method: 'OPTIONS', headers });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
  const denied = await fetch(url, { headers: { origin } });
  assert.equal(denied.status, 401, 'CORS is not authentication');
  assert.equal((await fetch(url, { method: 'POST', headers: { origin } })).status, 405);
  assert.equal((await fetch(url, { headers: { origin: 'https://untrusted.example.org' } })).status, 403);
  assert.deepEqual(calls, ['GET']);
});
