import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { Workspace } from '@darknotes/core/types';
import type { Api, BoardPayload, WorkspaceSummary } from './api';
import { createBoardStore, type StorageLike } from './board-store';

const ws = (id: string, name = id): Workspace => ({
  id,
  name,
  notes: {},
  groups: {},
  connections: {},
  boardOffsetX: 0,
  boardOffsetY: 0,
  boardZoom: 1,
  nextNoteId: 1,
  nextGroupId: 1,
  nextConnectionId: 1,
});

function fakeApi(initial: Workspace[] = [ws('ws_1', 'One'), ws('ws_2', 'Two')]) {
  const db = new Map(initial.map((w) => [w.id, structuredClone(w)]));
  let current = initial[0]!.id;
  const saves: Array<{ id: string; board: BoardPayload }> = [];
  const calls: string[] = [];
  const state = { failSaves: 0, down: false };
  const summaries = (): WorkspaceSummary[] =>
    [...db.values()].map((w) => ({ id: w.id, name: w.name, noteCount: Object.keys(w.notes).length, groupCount: 0 }));
  const guard = () => {
    if (state.down) throw new Error('network down');
  };
  const api: Api = {
    async listWorkspaces() {
      guard();
      return { workspaces: summaries(), currentWorkspaceId: current };
    },
    async getWorkspace(id) {
      guard();
      calls.push(`get ${id}`);
      const w = db.get(id);
      if (!w) throw new Error('Workspace not found');
      return structuredClone(w);
    },
    async createWorkspace(name) {
      guard();
      const w = ws(`ws_${db.size + 1}`, name);
      db.set(w.id, w);
      return structuredClone(w);
    },
    async renameWorkspace(id, name) {
      guard();
      const w = db.get(id)!;
      w.name = name;
      return structuredClone(w);
    },
    async deleteWorkspace(id) {
      guard();
      db.delete(id);
      if (current === id) current = [...db.keys()][0]!;
    },
    async activateWorkspace(id) {
      current = id;
      calls.push(`activate ${id}`);
    },
    async saveBoard(id, board) {
      guard();
      if (state.failSaves > 0) {
        state.failSaves--;
        throw new Error('boom');
      }
      saves.push({ id, board: structuredClone(board) });
      Object.assign(db.get(id)!, structuredClone(board));
    },
  };
  return { api, db, saves, calls, state };
}

const memoryStorage = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

test('init loads the current workspace from the server', async () => {
  const f = fakeApi();
  const store = createBoardStore({ api: f.api });
  await store.getState().init();
  const s = store.getState();
  assert.equal(s.phase, 'ready');
  assert.equal(s.currentWsId, 'ws_1');
  assert.equal(s.workspaces.length, 2);
  assert.equal(s.save, 'saved');
});

test('edits are applied at once and coalesced into a single debounced save', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fakeApi();
  const store = createBoardStore({ api: f.api, saveDelayMs: 600 });
  await store.getState().init();

  const id = store.getState().addNote({ heading: 'A', x: 5 })!;
  store.getState().updateNote(id, { heading: 'B' });
  store.getState().setView({ offsetX: -10, offsetY: 4, zoom: 1.5 });
  assert.equal(store.getState().save, 'dirty');
  assert.equal(store.getState().ws!.notes[id]!.heading, 'B');
  assert.equal(f.saves.length, 0);

  t.mock.timers.tick(599);
  assert.equal(f.saves.length, 0);
  t.mock.timers.tick(1);
  await store.getState().flush();

  assert.equal(f.saves.length, 1);
  const { board } = f.saves[0]!;
  assert.equal(board.notes[id]!.heading, 'B');
  assert.equal(board.nextNoteId, 2);
  assert.deepEqual([board.boardOffsetX, board.boardZoom], [-10, 1.5]);
  assert.equal(store.getState().save, 'saved');
});

test('note ids come from the workspace counter; delete removes connections to the note', async () => {
  const f = fakeApi();
  const store = createBoardStore({ api: f.api });
  await store.getState().init();
  const a = store.getState().addNote()!;
  const b = store.getState().addNote()!;
  assert.deepEqual([a, b], ['n_1', 'n_2']);
  assert.ok(store.getState().ws!.notes.n_2!.zIndex > store.getState().ws!.notes.n_1!.zIndex);

  store.setState((s) => ({
    ws: { ...s.ws!, connections: { c_1: { id: 'c_1', fromNote: a, fromSide: 'right', toNote: b, toSide: 'left' } } },
  }));
  store.getState().deleteNote(b);
  assert.deepEqual(Object.keys(store.getState().ws!.notes), ['n_1']);
  assert.deepEqual(Object.keys(store.getState().ws!.connections), []);
});

