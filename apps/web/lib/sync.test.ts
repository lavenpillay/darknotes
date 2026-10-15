import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Connection, Group, Note, Workspace } from '@darknotes/core/types';
import { deepEqual, diffToChanges, mergeWorkspace } from './sync';

const note = (id: string, over: Partial<Note> = {}): Note => ({
  id, heading: id, lines: [{ type: 'text', text: '' }], labels: [], x: 0, y: 0, w: 300, h: 220,
  bgColor: '#fff', fontColor: '#000', fontSize: 14, headingFont: 'Lora', headingSize: 17, groupId: null, zIndex: 10, ...over,
});
const group = (id: string, over: Partial<Group> = {}): Group => ({ id, name: id, x: 0, y: 0, w: 460, h: 320, color: 'c', minimized: false, ...over });
const conn = (id: string, from: string, to: string, over: Partial<Connection> = {}): Connection => ({ id, fromNote: from, fromSide: 'right', toNote: to, toSide: 'left', ...over });
const ws = (
  parts: { notes?: Note[]; groups?: Group[]; connections?: Connection[] } & Omit<Partial<Workspace>, 'notes' | 'groups' | 'connections'> = {},
): Workspace => {
  const { notes = [], groups = [], connections = [], ...rest } = parts;
  return {
    id: 'ws_1', name: 'W', boardOffsetX: 0, boardOffsetY: 0, boardZoom: 1, nextNoteId: 1, nextGroupId: 1, nextConnectionId: 1,
    notes: Object.fromEntries(notes.map((n) => [n.id, n])),
    groups: Object.fromEntries(groups.map((g) => [g.id, g])),
    connections: Object.fromEntries(connections.map((c) => [c.id, c])),
    ...rest,
  };
};

test('deepEqual: structural, order-insensitive for keys, strict for arrays', () => {
  assert.equal(deepEqual({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 }), true);
  assert.equal(deepEqual([1, 2], [2, 1]), false);
  assert.equal(deepEqual({ a: 1 }, { a: 1, b: undefined }), false);
  assert.equal(deepEqual(null, {}), false);
});

test('diffToChanges: nothing changed -> no ops', () => {
  const w = ws({ notes: [note('a')], groups: [group('g')], connections: [conn('c', 'a', 'a')] });
  assert.deepEqual(diffToChanges(w, w), []);
  assert.deepEqual(diffToChanges(w, structuredClone(w)), []);
});

test('diffToChanges: only changed fields are sent, so concurrent edits to other fields cannot be clobbered', () => {
  const base = ws({ notes: [note('a', { heading: 'old' })] });
  const local = ws({ notes: [note('a', { heading: 'old', x: 50, y: 60 })] });
  assert.deepEqual(diffToChanges(base, local), [{ op: 'patchNote', id: 'a', fields: { x: 50, y: 60 } }]);
});

test('diffToChanges: creates, patches and deletes, ordered so references exist when used', () => {
  const base = ws({ notes: [note('old')], groups: [group('gold')], connections: [conn('cold', 'old', 'old')] });
  const local = ws({
    notes: [note('new', { groupId: 'gnew' })],
    groups: [group('gnew')],
    connections: [conn('cnew', 'new', 'new', { arrows: 'end' })],
    boardZoom: 2,
  });
  const ops = diffToChanges(base, local).map((c) => c.op);
  assert.deepEqual(ops, [
    'createGroup', 'createNote', 'createConnection', 'setView', 'deleteConnection', 'deleteNote', 'deleteGroup',
  ]);
  const create = diffToChanges(base, local).find((c) => c.op === 'createNote')!;
  assert.equal((create as any).note.groupId, 'gnew');
});

test('diffToChanges: connection arrows and view changes', () => {
  const base = ws({ connections: [conn('c', 'a', 'b')], notes: [note('a'), note('b')] });
  const local = ws({ connections: [conn('c', 'a', 'b', { arrows: 'both' })], notes: [note('a'), note('b')], boardOffsetX: -5 });
  assert.deepEqual(diffToChanges(base, local), [
    { op: 'patchConnection', id: 'c', fields: { arrows: 'both' } },
    { op: 'setView', fields: { boardOffsetX: -5 } },
  ]);
  // absent arrows and 'none' are the same thing
  assert.deepEqual(diffToChanges(base, ws({ connections: [conn('c', 'a', 'b', { arrows: 'none' })], notes: [note('a'), note('b')] })), []);
});

