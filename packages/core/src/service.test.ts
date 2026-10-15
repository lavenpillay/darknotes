import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as svc from './service';
import { ConflictError, NotFoundError, ValidationError } from './errors';

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dn-svc-'));
  process.env.DARKNOTES_DATA_DIR = tmp;
});
afterEach(() => {
  delete process.env.DARKNOTES_DATA_DIR;
  fs.rmSync(tmp, { recursive: true, force: true });
});

// ── notes ────────────────────────────────────────────────────

test('note lifecycle: ids come from workspace counters, body is split into lines', () => {
  const a = svc.createNote(undefined, { heading: 'A', body: 'l1\nl2' });
  const b = svc.createNote(undefined, { heading: 'B', labels: ['x'] });
  assert.deepEqual([a.id, b.id], ['n_1', 'n_2']);
  assert.deepEqual(a.lines, [
    { type: 'text', text: 'l1' },
    { type: 'text', text: 'l2' },
  ]);

  svc.appendToNote(undefined, 'n_1', { body: 'l3' });
  assert.equal(svc.getNote(undefined, 'n_1').lines.length, 3);

  svc.addLabel(undefined, 'n_1', 'x');
  svc.addLabel(undefined, 'n_1', 'x');
  assert.deepEqual(svc.getNote(undefined, 'n_1').labels, ['x']);
  assert.equal(svc.listNotes(undefined, { label: 'x' }).length, 2);
  assert.deepEqual(svc.removeLabel(undefined, 'n_1', 'x'), []);

  assert.deepEqual(svc.deleteNote(undefined, 'n_2'), { heading: 'B' });
  assert.throws(() => svc.getNote(undefined, 'n_2'), NotFoundError);
});

test('FIX (issue E): createNote honours position, size, font and colour options', () => {
  const n = svc.createNote(undefined, { heading: 'P', x: 5, y: 6, w: 7, h: 8, fontColor: '#fff', headingFont: 'Lora' });
  assert.deepEqual([n.x, n.y, n.w, n.h, n.fontColor, n.headingFont], [5, 6, 7, 8, '#fff', 'Lora']);
  const d = svc.createNote(undefined, { heading: 'D' });
  assert.deepEqual([d.x, d.y, d.w, d.h], [100, 100, 300, 220]); // defaults unchanged
});

test('FIX (issue E): updateNote can move/resize and change heading font', () => {
  svc.createNote(undefined, { heading: 'A' });
  const n = svc.updateNote(undefined, 'n_1', { x: 1, y: 2, w: 3, h: 4, headingFont: 'Caveat', heading: 'B' });
  assert.deepEqual([n.x, n.y, n.w, n.h, n.headingFont, n.heading], [1, 2, 3, 4, 'Caveat', 'B']);
});

test('updateNote: unknown keys are ignored, body replaces lines, absent fields untouched', () => {
  svc.createNote(undefined, { heading: 'A', labels: ['k'] });
  const n = svc.updateNote(undefined, 'n_1', { body: 'x\ny', bogus: 1 } as any);
  assert.equal('bogus' in n, false);
  assert.equal(n.lines.length, 2);
  assert.deepEqual(n.labels, ['k']);
});

test('FIX (issue E): labels functions tolerate a note with no labels array', () => {
  svc.createNote(undefined, { heading: 'A' });
  const raw = JSON.parse(fs.readFileSync(path.join(tmp, 'data.json'), 'utf8'));
  delete raw.workspaces.ws_1.notes.n_1.labels;
  fs.writeFileSync(path.join(tmp, 'data.json'), JSON.stringify(raw));
  assert.deepEqual(svc.addLabel(undefined, 'n_1', 'z'), ['z']);
});

