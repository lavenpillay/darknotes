// Store tests run against the REAL core service (temp data dir), so they exercise the server's actual
// change-application rules. `claude` below plays another writer (MCP) using the same service the MCP tools call.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as core from '@darknotes/core';
import type { Change } from '@darknotes/core/types';
import type { Api } from './api';
import { createBoardStore, randomId, type StorageLike } from './board-store';

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dn-web-'));
  process.env.DARKNOTES_DATA_DIR = tmp;
});
afterEach(() => {
  delete process.env.DARKNOTES_DATA_DIR;
  fs.rmSync(tmp, { recursive: true, force: true });
});

function fakeApi() {
  const calls: Array<{ id: string; changes: Change[] }> = [];
  const log: string[] = [];
  const state = { failSaves: 0, down: false, hold: null as Promise<void> | null };
  const guard = () => {
    if (state.down) throw new Error('network down');
  };
  const api: Api = {
    async listWorkspaces() {
      guard();
      const { workspaces, currentWorkspaceId } = core.listWorkspaces();
      return { workspaces, currentWorkspaceId };
    },
    async getWorkspace(id) {
      guard();
      const ws = core.getWorkspaceById(id);
      if (state.hold) await state.hold; // lets a test make this response arrive late
      return ws;
    },
    async createWorkspace(name) {
      guard();
      return core.createWorkspace(name);
    },
    async renameWorkspace(id, name) {
      guard();
      return core.renameWorkspace(id, name);
    },
    async deleteWorkspace(id) {
      guard();
      core.deleteWorkspace(id);
    },
    async activateWorkspace(id) {
      core.activateWorkspace(id);
      log.push(`activate ${id}`);
    },
    async exportWorkspace(id) {
      guard();
      log.push(`export ${id}`);
      return JSON.stringify(core.exportWorkspace(id));
    },
    async importWorkspace(payload) {
      guard();
      log.push('import');
      return core.importWorkspace(payload);
    },
    async applyChanges(id, changes) {
      guard();
      if (state.failSaves > 0) {
        state.failSaves--;
        throw new Error('boom');
      }
      calls.push({ id, changes });
      return core.applyChanges(id, { changes });
    },
  };
  return { api, calls, log, state };
}

let k = 0;
const idGen = (p: string) => `${p}_t${++k}`;
const make = (extra: Partial<Parameters<typeof createBoardStore>[0]> = {}) => {
  const f = fakeApi();
  const store = createBoardStore({ api: f.api, idGen, ...extra });
  return { f, store, s: () => store.getState() };
};
const memoryStorage = (): StorageLike => {
  const data = new Map<string, string>();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, v) => void data.set(key, v) };
};
const serverNotes = () => core.getWorkspaceById('ws_1').notes;
const claude = core; // another writer

test('init loads the current workspace from the server', async () => {
  const { s } = make();
  await s().init();
  assert.equal(s().phase, 'ready');
  assert.equal(s().currentWsId, 'ws_1');
  assert.equal(s().save, 'saved');
});

test('edits apply at once and are coalesced into ONE debounced save with only the changes', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { f, s } = make({ saveDelayMs: 600 });
  await s().init();

  const id = s().addNote({ heading: 'A', x: 5 })!;
  s().updateNote(id, { heading: 'B' });
  s().setView({ offsetX: -10, offsetY: 4, zoom: 1.5 });
  assert.equal(s().save, 'dirty');
  assert.equal(s().ws!.notes[id]!.heading, 'B');
  assert.equal(f.calls.length, 0);

  t.mock.timers.tick(599);
  assert.equal(f.calls.length, 0);
  t.mock.timers.tick(1);
  await s().flush();

  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.calls[0]!.changes.map((c) => c.op), ['createNote', 'setView']);
  assert.equal(serverNotes()[id]!.heading, 'B');
  assert.equal(core.getWorkspaceById('ws_1').boardZoom, 1.5);
  assert.equal(s().save, 'saved');

  // a second flush with nothing new sends nothing
  await s().flush();
  assert.equal(f.calls.length, 1);
});

