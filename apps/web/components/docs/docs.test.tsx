// Drift guards: the documentation is checked against the code it describes, so it cannot silently go stale.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { DocsContent } from './DocsContent';
import { DOCS_NAV } from './nav';

const html = renderToStaticMarkup(<DocsContent />);
const repo = path.resolve(process.cwd(), '../..');
const read = (rel: string) => fs.readFileSync(path.join(repo, rel), 'utf8');
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const unique = (xs: string[]) => [...new Set(xs)];

test('page renders with its title, sidebar and every section', () => {
  assert.match(html, /<h1>DarkNotes<span class="accent">\.<\/span> Documentation<\/h1>/);
  assert.match(html, /<aside aria-label="Documentation contents">/);
  assert.equal(html.includes('undefined'), false);
  assert.equal(html.includes('[object'), false);
});

test('every table-of-contents entry has a matching heading, and ids are unique', () => {
  const ids = [...html.matchAll(/<h2 id="([^"]+)"/g)].map((m) => m[1]!);
  assert.equal(new Set(ids).size, ids.length, 'duplicate h2 ids');
  for (const link of DOCS_NAV.flatMap((g) => g.links)) assert.ok(ids.includes(link.id), `nav link #${link.id} has no heading`);
  for (const id of ids) assert.ok(DOCS_NAV.some((g) => g.links.some((l) => l.id === id)), `heading #${id} is missing from the sidebar`);
});

test('every in-page link points at something that exists', () => {
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!));
  const targets = unique([...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]!));
  assert.ok(targets.length > 10);
  for (const t of targets) assert.ok(ids.has(t), `broken link #${t}`);
});

test('every MCP tool in the server is documented', () => {
  const tools = [...read('apps/server/src/tools.ts').matchAll(/\btool\('([a-z_]+)'/g)].map((m) => m[1]!);
  assert.equal(tools.length, 22);
  for (const name of tools) assert.ok(html.includes(`<td class="tool-name">${name}</td>`), `tool ${name} is not documented`);
});

test('every REST route in the server is documented, with the right method', () => {
  const routes = [...read('apps/server/src/rest.ts').matchAll(/router\.(get|post|put|patch|delete)\('([^']+)'/g)].map((m) => ({ method: m[1]!, path: m[2]! }));
  assert.ok(routes.length >= 20);
  for (const { method, path: p } of routes) {
    const re = new RegExp(`<span class="method ${method}">${method.toUpperCase()}</span></td><td class="endpoint">${escapeRe(p)}(\\?[^<]*)?</td>`);
    assert.match(html, re, `${method.toUpperCase()} ${p} is not documented`);
  }
});

test('/health and the MCP endpoint are documented', () => {
  assert.match(html, /class="endpoint">\/health</);
  assert.match(html, /class="endpoint">\/mcp</);
});

test('every environment variable the server reads is documented', () => {
  // Deliberately undocumented: only locates the original interface's files, which the cleanup removes.
  const internal = new Set(['DARKNOTES_LEGACY_UI_DIR']);
  const vars = unique(['apps/server/src/config.ts', 'packages/core/src/store.ts'].flatMap((f) => [...read(f).matchAll(/DARKNOTES_[A-Z_]+/g)].map((m) => m[0]))).filter((v) => !internal.has(v));
  assert.ok(vars.length >= 6);
  for (const v of vars) assert.ok(html.includes(`<td class="tool-name">${v}</td>`), `${v} is not documented`);
});

test('every npm script shown in the docs really exists', () => {
  const scripts = new Set(Object.keys(JSON.parse(read('package.json')).scripts as Record<string, string>));
  const used = unique([...html.matchAll(/npm run ([a-z][a-z:-]*)/g)].map((m) => m[1]!));
  assert.ok(used.length >= 4);
  for (const s of used) assert.ok(scripts.has(s), `docs mention "npm run ${s}", which is not a script`);
});

test('documented numbers match the code', () => {
  assert.match(html, /20 presets/); // note colours
  assert.match(html, /<strong>Text colour<\/strong> has 10/);
  assert.match(html, /160 to 520 px/); // minimap width range
  assert.match(html, /5,000 notes/);
  assert.match(html, /220 × 140/);
  assert.match(html, /25% to 300%/);
});