test('FIX (issue E): invalid input is rejected with ValidationError', () => {
  assert.throws(() => svc.createNote(undefined, { heading: 5 } as any), ValidationError);
  assert.throws(() => svc.createNote(undefined, { lines: [{ type: 'bad', text: 'x' }] } as any), ValidationError);
  assert.throws(() => svc.updateNote(undefined, 'n_1', { x: 'far' } as any), ValidationError);
  assert.throws(() => svc.createConnection(undefined, { fromNote: 'a' } as any), ValidationError);
});

test('FIX (issue E): a non-existent groupId is rejected on create and update; null ungroups', () => {
  assert.throws(() => svc.createNote(undefined, { heading: 'A', groupId: 'g_9' }), NotFoundError);
  svc.createNote(undefined, { heading: 'A' });
  assert.throws(() => svc.updateNote(undefined, 'n_1', { groupId: 'g_9' }), NotFoundError);
  svc.createGroup(undefined, { name: 'G' });
  assert.equal(svc.updateNote(undefined, 'n_1', { groupId: 'g_1' }).groupId, 'g_1');
  assert.equal(svc.updateNote(undefined, 'n_1', { groupId: null }).groupId, null);
});

test('checkItem only works on check lines', () => {
  svc.createNote(undefined, {
    heading: 'T',
    lines: [
      { type: 'text', text: 'a' },
      { type: 'check', text: 'b', checked: false },
    ],
  });
  assert.throws(() => svc.checkItem(undefined, 'n_1', 0, true), ValidationError);
  assert.throws(() => svc.checkItem(undefined, 'n_1', 9, true), NotFoundError);
  assert.equal(svc.checkItem(undefined, 'n_1', 1, true).checked, true);
});

test('listNotes filters by search (heading/body/label, case-insensitive), label and group', () => {
  svc.createGroup(undefined, { name: 'G' });
  svc.createNote(undefined, { heading: 'Alpha', body: 'needle', groupId: 'g_1' });
  svc.createNote(undefined, { heading: 'Beta', labels: ['NEEDLE'] });
  svc.createNote(undefined, { heading: 'Gamma' });
  assert.equal(svc.listNotes(undefined, { search: 'Needle' }).length, 2);
  assert.equal(svc.listNotes(undefined, { groupId: 'g_1' }).length, 1);
  assert.equal(svc.listNotes(undefined).length, 3);
});

// ── groups & connections ─────────────────────────────────────

test('groups, connections and cascade deletes', () => {
  svc.createNote(undefined, { heading: 'A' });
  svc.createNote(undefined, { heading: 'B' });
  const g = svc.createGroup(undefined, { name: 'G' });
  assert.equal(g.id, 'g_1');
  svc.addNoteToGroup(undefined, 'n_1', 'g_1');
  assert.equal(svc.listGroups()[0]!.noteCount, 1);
  assert.equal(svc.updateGroup(undefined, 'g_1', { name: 'G2', minimized: true }).name, 'G2');

  const c = svc.createConnection(undefined, { fromNote: 'n_1', fromSide: 'right', toNote: 'n_2', toSide: 'left' });
  assert.equal(c.id, 'c_1');
  assert.throws(
    () => svc.createConnection(undefined, { fromNote: 'n_1', fromSide: 'right', toNote: 'nope', toSide: 'left' }),
    /Target note not found/,
  );
  assert.throws(
    () => svc.createConnection(undefined, { fromNote: 'n_1', fromSide: 'middle', toNote: 'n_2', toSide: 'left' } as any),
    ValidationError,
  );
  assert.equal(svc.listConnections()[0]!.fromHeading, 'A');

  svc.deleteNote(undefined, 'n_2');
  assert.equal(svc.listConnections().length, 0);

  svc.deleteGroup(undefined, 'g_1');
  assert.equal(svc.getNote(undefined, 'n_1').groupId, null);
  assert.throws(() => svc.deleteConnection(undefined, 'c_1'), NotFoundError);
});

test('FIX: connections to missing notes are rejected (REST used to accept them)', () => {
  assert.throws(
    () => svc.createConnection(undefined, { fromNote: 'a', fromSide: 'top', toNote: 'b', toSide: 'top' }),
    NotFoundError,
  );
});

