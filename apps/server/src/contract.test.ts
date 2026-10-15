// Contract tests for the REST and MCP adapters. Cases marked FIX record behaviour that was deliberately changed
// from the original JavaScript server (validation, reference checks, id safety); the rest pins what must not change.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { handleTool, TOOLS } from './tools';
import { startTestServer, useTempDataDir } from './test-utils';

const tmp = useTempDataDir();
let srv: Awaited<ReturnType<typeof startTestServer>>;
before(async () => {
  srv = await startTestServer();
});
after(() => {
  srv.stop();
  tmp.cleanup();
});

const api = async (method: string, url: string, body?: unknown) => {
  const res = await fetch(`${srv.url}/api${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as any };
};
const tool = (name: string, args: Record<string, unknown> = {}) => handleTool(name, args) as Promise<any>;

// ── MCP tools ────────────────────────────────────────────────

test('tools: 22 unique tools (names are a public contract)', () => {
  assert.equal(TOOLS.length, 22);
  assert.equal(new Set(TOOLS.map((t) => t.name)).size, 22);
});

test('tools: note lifecycle + ids come from workspace counters', async () => {
  tmp.reset();
  const a = await tool('create_note', { heading: 'A', body: 'l1\nl2' });
  const b = await tool('create_note', { heading: 'B', labels: ['x'] });
  assert.deepEqual([a.note.id, b.note.id], ['n_1', 'n_2']);
  assert.deepEqual(a.note.lines, [{ type: 'text', text: 'l1' }, { type: 'text', text: 'l2' }]);
  assert.deepEqual([a.note.x, a.note.y, a.note.w, a.note.h], [100, 100, 300, 220]);

  await tool('append_to_note', { noteId: 'n_1', body: 'l3' });
  assert.equal((await tool('get_note', { noteId: 'n_1' })).lines.length, 3);
  await tool('add_label', { noteId: 'n_1', label: 'x' });
  await tool('add_label', { noteId: 'n_1', label: 'x' });
  assert.deepEqual((await tool('get_note', { noteId: 'n_1' })).labels, ['x']);
  const listed = await tool('list_notes', { label: 'x' });
  assert.equal(listed.length, 2);
  assert.deepEqual(Object.keys(listed[0]).sort(), ['groupId', 'heading', 'id', 'labels', 'lineCount', 'preview']);

  assert.deepEqual(await tool('delete_note', { noteId: 'n_2' }), { ok: true, deleted: 'B' });
  await assert.rejects(tool('get_note', { noteId: 'n_2' }), /Note not found/);
});

test('tools FIX: create_note/update_note honour position, size and fonts', async () => {
  tmp.reset();
  const n = await tool('create_note', { heading: 'P', x: 5, y: 6, w: 7, h: 8, headingFont: 'Lora' });
  assert.deepEqual([n.note.x, n.note.y, n.note.w, n.note.h, n.note.headingFont], [5, 6, 7, 8, 'Lora']);
  const u = await tool('update_note', { noteId: 'n_1', x: 50, w: 70 });
  assert.deepEqual([u.note.x, u.note.y, u.note.w], [50, 6, 70]);
});

test('tools: required args and invalid input give clear errors', async () => {
  tmp.reset();
  await assert.rejects(tool('get_note', {}), /noteId is required/);
  await assert.rejects(tool('check_item', { noteId: 'n_1' }), /lineIndex is required/);
  await assert.rejects(tool('create_note', { heading: 5 }), /heading/);
  await assert.rejects(tool('nope'), /Unknown tool/);
});

test('tools: check_item only works on check lines', async () => {
  tmp.reset();
  await tool('create_note', { heading: 'T', lines: [{ type: 'text', text: 'a' }, { type: 'check', text: 'b', checked: false }] });
  await assert.rejects(tool('check_item', { noteId: 'n_1', lineIndex: 0, checked: true }), /not a checklist/);
  assert.equal((await tool('check_item', { noteId: 'n_1', lineIndex: 1, checked: true })).line.checked, true);
});

test('tools: groups, connections and cascade deletes', async () => {
  tmp.reset();
  await tool('create_note', { heading: 'A' });
  await tool('create_note', { heading: 'B' });
  assert.equal((await tool('create_group', { name: 'G' })).group.id, 'g_1');
  await tool('add_note_to_group', { noteId: 'n_1', groupId: 'g_1' });
  assert.equal((await tool('list_groups'))[0].noteCount, 1);
  const c = await tool('create_connection', { fromNote: 'n_1', fromSide: 'right', toNote: 'n_2', toSide: 'left' });
  assert.equal(c.connection.id, 'c_1');
  await assert.rejects(tool('create_connection', { fromNote: 'n_1', fromSide: 'right', toNote: 'nope', toSide: 'left' }), /Target note not found/);
  await tool('delete_note', { noteId: 'n_2' });
  assert.equal((await tool('list_connections')).length, 0);
  await tool('delete_group', { groupId: 'g_1' });
  assert.equal((await tool('get_note', { noteId: 'n_1' })).groupId, null);
});

test('tools: workspaces and cross-workspace search', async () => {
  tmp.reset();
  assert.equal((await tool('create_workspace', { name: 'Two' })).workspace.id, 'ws_2');
  await tool('rename_workspace', { workspaceId: 'ws_2', name: 'Deux' });
  assert.equal((await tool('list_workspaces')).find((x: any) => x.id === 'ws_2').name, 'Deux');
  await tool('create_note', { heading: 'Alpha', body: 'needle' });
  await tool('create_note', { workspaceId: 'ws_2', heading: 'Beta', labels: ['NEEDLE'] });
  const r = await tool('search', { query: 'Needle' });
  assert.deepEqual(r.map((x: any) => x.workspaceId).sort(), ['ws_1', 'ws_2']);
  assert.deepEqual(Object.keys(r[0]).sort(), ['heading', 'labels', 'noteId', 'preview', 'workspaceId', 'workspaceName']);
  assert.deepEqual(await tool('delete_workspace', { workspaceId: 'ws_2' }), { ok: true, deleted: 'Deux' });
  await assert.rejects(tool('delete_workspace', { workspaceId: 'ws_1' }), /last workspace/);
});

// ── REST ─────────────────────────────────────────────────────

test('api: workspace + note CRUD', async () => {
  tmp.reset();
  let r = await api('POST', '/workspaces', { name: ' Hello ' });
  assert.deepEqual([r.status, r.body.id, r.body.name], [201, 'ws_2', 'Hello']);

  r = await api('POST', '/workspaces/ws_1/notes', { heading: 'N', x: 5 });
  assert.deepEqual([r.status, r.body.id, r.body.x, r.body.w], [201, 'n_1', 5, 300]);

  r = await api('PATCH', '/workspaces/ws_1/notes/n_1', { heading: 'N2', bogus: 1 });
  assert.equal(r.body.heading, 'N2');
  assert.equal('bogus' in r.body, false);

  assert.equal((await api('GET', '/workspaces/ws_1/notes?search=n2')).body.length, 1);
  assert.deepEqual((await api('DELETE', '/workspaces/ws_1/notes/n_1')).body, { ok: true });
  assert.equal((await api('GET', '/workspaces/ws_1/notes/n_1')).status, 404);
  assert.equal((await api('GET', '/workspaces/ws_404')).status, 404);
});

test('api: list workspaces and activate', async () => {
  tmp.reset();
  await api('POST', '/workspaces', { name: 'Two' });
  const r = await api('GET', '/workspaces');
  assert.equal(r.body.currentWorkspaceId, 'ws_1');
  assert.deepEqual(Object.keys(r.body.workspaces[0]).sort(), ['groupCount', 'id', 'isCurrent', 'name', 'noteCount']);
  assert.deepEqual((await api('POST', '/workspaces/ws_2/activate')).body, { currentWorkspaceId: 'ws_2' });
});

test('api: PUT /board accepts arrays (browser) and stores maps', async () => {
  tmp.reset();
  const r = await api('PUT', '/workspaces/ws_1/board', {
    notes: [{ id: 'n_1', heading: 'x', lines: [], labels: [] }],
    connections: [], groups: [], nextNoteId: 2, boardZoom: 1.5,
  });
  assert.deepEqual(r.body, { ok: true });
  const ws = (await api('GET', '/workspaces/ws_1')).body;
  assert.deepEqual([Object.keys(ws.notes), ws.nextNoteId, ws.boardZoom], [['n_1'], 2, 1.5]);
  assert.equal((await api('PUT', '/workspaces/ws_1/board', { boardZoom: 'big' })).status, 400);
});

test('api FIX (issue D): a stale counter in PUT /board no longer causes id reuse', async () => {
  tmp.reset();
  await tool('create_note', { heading: 'A' });
  await api('PUT', '/workspaces/ws_1/board', { nextNoteId: 1 });
  assert.equal((await api('POST', '/workspaces/ws_1/notes', { heading: 'B' })).body.id, 'n_2');
});

test('api FIX (issue E): connections validate input AND that both notes exist', async () => {
  tmp.reset();
  assert.equal((await api('POST', '/workspaces/ws_1/connections', { fromNote: 'a' })).status, 400);
  assert.equal((await api('POST', '/workspaces/ws_1/connections', { fromNote: 'a', fromSide: 'top', toNote: 'b', toSide: 'top' })).status, 404);
  await tool('create_note', { heading: 'A' });
  await tool('create_note', { heading: 'B' });
  const r = await api('POST', '/workspaces/ws_1/connections', { fromNote: 'n_1', fromSide: 'top', toNote: 'n_2', toSide: 'top' });
  assert.deepEqual([r.status, r.body.id], [201, 'c_1']);
  assert.deepEqual((await api('DELETE', '/workspaces/ws_1/connections/c_1')).body, { ok: true });
});

test('api: groups CRUD', async () => {
  tmp.reset();
  const g = await api('POST', '/workspaces/ws_1/groups', { name: 'G' });
  assert.deepEqual([g.status, g.body.id, g.body.w], [201, 'g_1', 460]);
  assert.equal((await api('PATCH', '/workspaces/ws_1/groups/g_1', { minimized: true })).body.minimized, true);
  assert.deepEqual((await api('DELETE', '/workspaces/ws_1/groups/g_1')).body, { ok: true });
  assert.equal((await api('GET', '/workspaces/ws_1/groups')).body.length, 0);
});

test('api: search requires q; last workspace cannot be deleted', async () => {
  tmp.reset();
  assert.equal((await api('GET', '/search')).status, 400);
  assert.equal((await api('DELETE', '/workspaces/ws_1')).status, 400);
});

test('FIX (issue A): a corrupt data file is reported, never silently reset', async () => {
  tmp.reset();
  fs.mkdirSync(tmp.dir, { recursive: true });
  const file = path.join(tmp.dir, 'data.json');
  fs.writeFileSync(file, '{ not json');
  const r = await api('GET', '/workspaces');
  assert.equal(r.status, 500);
  assert.match(r.body.error, /not valid JSON/);
  await assert.rejects(tool('list_workspaces'), /not valid JSON/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{ not json');
});

test('api: POST /changes applies incremental edits and returns the merged workspace', async () => {
  tmp.reset();
  const mcp = await tool('create_note', { heading: 'added by Claude' }); // the browser has not seen this
  const r = await api('POST', '/workspaces/ws_1/changes', {
    changes: [
      { op: 'createNote', note: { id: 'n_browser', heading: 'mine', x: 5 } },
      { op: 'patchNote', id: 'n_gone', fields: { x: 1 } },
    ],
  });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.ok, r.body.applied, r.body.skipped.length], [true, 1, 1]);
  assert.deepEqual(Object.keys(r.body.workspace.notes).sort(), [mcp.note.id, 'n_browser'].sort()); // nothing erased
  assert.equal((await api('GET', '/workspaces/ws_1/notes/n_browser')).body.x, 5);
});

test('api: POST /changes validates input (400) and unknown workspaces (404)', async () => {
  tmp.reset();
  assert.equal((await api('POST', '/workspaces/ws_1/changes', { changes: [{ op: 'explode' }] })).status, 400);
  assert.equal((await api('POST', '/workspaces/ws_1/changes', {})).status, 400);
  assert.equal((await api('POST', '/workspaces/ws_404/changes', { changes: [] })).status, 404);
});

test('api: GET /export downloads the workspace as a file; POST /workspaces/import creates a new one from it', async () => {
  tmp.reset();
  await tool('create_note', { heading: 'Exported note', x: 42, labels: ['k'] });
  await tool('create_note', { heading: 'Other' });
  await tool('create_connection', { fromNote: 'n_1', fromSide: 'right', toNote: 'n_2', toSide: 'left' });

  const res = await fetch(`${srv.url}/api/workspaces/ws_1/export`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition')!, /^attachment; filename="darknotes-my_workspace-\d{4}-\d{2}-\d{2}\.json"$/);
  assert.match(res.headers.get('content-type')!, /application\/json/);
  const doc = await res.json();
  assert.deepEqual([doc.app, doc.version, doc.name, doc.notes.length, doc.connections.length], ['darknotes', 1, 'My Workspace', 2, 1]);

  const imported = await api('POST', '/workspaces/import', doc);
  assert.equal(imported.status, 201);
  assert.deepEqual(imported.body.imported, { notes: 2, groups: 0, connections: 1 });
  assert.equal(imported.body.workspace.id, 'ws_2');
  const copy = (await api('GET', '/workspaces/ws_2/notes')).body;
  assert.deepEqual(copy.map((n: any) => n.heading).sort(), ['Exported note', 'Other']);
  assert.equal((await api('GET', '/workspaces/ws_1/notes')).body.length, 2); // the original is untouched
});

test('api: export of an unknown workspace is 404; import rejects bad files with 400 and a reason', async () => {
  tmp.reset();
  assert.equal((await fetch(`${srv.url}/api/workspaces/ws_404/export`)).status, 404);
  const bad = await api('POST', '/workspaces/import', { notes: [{ x: 'far' }] });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /notes\[0\]/);
  assert.equal((await api('POST', '/workspaces/import', 'just text')).status, 400);
  assert.equal((await api('GET', '/workspaces')).body.workspaces.length, 1); // nothing was created
});