test('a failed save shows an error, keeps the edits, and retries until it works', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fakeApi();
  f.state.failSaves = 1;
  const store = createBoardStore({ api: f.api, saveDelayMs: 100, retryDelayMs: 1000 });
  await store.getState().init();
  store.getState().addNote({ heading: 'keep me' });

  t.mock.timers.tick(100);
  await store.getState().flush().catch(() => {});
  assert.equal(store.getState().save, 'error');
  assert.match(store.getState().notice!, /Could not save: boom/);
  assert.equal(f.saves.length, 0);

  t.mock.timers.tick(1000); // retry timer
  await new Promise((r) => setImmediate(r));
  await store.getState().flush();
  assert.equal(f.saves.length, 1);
  assert.equal(store.getState().save, 'saved');
  assert.equal(Object.values(f.saves[0]!.board.notes)[0]!.heading, 'keep me');
});

test('edits made while a save is in flight are saved afterwards', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fakeApi();
  const store = createBoardStore({ api: f.api, saveDelayMs: 100 });
  await store.getState().init();
  const id = store.getState().addNote({ heading: 'one' })!;
  const first = store.getState().flush();
  store.getState().updateNote(id, { heading: 'two' }); // while the first PUT is pending
  await first;
  assert.equal(store.getState().save, 'dirty');
  t.mock.timers.tick(100);
  await store.getState().flush();
  assert.equal(f.saves.length, 2);
  assert.equal(f.saves[1]!.board.notes[id]!.heading, 'two');
  assert.equal(store.getState().save, 'saved');
});

test('switching workspace saves pending edits first, then loads and activates the other one', async () => {
  const f = fakeApi();
  const store = createBoardStore({ api: f.api });
  await store.getState().init();
  store.getState().addNote({ heading: 'in one' });
  await store.getState().switchWorkspace('ws_2');
  assert.equal(f.saves.length, 1);
  assert.equal(f.saves[0]!.id, 'ws_1');
  assert.equal(store.getState().currentWsId, 'ws_2');
  assert.ok(f.calls.includes('activate ws_2'));
});

test('create / rename / delete workspace keep the list in sync (rename reaches the server)', async () => {
  const f = fakeApi();
  const store = createBoardStore({ api: f.api });
  await store.getState().init();

  await store.getState().createWorkspace('Three');
  assert.equal(store.getState().ws!.name, 'Three');
  assert.equal(store.getState().workspaces.length, 3);

  await store.getState().renameWorkspace('ws_3', ' Drei ');
  assert.equal(f.db.get('ws_3')!.name, 'Drei'); // the legacy UI never did this
  assert.equal(store.getState().workspaces.find((w) => w.id === 'ws_3')!.name, 'Drei');
  assert.equal(store.getState().ws!.name, 'Drei');

  await store.getState().deleteWorkspace('ws_3');
  assert.equal(store.getState().workspaces.length, 2);
  assert.equal(store.getState().currentWsId, 'ws_1');
});

test('refresh picks up server-side changes only when nothing is unsaved', async () => {
  const f = fakeApi();
  const store = createBoardStore({ api: f.api });
  await store.getState().init();

  f.db.get('ws_1')!.notes = { n_9: { id: 'n_9', heading: 'from MCP' } as any };
  await store.getState().refresh();
  assert.equal(store.getState().ws!.notes.n_9!.heading, 'from MCP');

  store.getState().addNote({ heading: 'local' });
  f.db.get('ws_1')!.notes = {};
  await store.getState().refresh(); // dirty -> must not clobber local edits
  assert.ok(store.getState().ws!.notes.n_9);
});

test('server down at start: falls back to the cached board and saves it when the server returns', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const storage = memoryStorage();
  const f = fakeApi();
  const online = createBoardStore({ api: f.api, storage });
  await online.getState().init();
  online.getState().addNote({ heading: 'cached' });
  await online.getState().flush();

  f.state.down = true;
  const offline = createBoardStore({ api: f.api, storage, retryDelayMs: 1000 });
  await offline.getState().init();
  assert.equal(offline.getState().phase, 'ready');
  assert.equal(offline.getState().offline, true);
  assert.equal(Object.values(offline.getState().ws!.notes)[0]!.heading, 'cached');

  f.state.down = false;
  f.saves.length = 0;
  t.mock.timers.tick(1000);
  await new Promise((r) => setImmediate(r));
  await offline.getState().flush();
  assert.equal(f.saves.length, 1);
  assert.equal(offline.getState().offline, false);
});

test('server down and nothing cached: error phase', async () => {
  const f = fakeApi();
  f.state.down = true;
  const store = createBoardStore({ api: f.api, storage: memoryStorage() });
  await store.getState().init();
  assert.equal(store.getState().phase, 'error');
  assert.match(store.getState().error!, /network down/);
});