// ── workspaces ───────────────────────────────────────────────

test('workspace lifecycle and rules', () => {
  const w = svc.createWorkspace(' Two ');
  assert.deepEqual([w.id, w.name], ['ws_2', 'Two']);
  assert.equal(svc.createWorkspace().name, 'New Workspace');
  svc.renameWorkspace('ws_2', 'Deux');
  svc.updateWorkspace('ws_2', { boardZoom: 2 });
  assert.equal(svc.getWorkspaceById('ws_2').boardZoom, 2);

  svc.activateWorkspace('ws_2');
  assert.equal(svc.listWorkspaces().currentWorkspaceId, 'ws_2');
  svc.deleteWorkspace('ws_2'); // deleting the current workspace moves current
  assert.equal(svc.listWorkspaces().currentWorkspaceId, 'ws_1');

  svc.deleteWorkspace('ws_3');
  assert.throws(() => svc.deleteWorkspace('ws_1'), ConflictError);
  assert.throws(() => svc.deleteWorkspace('ws_404'), NotFoundError);
});

test('operations target a given workspace, default to current', () => {
  svc.createWorkspace('Two');
  svc.createNote('ws_2', { heading: 'in two' });
  assert.equal(svc.listNotes('ws_2').length, 1);
  assert.equal(svc.listNotes().length, 0);
  assert.throws(() => svc.listNotes('ws_404'), NotFoundError);
});

test('saveBoard accepts arrays or maps; FIX (issue D) a stale counter cannot cause id reuse', () => {
  svc.createNote(undefined, { heading: 'A' }); // n_1
  svc.saveBoard('ws_1', { notes: [{ id: 'n_1', heading: 'A' }], nextNoteId: 1, boardZoom: 1.5 });
  const ws = svc.getWorkspaceById('ws_1');
  assert.deepEqual(Object.keys(ws.notes), ['n_1']);
  assert.equal(ws.boardZoom, 1.5);
  assert.equal(svc.createNote(undefined, { heading: 'B' }).id, 'n_2');
  assert.throws(() => svc.saveBoard('ws_1', { boardZoom: 'big' } as any), ValidationError);
});

test('a failed operation does not write', () => {
  svc.createNote(undefined, { heading: 'A' });
  const before = fs.readFileSync(path.join(tmp, 'data.json'), 'utf8');
  assert.throws(() => svc.deleteNote(undefined, 'n_404'));
  assert.equal(fs.readFileSync(path.join(tmp, 'data.json'), 'utf8'), before);
});

// ── search ───────────────────────────────────────────────────

test('searchNotes spans workspaces', () => {
  svc.createWorkspace('Two');
  svc.createNote(undefined, { heading: 'Alpha', body: 'needle' });
  svc.createNote('ws_2', { heading: 'Beta', labels: ['NEEDLE'] });
  assert.deepEqual(svc.searchNotes('Needle').map((h) => h.workspaceId).sort(), ['ws_1', 'ws_2']);
  assert.throws(() => svc.searchNotes(''), ValidationError);
});

test('connections can carry arrows; invalid arrows are rejected; absent stays absent', () => {
  svc.createNote(undefined, { heading: 'A' });
  svc.createNote(undefined, { heading: 'B' });
  const plain = svc.createConnection(undefined, { fromNote: 'n_1', fromSide: 'right', toNote: 'n_2', toSide: 'left' });
  assert.equal('arrows' in plain, false);
  const arrow = svc.createConnection(undefined, { fromNote: 'n_1', fromSide: 'top', toNote: 'n_2', toSide: 'top', arrows: 'end' });
  assert.equal(arrow.arrows, 'end');
  assert.throws(
    () => svc.createConnection(undefined, { fromNote: 'n_1', fromSide: 'top', toNote: 'n_2', toSide: 'top', arrows: 'both-ways' } as any),
    ValidationError,
  );
});