test('only the changed fields are sent: a later edit patches, it does not resend the note', async () => {
  const { f, s } = make();
  await s().init();
  const id = s().addNote({ heading: 'A' })!;
  await s().flush();
  s().updateNote(id, { x: 42 });
  await s().flush();
  assert.deepEqual(f.calls[1]!.changes, [{ op: 'patchNote', id, fields: { x: 42 } }]);
});

test('THE BUG FIX: a note Claude adds while the tab is open is NOT erased by the next browser save, and appears', async () => {
  const { s } = make();
  await s().init();
  const mine = s().addNote({ heading: 'mine' })!;

  const theirs = claude.createNote(undefined, { heading: 'added by Claude over MCP' }); // browser has not seen it
  await s().flush(); // the user's next edit is saved

  assert.deepEqual(Object.keys(serverNotes()).sort(), [mine, theirs.id].sort()); // nothing erased on the server
  assert.equal(s().ws!.notes[theirs.id]!.heading, 'added by Claude over MCP'); // and it shows up here
});

test('Claude deleting or editing notes is honoured too; our untouched view follows', async () => {
  const { s } = make();
  const a = claude.createNote(undefined, { heading: 'a' });
  const b = claude.createNote(undefined, { heading: 'b' });
  await s().init();

  claude.deleteNote(undefined, b.id);
  claude.updateNote(undefined, a.id, { heading: 'a (edited by Claude)' });
  await s().refresh();
  assert.deepEqual(Object.keys(s().ws!.notes), [a.id]);
  assert.equal(s().ws!.notes[a.id]!.heading, 'a (edited by Claude)');
  assert.equal(s().save, 'saved');
});

test('refresh merges field by field with unsaved local edits (we move a note while Claude renames it)', async () => {
  const { s } = make();
  const a = claude.createNote(undefined, { heading: 'orig', x: 0 });
  await s().init();

  s().updateNote(a.id, { x: 99 }); // unsaved local edit
  claude.updateNote(undefined, a.id, { heading: 'renamed by Claude' });
  await s().refresh();
  const n = s().ws!.notes[a.id]!;
  assert.deepEqual([n.x, n.heading], [99, 'renamed by Claude']);
  assert.equal(s().save, 'dirty'); // our move is still to be saved

  await s().flush();
  const saved = serverNotes()[a.id]!;
  assert.deepEqual([saved.x, saved.heading], [99, 'renamed by Claude']); // both survive on the server
});

test('a stale poll response that arrives after a save is discarded (no regression)', async () => {
  const { f, s } = make();
  await s().init();
  const id = s().addNote({ heading: 'v1' })!;
  await s().flush();

  let release!: () => void;
  f.state.hold = new Promise<void>((r) => (release = r));
  const staleRefresh = s().refresh(); // fetched the server copy, but its response is held back

  s().updateNote(id, { heading: 'v2' });
  f.state.hold = null;
  await s().flush(); // v2 saved while the old poll is still in flight
  release();
  await staleRefresh;

  assert.equal(s().ws!.notes[id]!.heading, 'v2');
  assert.equal(serverNotes()[id]!.heading, 'v2');
});

test('ids are generated here and never collide with ids Claude creates (n_1, n_2, ...)', async () => {
  const { s } = make({ idGen: randomId });
  await s().init();
  const mine = s().addNote()!;
  assert.match(mine, /^n_[0-9a-z]{7}$/);
  const theirs = claude.createNote(undefined, { heading: 'x' });
  assert.notEqual(mine, theirs.id);
  assert.notEqual(randomId('n'), randomId('n'));
});

test('delete removes connections to the note; the server gets the deletes', async () => {
  const { f, s } = make();
  await s().init();
  const a = s().addNote()!;
  const b = s().addNote()!;
  s().addConnection({ fromNote: a, fromSide: 'right', toNote: b, toSide: 'left' });
  await s().flush();
  assert.equal(Object.keys(core.getWorkspaceById('ws_1').connections).length, 1);

  s().deleteNote(b);
  assert.deepEqual(Object.keys(s().ws!.connections), []);
  await s().flush();
  assert.deepEqual(f.calls.at(-1)!.changes.map((c) => c.op), ['deleteConnection', 'deleteNote']);
  assert.deepEqual(Object.keys(serverNotes()), [a]);
  assert.deepEqual(Object.keys(core.getWorkspaceById('ws_1').connections), []);
});

