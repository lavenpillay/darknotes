import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Group, Note } from '@darknotes/core/types';
import {
  GROUP_COLORS,
  groupBorderColor,
  hiddenNoteIds,
  isNoteInGroup,
  notesInside,
  pickGroupColor,
  placementInGroup,
} from './group-geometry';

const group = (over: Partial<Group> = {}): Group => ({
  id: 'g_1',
  name: 'G',
  x: 100,
  y: 100,
  w: 460,
  h: 320,
  color: GROUP_COLORS[0]!,
  minimized: false,
  ...over,
});
const note = (id: string, x: number, y: number, over: Partial<Note> = {}): Note =>
  ({ id, x, y, w: 300, h: 220, groupId: null, ...over }) as Note;

test('isNoteInGroup requires the whole note inside (edges inclusive)', () => {
  const g = group();
  assert.equal(isNoteInGroup(note('a', 110, 110, { w: 200, h: 100 }), g), true);
  assert.equal(isNoteInGroup(note('a', 100, 100, { w: 460, h: 320 }), g), true); // exactly fills it
  assert.equal(isNoteInGroup(note('a', 99, 110, { w: 200, h: 100 }), g), false);
  assert.equal(isNoteInGroup(note('a', 110, 110, { w: 460, h: 100 }), g), false); // sticks out right
});

test('notesInside is geometric, independent of groupId', () => {
  const notes = {
    in: note('in', 120, 120, { w: 200, h: 100 }),
    tagged: note('tagged', 900, 900, { groupId: 'g_1' }), // belongs by id but is elsewhere
    out: note('out', 900, 100),
  };
  assert.deepEqual(notesInside(notes, group()).map((n) => n.id), ['in']);
});

test('hiddenNoteIds: only members of minimized groups', () => {
  const notes = {
    a: note('a', 0, 0, { groupId: 'g_1' }),
    b: note('b', 0, 0, { groupId: 'g_2' }),
    c: note('c', 0, 0),
  };
  const groups = { g_1: group({ minimized: true }), g_2: group({ id: 'g_2', minimized: false }) };
  assert.deepEqual([...hiddenNoteIds(notes, groups)], ['a']);
  assert.equal(hiddenNoteIds(notes, { g_1: group() }).size, 0);
  assert.equal(hiddenNoteIds(notes, {}).size, 0);
});

test('placementInGroup leaves an inside note alone, otherwise moves it to the padded top-left', () => {
  const g = group();
  assert.equal(placementInGroup(note('a', 110, 110, { w: 200, h: 100 }), g), null);
  assert.deepEqual(placementInGroup(note('a', 900, 900), g), { x: 140, y: 140 });
  assert.deepEqual(placementInGroup(note('a', 900, 900), g, 10), { x: 110, y: 110 });
});

test('groupBorderColor swaps the alpha for 0.35', () => {
  assert.equal(groupBorderColor('rgba(255,245,180,0.55)'), 'rgba(255,245,180,0.35)');
});

test('pickGroupColor prefers unused colours and falls back to any when all are used', () => {
  const used: Record<string, Group> = {};
  GROUP_COLORS.slice(0, 9).forEach((c, i) => (used[`g_${i}`] = group({ id: `g_${i}`, color: c })));
  assert.equal(pickGroupColor(used, () => 0), GROUP_COLORS[9]);
  GROUP_COLORS.forEach((c, i) => (used[`g_${i}`] = group({ id: `g_${i}`, color: c })));
  assert.ok(GROUP_COLORS.includes(pickGroupColor(used, () => 0.5)));
  assert.equal(pickGroupColor({}, () => 0), GROUP_COLORS[0]);
});
