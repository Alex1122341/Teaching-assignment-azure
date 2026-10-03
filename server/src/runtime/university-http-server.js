'use strict';

const http = require('node:http');
const { isIP } = require('node:net');

const DEFAULT_MAX_BODY_BYTES = 64 * 1024;
const ABSOLUTE_MAX_BODY_BYTES = 1024 * 1024;
const FIXED_ERROR = JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE', message: 'The service is temporarily unavailable.' } });

function parseOrigins(value) {
  if (value === undefined || value === null || String(value).trim() === '') return new Set();
  const origins = new Set();
  for (const item of String(value).split(',')) {
    const origin = item.trim();
    let parsed;
    try { parsed = new URL(origin); } catch (_) { throw new Error('PAWS_API_ALLOWED_ORIGINS contains an invalid origin'); }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin || parsed.username || parsed.password) {
      throw new Error('PAWS_API_ALLOWED_ORIGINS must contain exact HTTP(S) origins without paths');
    }
    origins.add(origin);
  }
  return origins;
}

function assertLoopbackHost(host) {
  const normalized = String(host || '').toLowerCase();
  if (normalized === 'localhost' || normalized === '::1' || normalized === '127.0.0.1') return normalized;
  const ipVersion = isIP(normalized);
  if (ipVersion === 6 && normalized === '0:0:0:0:0:0:0:1') return '::1';
  throw new Error('University API host must be loopback');
}

function maxBodyBytes(env) {
  if (env.PAWS_API_MAX_BODY_BYTES === undefined) return DEFAULT_MAX_BODY_BYTES;
  const value = String(env.PAWS_API_MAX_BODY_BYTES);
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > ABSOLUTE_MAX_BODY_BYTES) {
    throw new Error('PAWS_API_MAX_BODY_BYTES must be from 1 to 1048576');
  }
  return Number(value);
}

function jsonError(status, code, message, headers = {}) {
  return { status, headers, jsonBody: { error: { code, message } } };
}

async function readBody(request, limit) {
  const header = request.headers['content-length'];
  if (header !== undefined && (!/^\d+$/.test(String(header)) || Number(header) > limit)) {
    const error = new Error(Number(header) > limit ? 'BODY_TOO_LARGE' : 'INVALID_CONTENT_LENGTH');
    throw error;
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error('BODY_TOO_LARGE');
    chunks.push(chunk);
  }
  if (size === 0) return null;
  const contentType = String(request.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') throw new Error('JSON_REQUIRED');
  const text = Buffer.concat(chunks, size).toString('utf8');
  try { JSON.parse(text); } catch (_) { throw new Error('INVALID_JSON'); }
  return Buffer.from(text, 'utf8');
}

function createUniversityHttpServer({
  runtime,
  env = process.env,
  host = env.PAWS_API_HOST || '127.0.0.1',
  logger = console
} = {}) {
  if (typeof runtime !== 'function') throw new TypeError('runtime must be a request handler');
  const bindHost = assertLoopbackHost(host);
  const origins = parseOrigins(env.PAWS_API_ALLOWED_ORIGINS);
  const bodyLimit = maxBodyBytes(env);

  return http.createServer(async (incoming, outgoing) => {
    const origin = incoming.headers.origin;
    const corsHeaders = {};
    if (origin) {
      if (!origins.has(origin)) {
        const denied = jsonError(403, 'CORS_ORIGIN_DENIED', 'Origin is not allowed.');
        outgoing.writeHead(denied.status, { 'Content-Type': 'application/json; charset=utf-8', Vary: 'Origin' });
        outgoing.end(JSON.stringify(denied.jsonBody));
        return;
      }
      corsHeaders['Access-Control-Allow-Origin'] = origin;
      corsHeaders.Vary = 'Origin';
      corsHeaders['Access-Control-Expose-Headers'] = 'Server-Timing';
    }

    if (incoming.method === 'OPTIONS') {
      const requestedMethod = String(incoming.headers['access-control-request-method'] || '').toUpperCase();
      const requestedHeaders = String(incoming.headers['access-control-request-headers'] || '')
        .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
      const allowedHeaders = new Set(['authorization', 'content-type']);
      if (!origin || !origins.has(origin) || !['GET', 'POST'].includes(requestedMethod) ||
          requestedHeaders.some(value => !allowedHeaders.has(value))) {
        outgoing.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8', Vary: 'Origin' });
        outgoing.end(JSON.stringify({ error: { code: 'CORS_PREFLIGHT_DENIED', message: 'Preflight request is not allowed.' } }));
        return;
      }
      outgoing.writeHead(204, {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '600'
      });
      outgoing.end();
      return;
    }

    try {
      const body = await readBody(incoming, bodyLimit);
      const headers = new Headers();
      for (const name of ['authorization', 'content-type', 'accept']) {
        const value = incoming.headers[name];
        if (value) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      }
      const init = { method: incoming.method, headers };
      if (body !== null && incoming.method !== 'GET' && incoming.method !== 'HEAD') {
        init.body = body;
        init.duplex = 'half';
      } else if (body !== null) {
        outgoing.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' });
        outgoing.end(JSON.stringify({ error: { code: 'BODY_NOT_ALLOWED', message: 'Request body is not allowed for this method.' } }));
        return;
      }
      const requestUrl = new URL(incoming.url || '/', 'http://127.0.0.1').toString();
      const result = await runtime(new Request(requestUrl, init));
      const status = Number.isInteger(result && result.status) && result.status >= 100 && result.status <= 599 ? result.status : 503;
      const responseHeaders = { ...corsHeaders };
      const suppliedHeaders = result && result.headers;
      if (suppliedHeaders && typeof suppliedHeaders === 'object') {
        for (const [name, value] of Object.entries(suppliedHeaders)) {
          if (value !== undefined && value !== null) responseHeaders[name] = String(value);
        }
      }
      let payload = '';
      if (result && Object.prototype.hasOwnProperty.call(result, 'jsonBody') && result.jsonBody !== undefined && status !== 204 && status !== 304) {
        payload = JSON.stringify(result.jsonBody);
        responseHeaders['Content-Type'] = responseHeaders['Content-Type'] || 'application/json; charset=utf-8';
        responseHeaders['Content-Length'] = Buffer.byteLength(payload);
      }
      outgoing.writeHead(status, responseHeaders);
      outgoing.end(incoming.method === 'HEAD' ? undefined : payload);
    } catch (error) {
      if (error && error.message === 'BODY_TOO_LARGE') {
        const response = jsonError(413, 'BODY_TOO_LARGE', 'Request body exceeds the configured limit.');
        outgoing.writeHead(response.status, { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' });
        outgoing.end(JSON.stringify(response.jsonBody));
        return;
      }
      if (error && ['INVALID_CONTENT_LENGTH', 'JSON_REQUIRED', 'INVALID_JSON'].includes(error.message)) {
        const response = jsonError(400, error.message, 'Request must contain valid JSON.');
        outgoing.writeHead(response.status, { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' });
        outgoing.end(JSON.stringify(response.jsonBody));
        return;
      }
      try { if (logger && typeof logger.error === 'function') logger.error({ event: 'paws_api_request_failed' }); } catch (_) {}
      if (!outgoing.headersSent) {
        outgoing.writeHead(503, { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(FIXED_ERROR) });
      }
      outgoing.end(FIXED_ERROR);
    }
  });
}

module.exports = {
  createUniversityHttpServer,
  parseOrigins,
  assertLoopbackHost,
  DEFAULT_MAX_BODY_BYTES,
  ABSOLUTE_MAX_BODY_BYTES
};
