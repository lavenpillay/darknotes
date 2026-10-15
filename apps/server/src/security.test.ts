import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { hostnameOf } from './security';
import { startTestServer, useTempDataDir } from './test-utils';

const tmp = useTempDataDir();
let open: Awaited<ReturnType<typeof startTestServer>>;
let locked: Awaited<ReturnType<typeof startTestServer>>;
before(async () => {
  open = await startTestServer();
  locked = await startTestServer({ token: 's3cret', allowedOrigins: new Set(['https://notes.example.com']) });
});
after(() => {
  open.stop();
  locked.stop();
  tmp.cleanup();
});

/** fetch() forbids overriding Host, so use raw http for Host-header tests. */
const raw = (port: number, headers: Record<string, string>, method = 'GET', path = '/health') =>
  new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }>((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path, headers }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });

test('hostnameOf strips ports and handles IPv6', () => {
  assert.equal(hostnameOf('localhost:3737'), 'localhost');
  assert.equal(hostnameOf('LOCALHOST'), 'localhost');
  assert.equal(hostnameOf('[::1]:3737'), '[::1]');
});

test('Host header: loopback names allowed, anything else (DNS rebinding) rejected', async () => {
  assert.equal((await raw(open.port, { Host: `localhost:${open.port}` })).status, 200);
  assert.equal((await raw(open.port, { Host: `127.0.0.1:${open.port}` })).status, 200);
  assert.equal((await raw(open.port, { Host: `evil.example:${open.port}` })).status, 403);
});

test('Origin: no Origin (MCP/curl) ok; loopback origin ok; foreign origin rejected before any handler runs', async () => {
  const h = { Host: `localhost:${open.port}` };
  assert.equal((await raw(open.port, h)).status, 200);
  const ok = await raw(open.port, { ...h, Origin: 'http://localhost:3000' });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers['access-control-allow-origin'], 'http://localhost:3000');
  const bad = await raw(open.port, { ...h, Origin: 'https://evil.example' }, 'POST', '/api/workspaces');
  assert.equal(bad.status, 403);
  assert.equal(bad.headers['access-control-allow-origin'], undefined);
});

test('configured extra origin is allowed', async () => {
  const r = await raw(locked.port, { Host: `localhost:${locked.port}`, Origin: 'https://notes.example.com' });
  assert.equal(r.status, 200);
});

test('token: required for /api and /mcp, not for /health or CORS preflight', async () => {
  const h = { Host: `localhost:${locked.port}` };
  assert.equal((await raw(locked.port, h, 'GET', '/api/workspaces')).status, 401);
  assert.equal((await raw(locked.port, { ...h, Authorization: 'Bearer wrong' }, 'GET', '/api/workspaces')).status, 401);
  assert.equal((await raw(locked.port, { ...h, Authorization: 'Bearer s3cret' }, 'GET', '/api/workspaces')).status, 200);
  assert.equal((await raw(locked.port, h, 'POST', '/mcp')).status, 401);
  assert.equal((await raw(locked.port, h, 'GET', '/health')).status, 200);
  const pre = await raw(locked.port, { ...h, Origin: 'https://notes.example.com', 'Access-Control-Request-Method': 'DELETE' }, 'OPTIONS', '/api/workspaces');
  assert.equal(pre.status, 204);
  assert.match(String(pre.headers['access-control-allow-methods']), /DELETE/);
});