test('a failed save shows an error, keeps the edits, and retries until it works', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { f, s } = make({ saveDelayMs: 100, retryDelayMs: 1000 });
  f.state.failSaves = 1;
  await s().init();
  s().addNote({ heading: 'keep me' });

  t.mock.timers.tick(100);
  await s().flush().catch(() => {});
  assert.equal(s().save, 'error');
  assert.match(s().notice!, /Could not save: boom/);
  assert.equal(f.calls.length, 0);

  t.mock.timers.tick(1000); // retry timer
  await new Promise((r) => setImmediate(r));
  await s().flush();
  assert.equal(f.calls.length, 1);
  assert.equal(s().save, 'saved');
  assert.equal(Object.values(serverNotes())[0]!.heading, 'keep me');
});

test('a retried batch cannot duplicate anything (ops are idempotent)', async () => {
  const { s } = make();
  await s().init();
  const id = s().addNote({ heading: 'once' })!;
  const ws = s().ws!;
  const op: Change = { op: 'createNote', note: { id, heading: 'once' } };
  core.applyChanges(undefined, { changes: [op] }); // first attempt reached the server, reply lost
  assert.ok(ws);
  await s().flush(); // client retries the same create
  assert.equal(Object.keys(serverNotes()).length, 1);
});

test('edits made while a save is in flight are saved afterwards', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { f, s } = make({ saveDelayMs: 100 });
  await s().init();
  const id = s().addNote({ heading: 'one' })!;
  const first = s().flush();
  s().updateNote(id, { heading: 'two' }); // while the first request is pending
  await first;
  assert.equal(s().save, 'dirty');
  assert.equal(s().ws!.notes[id]!.heading, 'two'); // the in-flight reply did not clobber it
  t.mock.timers.tick(100);
  await s().flush();
  assert.equal(f.calls.length, 2);
  assert.equal(serverNotes()[id]!.heading, 'two');
  assert.equal(s().save, 'saved');
});

test('switching workspace saves pending edits first, then loads and activates the other one', async () => {
  const { f, s } = make();
  core.createWorkspace('Two');
  await s().init();
  s().addNote({ heading: 'in one' });
  await s().switchWorkspace('ws_2');
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0]!.id, 'ws_1');
  assert.equal(s().currentWsId, 'ws_2');
  assert.ok(f.log.includes('activate ws_2'));
});

test('create / rename / delete workspace keep the list in sync (rename reaches the server)', async () => {
  const { s } = make();
  await s().init();
  await s().createWorkspace('Three');
  assert.equal(s().ws!.name, 'Three');
  assert.equal(s().workspaces.length, 2);

  await s().renameWorkspace('ws_2', ' Drei ');
  assert.equal(core.getWorkspaceById('ws_2').name, 'Drei');
  assert.equal(s().workspaces.find((w) => w.id === 'ws_2')!.name, 'Drei');

  await s().deleteWorkspace('ws_2');
  assert.equal(s().workspaces.length, 1);
  assert.equal(s().currentWsId, 'ws_1');
});

test('connections: add (dedupe, validation), arrows, delete', async () => {
  const { s } = make();
  await s().init();
  const a = s().addNote()!;
  const b = s().addNote()!;
  const link = { fromNote: a, fromSide: 'right', toNote: b, toSide: 'left' } as const;

  const id = s().addConnection(link)!;
  assert.ok(id);
  assert.equal(s().ws!.connections[id]!.arrows, 'none');
  assert.equal(s().addConnection(link), null); // duplicate
  assert.equal(s().addConnection({ fromNote: b, fromSide: 'left', toNote: a, toSide: 'right' }), null); // reverse duplicate
  assert.equal(s().addConnection({ ...link, toNote: a }), null); // to itself
  assert.equal(s().addConnection({ ...link, toNote: 'n_99' }), null); // missing note

  s().setConnectionArrows(id, 'both');
  await s().flush();
  assert.equal(core.getWorkspaceById('ws_1').connections[id]!.arrows, 'both');

  s().deleteConnection(id);
  await s().flush();
  assert.deepEqual(Object.keys(core.getWorkspaceById('ws_1').connections), []);
});

