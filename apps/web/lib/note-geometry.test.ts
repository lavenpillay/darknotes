import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_H, BOARD_W } from './board-math';
import { MIN_NOTE_H, MIN_NOTE_W, bringToFrontZ, dragPosition, resizeSize } from './note-geometry';

const note = { x: 100, y: 200, w: 300, h: 220 };

test('dragPosition divides the pointer delta by zoom', () => {
  assert.deepEqual(dragPosition(note, { x: 0, y: 0 }, { x: 50, y: -20 }, 1), { x: 150, y: 180 });
  assert.deepEqual(dragPosition(note, { x: 0, y: 0 }, { x: 50, y: -20 }, 2), { x: 125, y: 190 });
});

test('dragPosition keeps the note on the board', () => {
  assert.deepEqual(dragPosition(note, { x: 0, y: 0 }, { x: -9999, y: -9999 }, 1), { x: 0, y: 0 });
  assert.deepEqual(dragPosition(note, { x: 0, y: 0 }, { x: 99999, y: 99999 }, 1), {
    x: BOARD_W - note.w,
    y: BOARD_H - note.h,
  });
});

test('dragPosition rounds to whole pixels', () => {
  const p = dragPosition(note, { x: 0, y: 0 }, { x: 10, y: 10 }, 3);
  assert.deepEqual(p, { x: 103, y: 203 });
});

test('resizeSize: corner changes both, edges change one', () => {
  const at = { x: 0, y: 0 };
  const to = { x: 40, y: 30 };
  assert.deepEqual(resizeSize(note, 'se', at, to, 1), { w: 340, h: 250 });
  assert.deepEqual(resizeSize(note, 'e', at, to, 1), { w: 340, h: 220 });
  assert.deepEqual(resizeSize(note, 's', at, to, 1), { w: 300, h: 250 });
});

test('resizeSize enforces the minimum size (220x140) and the board edge', () => {
  const at = { x: 0, y: 0 };
  assert.deepEqual(resizeSize(note, 'se', at, { x: -999, y: -999 }, 1), { w: MIN_NOTE_W, h: MIN_NOTE_H });
  assert.deepEqual(resizeSize(note, 'se', at, { x: 99999, y: 99999 }, 1), {
    w: BOARD_W - note.x,
    h: BOARD_H - note.y,
  });
});

test('resizeSize respects zoom', () => {
  assert.deepEqual(resizeSize(note, 'se', { x: 0, y: 0 }, { x: 40, y: 40 }, 2), { w: 320, h: 240 });
});

test('bringToFrontZ: raises a covered note, leaves a top note alone', () => {
  const notes = { a: { id: 'a', zIndex: 10 }, b: { id: 'b', zIndex: 12 }, c: { id: 'c', zIndex: 11 } };
  assert.equal(bringToFrontZ(notes, 'a'), 13);
  assert.equal(bringToFrontZ(notes, 'b'), null);
  assert.equal(bringToFrontZ({ a: { id: 'a', zIndex: 5 } }, 'a'), null);
  // equal z-index counts as covered
  assert.equal(bringToFrontZ({ a: { id: 'a', zIndex: 10 }, b: { id: 'b', zIndex: 10 } }, 'a'), 11);
});
