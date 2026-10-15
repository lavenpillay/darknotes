import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampZoom, screenToBoard, visibleCenter, wheelZoomFactor, zoomAround, MAX_ZOOM, MIN_ZOOM } from './board-math';

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} !== ${b}`);

test('clampZoom bounds and non-finite input', () => {
  assert.equal(clampZoom(10), MAX_ZOOM);
  assert.equal(clampZoom(0), MIN_ZOOM);
  assert.equal(clampZoom(NaN), 1);
  assert.equal(clampZoom(1.5), 1.5);
});

test('screenToBoard inverts translate+scale', () => {
  const p = screenToBoard({ offsetX: 100, offsetY: 50, zoom: 2 }, { x: 300, y: 250 });
  assert.deepEqual(p, { x: 100, y: 100 });
});

test('zoomAround keeps the pivot point fixed on the board', () => {
  const view = { offsetX: -120, offsetY: 40, zoom: 1 };
  const pivot = { x: 400, y: 300 };
  const before = screenToBoard(view, pivot);
  const next = zoomAround(view, 2, pivot);
  assert.equal(next.zoom, 2);
  const after = screenToBoard(next, pivot);
  close(after.x, before.x);
  close(after.y, before.y);
});

test('zoomAround clamps and still keeps the pivot fixed', () => {
  const view = { offsetX: 0, offsetY: 0, zoom: 1 };
  const next = zoomAround(view, 99, { x: 10, y: 20 });
  assert.equal(next.zoom, MAX_ZOOM);
  const b = screenToBoard(next, { x: 10, y: 20 });
  close(b.x, 10);
  close(b.y, 20);
});

test('visibleCenter accounts for pan and zoom', () => {
  assert.deepEqual(visibleCenter({ offsetX: 0, offsetY: 0, zoom: 1 }, 800, 600), { x: 400, y: 300 });
  assert.deepEqual(visibleCenter({ offsetX: -400, offsetY: -300, zoom: 2 }, 800, 600), { x: 400, y: 300 });
});

test('wheelZoomFactor zooms out for positive delta, in for negative', () => {
  assert.ok(wheelZoomFactor(100) < 1);
  assert.ok(wheelZoomFactor(-100) > 1);
  assert.equal(wheelZoomFactor(0), 1);
});