test('merge: a note Claude added on the server appears; our own edit survives', () => {
  const base = ws({ notes: [note('a')] });
  const local = ws({ notes: [note('a', { x: 77 })] }); // we moved a
  const server = ws({ notes: [note('a'), note('claude', { heading: 'from MCP' })] });
  const m = mergeWorkspace(base, local, server);
  assert.deepEqual(Object.keys(m.notes).sort(), ['a', 'claude']);
  assert.equal(m.notes.a!.x, 77);
  assert.equal(m.notes.claude!.heading, 'from MCP');
});

test('merge: field-level, so we move a note while Claude renames it and both stick', () => {
  const base = ws({ notes: [note('a', { heading: 'orig', x: 0 })] });
  const local = ws({ notes: [note('a', { heading: 'orig', x: 99 })] });
  const server = ws({ notes: [note('a', { heading: 'renamed by Claude', x: 0 })] });
  const n = mergeWorkspace(base, local, server).notes.a!;
  assert.deepEqual([n.heading, n.x], ['renamed by Claude', 99]);
});

test('merge: same field edited on both sides -> our local value wins until it is saved', () => {
  const base = ws({ notes: [note('a', { heading: 'orig' })] });
  const local = ws({ notes: [note('a', { heading: 'mine' })] });
  const server = ws({ notes: [note('a', { heading: 'theirs' })] });
  assert.equal(mergeWorkspace(base, local, server).notes.a!.heading, 'mine');
});

test('merge: untouched entities take the server value (Claude appended a line)', () => {
  const base = ws({ notes: [note('a')] });
  const server = ws({ notes: [note('a', { lines: [{ type: 'text', text: 'appended' }] })] });
  assert.equal(mergeWorkspace(base, base, server).notes.a!.lines[0]!.text, 'appended');
});

test('merge: deletions. Server deleted -> gone here; we deleted (pending) -> stays gone; delete beats edit', () => {
  const base = ws({ notes: [note('a'), note('b'), note('c')] });
  const local = ws({ notes: [note('a'), note('c', { x: 5 })] }); // we deleted b, edited c
  const server = ws({ notes: [note('a'), note('b'), /* c deleted by Claude */] });
  const m = mergeWorkspace(base, local, server);
  assert.deepEqual(Object.keys(m.notes), ['a']); // b: our pending delete; c: server delete beats our edit
});

test('merge: locally created entities that the server has not seen are kept', () => {
  const base = ws();
  const local = ws({ notes: [note('mine')], groups: [group('gmine')] });
  const m = mergeWorkspace(base, local, ws({ notes: [note('theirs')] }));
  assert.deepEqual(Object.keys(m.notes).sort(), ['mine', 'theirs']);
  assert.deepEqual(Object.keys(m.groups), ['gmine']);
});

test('merge: dangling references are repaired (group deleted elsewhere, note deleted elsewhere)', () => {
  const base = ws({ notes: [note('a', { groupId: 'g' }), note('b')], groups: [group('g')], connections: [conn('c', 'a', 'b')] });
  const server = ws({ notes: [note('a', { groupId: 'g' })], groups: [] , connections: [conn('c', 'a', 'b')] }); // g and b gone
  const m = mergeWorkspace(base, base, server);
  assert.equal(m.notes.a!.groupId, null);
  assert.deepEqual(Object.keys(m.connections), []);
});

test('merge: view fields are three-way; name comes from the server', () => {
  const base = ws({ boardZoom: 1, boardOffsetX: 0 });
  const local = ws({ boardZoom: 2, boardOffsetX: 0 }); // we zoomed
  const server = ws({ boardZoom: 1, boardOffsetX: -40, name: 'Renamed' }); // another tab panned; Claude renamed
  const m = mergeWorkspace(base, local, server);
  assert.deepEqual([m.boardZoom, m.boardOffsetX, m.name], [2, -40, 'Renamed']);
});

test('merge returns the very same objects when nothing changed (keeps React memo effective)', () => {
  const base = ws({ notes: [note('a'), note('b')], groups: [group('g')], connections: [conn('c', 'a', 'b')] });
  const local = structuredClone(base);
  const m = mergeWorkspace(base, local, structuredClone(base));
  assert.equal(m, local);
  // and unchanged notes keep identity when only one note changed on the server
  const server = structuredClone(base);
  server.notes.b = { ...server.notes.b!, heading: 'changed' };
  const m2 = mergeWorkspace(base, local, server);
  assert.equal(m2.notes.a, local.notes.a);
  assert.notEqual(m2.notes.b, local.notes.b);
});