test('groups: add, update, move with notes, ungroup on delete (all reach the server)', async () => {
  const { s } = make();
  await s().init();
  const g = s().addGroup({ x: 100, y: 100, w: 460, h: 320 })!;
  s().updateGroup(g, { name: 'Ideas', minimized: true });
  const inside = s().addNote({ x: 120, y: 120, w: 200, h: 100 })!;
  const outside = s().addNote({ x: 900, y: 900 })!;
  s().setNoteGroup(inside, g);
  assert.equal(s().ws!.notes[inside]!.x, 120); // already inside: not moved
  s().setNoteGroup(outside, g);
  assert.deepEqual([s().ws!.notes[outside]!.x, s().ws!.notes[outside]!.y], [140, 140]); // moved to the padded top-left

  s().moveGroup(g, { x: 300, y: 250 }, { [inside]: { dx: 20, dy: 20 }, ghost: { dx: 0, dy: 0 } });
  assert.deepEqual([s().ws!.notes[inside]!.x, s().ws!.notes[inside]!.y], [320, 270]);
  s().setNoteGroup(inside, 'g_404'); // unknown group: ignored
  assert.equal(s().ws!.notes[inside]!.groupId, g);

  await s().flush();
  const saved = core.getWorkspaceById('ws_1');
  assert.deepEqual([saved.groups[g]!.name, saved.groups[g]!.minimized, saved.groups[g]!.x], ['Ideas', true, 300]);
  assert.deepEqual([saved.notes[inside]!.groupId, saved.notes[inside]!.x], [g, 320]);

  s().deleteGroup(g);
  await s().flush();
  const after = core.getWorkspaceById('ws_1');
  assert.deepEqual(Object.keys(after.groups), []);
  assert.equal(after.notes[outside]!.groupId, null); // ungrouped, not deleted
});

test('duplicateNote copies content 30px away, ungrouped, with a fresh id', async () => {
  const { s } = make();
  await s().init();
  const id = s().addNote({ heading: 'Plan', x: 100, y: 100, labels: ['a'], lines: [{ type: 'check', text: 'x', checked: true }], groupId: 'g_1' })!;
  const copy = s().duplicateNote(id)!;
  const n = s().ws!.notes[copy]!;
  assert.notEqual(copy, id);
  assert.deepEqual([n.heading, n.x, n.y, n.groupId, n.labels], ['Plan (copy)', 130, 130, null, ['a']]);
  assert.notEqual(n.lines, s().ws!.notes[id]!.lines); // deep copy
  assert.equal(s().duplicateNote('n_404'), null);
});

test('server down at start: falls back to the cached board and sends the unsaved edits when it returns', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const storage = memoryStorage();
  const online = make({ storage });
  await online.s().init();
  online.s().addNote({ heading: 'cached' });
  await online.s().flush();
  online.s().addNote({ heading: 'unsaved edit' }); // never reaches the server
  await online.s().flush().catch(() => {});
  online.f.state.down = true;
  online.s().addNote({ heading: 'made while offline' });
  await online.s().flush();
  assert.equal(online.s().save, 'error');

  const f = fakeApi();
  f.state.down = true;
  const offline = createBoardStore({ api: f.api, storage, idGen, retryDelayMs: 1000 });
  await offline.getState().init();
  assert.equal(offline.getState().phase, 'ready');
  assert.equal(offline.getState().offline, true);
  assert.equal(Object.values(offline.getState().ws!.notes).some((n) => n.heading === 'made while offline'), true);

  f.state.down = false;
  t.mock.timers.tick(1000);
  await new Promise((r) => setImmediate(r));
  await offline.getState().flush();
  assert.equal(offline.getState().offline, false);
  assert.equal(Object.values(serverNotes()).some((n) => n.heading === 'made while offline'), true);
});

