// Serving the built web app: pages, docs, hashed assets, the 404 page, and the hint shown before it is built.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { startTestServer, useTempDataDir } from './test-utils';

const tmp = useTempDataDir();
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dn-static-'));
const web = path.join(root, 'out');
const write = (file: string, text: string) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};
write(path.join(web, 'index.html'), '<html>BOARD APP</html>');
write(path.join(web, 'documentation.html'), '<html>DOCS PAGE</html>');
write(path.join(web, '404.html'), '<html>NOT FOUND PAGE</html>');
// Next's export also writes a same-named folder next to each page (its data files). Mirror that: it broke /documentation.
write(path.join(web, 'documentation', '__next.documentation.txt'), 'data');
write(path.join(web, '_next', 'static', 'chunks', 'app-abc123.js'), 'console.log("chunk")');

let built: Awaited<ReturnType<typeof startTestServer>>;
let nothing: Awaited<ReturnType<typeof startTestServer>>;
before(async () => {
  built = await startTestServer({ webDir: web });
  nothing = await startTestServer({ webDir: path.join(root, 'not-built') });
});
after(() => {
  built.stop();
  nothing.stop();
  tmp.cleanup();
  fs.rmSync(root, { recursive: true, force: true });
});

const get = async (srv: { url: string }, p: string) => {
  const res = await fetch(srv.url + p);
  return { status: res.status, text: await res.text(), cache: res.headers.get('cache-control'), type: res.headers.get('content-type') };
};

test('built web app: / and /documentation are served from the export (pages are never cached)', async () => {
  const index = await get(built, '/');
  assert.deepEqual([index.status, index.text, index.cache], [200, '<html>BOARD APP</html>', 'no-cache']);
  const docs = await get(built, '/documentation');
  assert.deepEqual([docs.status, docs.text], [200, '<html>DOCS PAGE</html>']);
  assert.equal((await get(built, '/documentation.html')).status, 200);
  assert.equal((await get(built, '/documentation/')).text, '<html>DOCS PAGE</html>'); // trailing slash
  const redirects = await fetch(`${built.url}/documentation`, { redirect: 'manual' });
  assert.equal(redirects.status, 200); // served directly, not redirected to the folder
});

test('built web app: hashed assets are cached for a year, immutable', async () => {
  const js = await get(built, '/_next/static/chunks/app-abc123.js');
  assert.equal(js.status, 200);
  assert.equal(js.cache, 'public, max-age=31536000, immutable');
  assert.match(js.type ?? '', /javascript/);
});

test('built web app: unknown pages get the exported 404 page with a 404 status', async () => {
  const r = await get(built, '/no/such/page');
  assert.deepEqual([r.status, r.text], [404, '<html>NOT FOUND PAGE</html>']);
});

test('the API, health and MCP routes are not shadowed by the web app; unknown /api paths are JSON 404s', async () => {
  assert.equal((await get(built, '/health')).text, '{"ok":true,"service":"darknotes-api"}');
  const ws = await get(built, '/api/workspaces');
  assert.equal(ws.status, 200);
  assert.match(ws.type ?? '', /json/);
  const nope = await get(built, '/api/nope');
  assert.deepEqual([nope.status, nope.text], [404, '{"error":"Not found"}']);
  const mcp = await fetch(`${built.url}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(mcp.status, 400); // handled by the MCP route, not served as a page
});

test('the web app does not leak files outside its directory, and dotfiles are not served', async () => {
  write(path.join(root, 'secret.txt'), 'top secret');
  write(path.join(web, '.hidden'), 'hidden');
  const r = await new Promise<{ status: number; body: string }>((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: Number(new URL(built.url).port), path: '/../secret.txt', headers: { Host: 'localhost' } }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode!, body }));
    }).on('error', reject);
  });
  assert.notEqual(r.body, 'top secret');
  assert.notEqual((await get(built, '/.hidden')).text, 'hidden');
});

test('the web app is behind the same Host guard as the API (DNS rebinding)', async () => {
  const status = await new Promise<number>((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: Number(new URL(built.url).port), path: '/', headers: { Host: 'evil.example' } }, (res) => {
      res.resume();
      resolve(res.statusCode!);
    }).on('error', reject);
  });
  assert.equal(status, 403);
});

test('before the web app is built, / explains what to do, and the API still works', async () => {
  const r = await get(nothing, '/');
  assert.equal(r.status, 404);
  assert.match(r.type ?? '', /text\/plain/);
  assert.match(r.text, /has not been built/);
  assert.match(r.text, /npm run build/);
  assert.match(r.text, /npm run dev:all/);
  assert.equal((await get(nothing, '/health')).status, 200);
  assert.equal((await get(nothing, '/documentation')).status, 404);
});
