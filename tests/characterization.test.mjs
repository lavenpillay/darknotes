// Characterisation tests: pin the CURRENT behaviour of tools.js, api.js and store.js
// before the TypeScript/monorepo port. Run: node --test tests/
// Uses a throwaway HOME so ~/.darknotes/data.json is never touched.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'darknotes-test-'));
process.env.HOME = tmpHome; // store.js resolves os.homedir() at import time
const dataFile = path.join(tmpHome, '.darknotes', 'data.json');

const { handleTool, TOOLS } = await import('../tools.js');
const { createApiRouter } = await import('../api.js');
const store = await import('../store.js');

const reset = () => fs.rmSync(path.join(tmpHome, '.darknotes'), { recursive: true, force: true });

let server, base;
before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', createApiRouter());
  await new Promise(r => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => {
  server.close();
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

const api = async (method, url, body) => {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

// ── store ────────────────────────────────────────────────────

test('store: defaultData shape', () => {
  reset();
  const d = store.readData();
  assert.equal(d.currentWorkspaceId, 'ws_1');
  assert.equal(d.nextWorkspaceId, 2);
  assert.deepEqual(Object.keys(d.workspaces), ['ws_1']);
  assert.equal(d.workspaces.ws_1.nextNoteId, 1);
});

test('store: array collections are normalised to id-keyed maps on write', () => {
  reset();
  const d = store.readData();
  d.workspaces.ws_1.notes = [{ id: 'n_1', heading: 'a' }];
  store.writeData(d);
  const onDisk = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  assert.deepEqual(Object.keys(onDisk.workspaces.ws_1.notes), ['n_1']);
});

test('store: KNOWN BUG - corrupt file silently resets to defaults', () => {
  reset();
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  fs.writeFileSync(dataFile, '{ not json');
  const d = store.readData();
  assert.equal(Object.keys(d.workspaces).length, 1); // issue A: should throw/back up instead
});

// ── MCP tools ────────────────────────────────────────────────

test('tools: 22 tools, unique names', () => {
  assert.equal(TOOLS.length, 22);
  assert.equal(new Set(TOOLS.map(t => t.name)).size, 22);
});

test('tools: note lifecycle + ids come from workspace counters', async () => {
  reset();
  const a = await handleTool('create_note', { heading: 'A', body: 'l1\nl2' });
  const b = await handleTool('create_note', { heading: 'B', labels: ['x'] });
  assert.equal(a.note.id, 'n_1');
  assert.equal(b.note.id, 'n_2');
  assert.deepEqual(a.note.lines, [{ type: 'text', text: 'l1' }, { type: 'text', text: 'l2' }]);
  // KNOWN GAP (issue E): MCP notes always land at 100,100
  assert.deepEqual([a.note.x, a.note.y, a.note.w, a.note.h], [100, 100, 300, 220]);

  await handleTool('append_to_note', { noteId: 'n_1', body: 'l3' });
  assert.equal((await handleTool('get_note', { noteId: 'n_1' })).lines.length, 3);

  await handleTool('add_label', { noteId: 'n_1', label: 'x' });
  await handleTool('add_label', { noteId: 'n_1', label: 'x' }); // idempotent
  assert.deepEqual((await handleTool('get_note', { noteId: 'n_1' })).labels, ['x']);
  assert.equal((await handleTool('list_notes', { label: 'x' })).length, 2);

  assert.deepEqual(await handleTool('delete_note', { noteId: 'n_2' }), { ok: true, deleted: 'B' });
  await assert.rejects(handleTool('get_note', { noteId: 'n_2' }), /Note not found/);
});

test('tools: check_item only works on check lines', async () => {
  reset();
  await handleTool('create_note', {
    heading: 'T',
    lines: [{ type: 'text', text: 'a' }, { type: 'check', text: 'b', checked: false }],
  });
  await assert.rejects(handleTool('check_item', { noteId: 'n_1', lineIndex: 0, checked: true }), /not a checklist/);
  const r = await handleTool('check_item', { noteId: 'n_1', lineIndex: 1, checked: true });
  assert.equal(r.line.checked, true);
});

test('tools: groups, connections and cascade deletes', async () => {
  reset();
  await handleTool('create_note', { heading: 'A' });
  await handleTool('create_note', { heading: 'B' });
  const g = await handleTool('create_group', { name: 'G' });
  assert.equal(g.group.id, 'g_1');
  await handleTool('add_note_to_group', { noteId: 'n_1', groupId: 'g_1' });
  assert.equal((await handleTool('list_groups', {}))[0].noteCount, 1);

  const c = await handleTool('create_connection', { fromNote: 'n_1', fromSide: 'right', toNote: 'n_2', toSide: 'left' });
  assert.equal(c.connection.id, 'c_1');
  await assert.rejects(
    handleTool('create_connection', { fromNote: 'n_1', fromSide: 'right', toNote: 'nope', toSide: 'left' }),
    /Target note not found/);

  await handleTool('delete_note', { noteId: 'n_2' });
  assert.equal((await handleTool('list_connections', {})).length, 0); // cascade

  await handleTool('delete_group', { groupId: 'g_1' });
  assert.equal((await handleTool('get_note', { noteId: 'n_1' })).groupId, null); // ungrouped, not deleted
});

test('tools: workspaces', async () => {
  reset();
  const w = await handleTool('create_workspace', { name: 'Two' });
  assert.equal(w.workspace.id, 'ws_2');
  await handleTool('rename_workspace', { workspaceId: 'ws_2', name: 'Deux' });
  assert.equal((await handleTool('list_workspaces', {})).find(x => x.id === 'ws_2').name, 'Deux');
  await handleTool('delete_workspace', { workspaceId: 'ws_2' });
  await assert.rejects(handleTool('delete_workspace', { workspaceId: 'ws_1' }), /last workspace/);
});

test('tools: search spans workspaces and matches heading/body/label case-insensitively', async () => {
  reset();
  await handleTool('create_workspace', { name: 'Two' });
  await handleTool('create_note', { heading: 'Alpha', body: 'needle' });
  await handleTool('create_note', { workspaceId: 'ws_2', heading: 'Beta', labels: ['NEEDLE'] });
  const r = await handleTool('search', { query: 'Needle' });
  assert.deepEqual(r.map(x => x.workspaceId).sort(), ['ws_1', 'ws_2']);
});

test('tools: unknown tool throws', async () => {
  await assert.rejects(handleTool('nope', {}), /Unknown tool/);
});

// ── REST API ─────────────────────────────────────────────────

test('api: workspace + note CRUD', async () => {
  reset();
  let r = await api('POST', '/workspaces', { name: ' Hello ' });
  assert.equal(r.status, 201);
  assert.equal(r.body.id, 'ws_2');
  assert.equal(r.body.name, 'Hello'); // trimmed

  r = await api('POST', '/workspaces/ws_1/notes', { heading: 'N', x: 5 });
  assert.equal(r.status, 201);
  assert.equal(r.body.id, 'n_1');
  assert.equal(r.body.x, 5);
  assert.equal(r.body.w, 300);

  r = await api('PATCH', '/workspaces/ws_1/notes/n_1', { heading: 'N2', bogus: 1 });
  assert.equal(r.body.heading, 'N2');
  assert.equal('bogus' in r.body, false); // allow-list

  r = await api('GET', '/workspaces/ws_1/notes?search=n2');
  assert.equal(r.body.length, 1);

  r = await api('DELETE', '/workspaces/ws_1/notes/n_1');
  assert.deepEqual(r.body, { ok: true });
  r = await api('GET', '/workspaces/ws_1/notes/n_1');
  assert.equal(r.status, 404);
});

test('api: PUT /board accepts arrays (browser) and stores maps', async () => {
  reset();
  const r = await api('PUT', '/workspaces/ws_1/board', {
    notes: [{ id: 'n_1', heading: 'x', lines: [], labels: [] }],
    connections: [], groups: [],
    nextNoteId: 2, boardZoom: 1.5,
  });
  assert.deepEqual(r.body, { ok: true });
  const ws = (await api('GET', '/workspaces/ws_1')).body;
  assert.deepEqual(Object.keys(ws.notes), ['n_1']);
  assert.equal(ws.nextNoteId, 2);
  assert.equal(ws.boardZoom, 1.5);
});

test('api: KNOWN BUG - PUT /board can lower the id counter and cause id reuse', async () => {
  reset();
  await handleTool('create_note', { heading: 'A' }); // n_1, counter -> 2
  await api('PUT', '/workspaces/ws_1/board', { nextNoteId: 1 }); // stale client
  const r = await api('POST', '/workspaces/ws_1/notes', { heading: 'B' });
  assert.equal(r.body.id, 'n_1'); // issue D: collides with the existing n_1
});

test('api: connections validate input; REST does not verify notes exist (issue E)', async () => {
  reset();
  let r = await api('POST', '/workspaces/ws_1/connections', { fromNote: 'a' });
  assert.equal(r.status, 400);
  r = await api('POST', '/workspaces/ws_1/connections', { fromNote: 'a', fromSide: 'top', toNote: 'b', toSide: 'top' });
  assert.equal(r.status, 201);
});

test('api: search requires q; last workspace cannot be deleted', async () => {
  reset();
  assert.equal((await api('GET', '/search')).status, 400);
  assert.equal((await api('DELETE', '/workspaces/ws_1')).status, 400);
});