test('server down and nothing cached: error phase', async () => {
  const { f, s } = make({ storage: memoryStorage() });
  f.state.down = true;
  await s().init();
  assert.equal(s().phase, 'error');
  assert.match(s().error!, /network down/);
});

test('exportWorkspace saves pending edits first, so the file contains them, and names the file', async () => {
  const { f, s } = make();
  await s().init();
  s().addNote({ heading: 'unsaved when export was clicked' });
  const out = (await s().exportWorkspace())!;
  assert.match(out.filename, /^darknotes-my_workspace-\d{4}-\d{2}-\d{2}\.json$/);
  const doc = JSON.parse(out.json);
  assert.deepEqual([doc.app, doc.name], ['darknotes', 'My Workspace']);
  assert.deepEqual(doc.notes.map((n: any) => n.heading), ['unsaved when export was clicked']);
  assert.equal(f.calls.length, 1); // the edit was saved before exporting
  assert.ok(f.log.includes('export ws_1'));
  assert.match(s().notice!, /Exported "My Workspace"/);
});

test('exportWorkspace reports a server failure instead of throwing', async () => {
  const { f, s } = make();
  await s().init();
  f.state.down = true;
  assert.equal(await s().exportWorkspace(), null);
  assert.match(s().notice!, /Could not export: network down/);
});

test('importWorkspace creates a new workspace, switches to it, updates the list, and leaves the old one alone', async () => {
  const { f, s } = make();
  claude.createNote(undefined, { heading: 'mine', x: 5 });
  await s().init();
  const file = JSON.stringify({ name: 'From file', notes: [{ id: 'a', heading: 'A', x: 1 }, { id: 'b', heading: 'B' }], connections: [{ fromNote: 'a', fromSide: 'right', toNote: 'b', toSide: 'left' }] });

  const result = await s().importWorkspace(file);
  assert.deepEqual(result, { ok: true });
  assert.equal(s().currentWsId, 'ws_2');
  assert.equal(s().ws!.name, 'From file');
  assert.deepEqual(Object.values(s().ws!.notes).map((n) => n.heading), ['A', 'B']);
  assert.equal(Object.keys(s().ws!.connections).length, 1);
  assert.equal(s().workspaces.length, 2);
  assert.equal(s().save, 'saved');
  assert.match(s().notice!, /Imported "From file": 2 notes, 0 groups, 1 connection$/);
  assert.ok(f.log.includes('activate ws_2'));
  assert.deepEqual(Object.values(core.getWorkspaceById('ws_1').notes).map((n) => n.heading), ['mine']);
});

test('importWorkspace says when connections were skipped', async () => {
  const { s } = make();
  await s().init();
  await s().importWorkspace(JSON.stringify({ name: 'Old', notes: [{ heading: 'no id' }], connections: [{ fromNote: 1, fromSide: 'top', toNote: 2, toSide: 'top' }] }));
  assert.match(s().notice!, /1 note, 0 groups, 0 connections \(1 connection skipped/);
});

test('importWorkspace rejects bad files without changing anything and says why', async () => {
  const { f, s } = make();
  await s().init();
  const notJson = await s().importWorkspace('{ nope');
  assert.deepEqual([notJson.ok, (notJson as any).error], [false, 'That is not valid JSON. Choose a file exported from DarkNotes.']);
  const bad = await s().importWorkspace(JSON.stringify({ notes: [{ x: 'far' }] }));
  assert.equal(bad.ok, false);
  assert.match((bad as any).error, /notes\[0\]/);
  assert.equal(s().currentWsId, 'ws_1');
  assert.equal(s().workspaces.length, 1);
  assert.deepEqual(f.log.filter((l) => l === 'import').length, 1); // the invalid JSON never reached the server
});

test('importWorkspace saves pending edits before switching to the imported workspace', async () => {
  const { f, s } = make();
  await s().init();
  s().addNote({ heading: 'pending' });
  await s().importWorkspace(JSON.stringify({ name: 'X', notes: [] }));
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0]!.id, 'ws_1');
  assert.equal(Object.values(core.getWorkspaceById('ws_1').notes)[0]!.heading, 'pending');
});
