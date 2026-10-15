import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Connection, Note } from '@darknotes/core/types';
import { bezierPath, connPointPos, findSnap, guessSide, isDuplicateConnection } from './connection-geometry';

const box = { x: 100, y: 200, w: 300, h: 220 };
const note = (id: string, x: number, y: number): Note => ({ id, x, y, w: 300, h: 220 }) as Note;

test('connPointPos: midpoints of each edge', () => {
  assert.deepEqual(connPointPos(box, 'top'), { x: 250, y: 200 });
  assert.deepEqual(connPointPos(box, 'right'), { x: 400, y: 310 });
  assert.deepEqual(connPointPos(box, 'bottom'), { x: 250, y: 420 });
  assert.deepEqual(connPointPos(box, 'left'), { x: 100, y: 310 });
});

test('bezierPath: control points leave and arrive along the side normals (legacy formula)', () => {
  // distance 300 -> d = max(60, 135) = 135
  assert.equal(bezierPath({ x: 0, y: 0 }, 'right', { x: 300, y: 0 }, 'left'), 'M 0 0 C 135 0, 165 0, 300 0');
  // short distance clamps the handle length to 60
  assert.equal(bezierPath({ x: 0, y: 0 }, 'bottom', { x: 0, y: 10 }, 'top'), 'M 0 0 C 0 60, 0 -50, 0 10');
});

test('guessSide picks the side facing the start', () => {
  const o = { x: 0, y: 0 };
  assert.equal(guessSide(o, { x: 100, y: 10 }), 'left');
  assert.equal(guessSide(o, { x: -100, y: 10 }), 'right');
  assert.equal(guessSide(o, { x: 10, y: 100 }), 'top');
  assert.equal(guessSide(o, { x: 10, y: -100 }), 'bottom');
});

test('findSnap: nearest dot within the radius, never the source note', () => {
  const notes = { a: note('a', 0, 0), b: note('b', 500, 0) };
  // b's left dot is at (500, 110)
  assert.deepEqual(findSnap(notes, 'a', { x: 510, y: 120 }), { noteId: 'b', side: 'left', point: { x: 500, y: 110 } });
  assert.equal(findSnap(notes, 'a', { x: 700, y: 700 }), null);
  assert.equal(findSnap(notes, 'b', { x: 300, y: 110 })?.noteId, 'a'); // a's right dot, excluding b
  assert.equal(findSnap({ a: notes.a }, 'a', { x: 300, y: 110 }), null);
});

test('findSnap radius is exclusive and configurable', () => {
  const notes = { b: note('b', 500, 0) };
  assert.equal(findSnap(notes, 'a', { x: 470, y: 110 })?.noteId, undefined); // exactly 30 away
  assert.equal(findSnap(notes, 'a', { x: 471, y: 110 })?.noteId, 'b');
  assert.equal(findSnap(notes, 'a', { x: 471, y: 110 }, 5), null);
});

test('isDuplicateConnection treats the reverse direction as the same connection', () => {
  const conns: Record<string, Connection> = {
    c_1: { id: 'c_1', fromNote: 'a', fromSide: 'right', toNote: 'b', toSide: 'left' },
  };
  assert.equal(isDuplicateConnection(conns, { fromNote: 'a', fromSide: 'right', toNote: 'b', toSide: 'left' }), true);
  assert.equal(isDuplicateConnection(conns, { fromNote: 'b', fromSide: 'left', toNote: 'a', toSide: 'right' }), true);
  assert.equal(isDuplicateConnection(conns, { fromNote: 'a', fromSide: 'top', toNote: 'b', toSide: 'left' }), false);
});
