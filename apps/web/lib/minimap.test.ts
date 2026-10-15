import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Connection, Group, Note } from '@darknotes/core/types';
import { BOARD_H, BOARD_W } from './board-math';
import type { StorageLike } from './board-store';
import { drawMinimap } from './minimap-draw';
import {
  MAP_ASPECT, MAP_DEFAULT_W, MAP_MAX_W, MAP_MIN_W, clampMapWidth, insideRect, mapSize, mapToBoard, resizedWidth,
  viewForCenter, viewForDrag, viewportOnMap, viewportRect,
} from './minimap-geometry';
import { createMinimapPrefs } from './minimap-prefs';

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);
const view = { offsetX: -400, offsetY: -200, zoom: 2 };

test('map keeps the board aspect ratio', () => {
  assert.equal(MAP_ASPECT, 0.75);
  assert.deepEqual(mapSize(240), { w: 240, h: 180 });
});

test('clampMapWidth: min, max, available space, junk', () => {
  assert.equal(clampMapWidth(50), MAP_MIN_W);
  assert.equal(clampMapWidth(9999), MAP_MAX_W);
  assert.equal(clampMapWidth(400, 300), 300);
  assert.equal(clampMapWidth(400, 50), MAP_MIN_W); // a tiny container never goes below the minimum
  assert.equal(clampMapWidth(NaN), MAP_DEFAULT_W);
  assert.equal(clampMapWidth(240.4), 240);
});

test('resizedWidth: dragging up-left grows, down-right shrinks, bounded', () => {
  assert.equal(resizedWidth(240, -40, 0), 260); // left 40 -> grow by 20 (averaged with a zero dy)
  assert.equal(resizedWidth(240, -40, -30), 280); // diagonal: (40 + 40)/2 = 40
  assert.equal(resizedWidth(240, 40, 30), 200);
  assert.equal(resizedWidth(240, 999, 999), MAP_MIN_W);
  assert.equal(resizedWidth(240, -999, -999), MAP_MAX_W);
  assert.equal(resizedWidth(240, -999, -999, 300), 300);
});

test('viewportRect: visible board area from pan and zoom', () => {
  assert.deepEqual(viewportRect(view, 1000, 600), { x: 200, y: 100, w: 500, h: 300 });
  assert.deepEqual(viewportRect({ offsetX: 0, offsetY: 0, zoom: 1 }, 800, 600), { x: 0, y: 0, w: 800, h: 600 });
});

test('mapToBoard scales up and keeps the point on the board', () => {
  assert.deepEqual(mapToBoard({ x: 60, y: 45 }, 240), { x: 1000, y: 750 }); // scale = 240/4000 = 0.06
  assert.deepEqual(mapToBoard({ x: -50, y: 9999 }, 240), { x: 0, y: BOARD_H });
});

test('viewForCenter puts the board point in the middle of the screen', () => {
  const v = viewForCenter({ x: 1000, y: 750 }, 2, 1000, 600);
  const r = viewportRect(v, 1000, 600);
  near(r.x + r.w / 2, 1000);
  near(r.y + r.h / 2, 750);
  assert.equal(v.zoom, 2);
});

test('viewForDrag: dragging the box right/down pans toward the right/down of the board', () => {
  const s = 0.06;
  const v = viewForDrag(view, { x: 30, y: 12 }, 240);
  const before = viewportRect(view, 1000, 600);
  const after = viewportRect(v, 1000, 600);
  near(after.x - before.x, 30 / s);
  near(after.y - before.y, 12 / s);
  assert.deepEqual(viewForDrag(view, { x: 0, y: 0 }, 240), view);
});

test('viewportOnMap is clipped to the map; insideRect includes edges', () => {
  const r = viewportOnMap({ offsetX: 500, offsetY: 500, zoom: 1 }, 800, 600, 240); // box starts left/above the board
  assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 240 && r.y + r.h <= 180);
  const box = { x: 10, y: 10, w: 20, h: 20 };
  assert.equal(insideRect({ x: 10, y: 30 }, box), true);
  assert.equal(insideRect({ x: 31, y: 20 }, box), false);
});

// ── drawing, with a stub context that records what was painted ──

function stubCtx() {
  const calls: Array<{ fn: string; args: unknown[]; fill?: unknown }> = [];
  let fillStyle: unknown;
  const ctx: any = new Proxy(
    {},
    {
      get: (_t, prop: string) => {
        if (prop === 'fillStyle') return fillStyle;
        return (...args: unknown[]) => void calls.push({ fn: prop, args, fill: fillStyle });
      },
      set: (_t, prop: string, value) => {
        if (prop === 'fillStyle') fillStyle = value;
        return true;
      },
    },
  );
  return { ctx: ctx as CanvasRenderingContext2D, calls };
}
const note = (id: string, x: number, y: number, over: Partial<Note> = {}): Note =>
  ({ id, x, y, w: 400, h: 300, bgColor: '#E3F2FD', groupId: null, ...over }) as Note;
const group = (over: Partial<Group> = {}): Group => ({ id: 'g', name: 'G', x: 0, y: 0, w: 1000, h: 800, color: 'rgba(1,2,3,0.5)', minimized: false, ...over });
const conn: Connection = { id: 'c', fromNote: 'a', fromSide: 'right', toNote: 'b', toSide: 'left' };
const fills = (calls: ReturnType<typeof stubCtx>['calls']) => calls.filter((c) => c.fn === 'fillRect').map((c) => c.fill);

test('drawMinimap paints background, groups, notes with their colours, and the viewport box last', () => {
  const { ctx, calls } = stubCtx();
  drawMinimap(ctx, 240, 180, {
    notes: { a: note('a', 400, 300), b: note('b', 2000, 1000, { bgColor: '#FFD1DC' }) },
    groups: { g: group() },
    connections: { c: conn },
    view,
    viewportW: 1000,
    viewportH: 600,
  });
  assert.deepEqual(fills(calls), ['#faf7f2', 'rgba(1,2,3,0.5)', '#E3F2FD', '#FFD1DC', 'rgba(196,82,42,0.12)']);
  assert.equal(calls.filter((c) => c.fn === 'lineTo').length, 1); // one connection line
  const note0 = calls.filter((c) => c.fn === 'fillRect')[2]!.args as number[];
  assert.deepEqual(note0, [400 * 0.06, 300 * 0.06, 400 * 0.06, 300 * 0.06]);
});

test('drawMinimap hides notes and connections inside minimized groups, and draws the group as a pill', () => {
  const { ctx, calls } = stubCtx();
  drawMinimap(ctx, 240, 180, {
    notes: { a: note('a', 400, 300, { groupId: 'g' }), b: note('b', 2000, 1000) },
    groups: { g: group({ minimized: true }) },
    connections: { c: conn },
    view,
    viewportW: 0,
    viewportH: 0,
  });
  assert.deepEqual(fills(calls), ['#faf7f2', 'rgba(1,2,3,0.5)', '#E3F2FD']); // only note b, no viewport box (size unknown)
  assert.equal(calls.filter((c) => c.fn === 'lineTo').length, 0);
  assert.deepEqual(calls.filter((c) => c.fn === 'fillRect')[1]!.args, [0, 0, 140 * 0.06, 32 * 0.06]);
});

// ── preferences ──

const memory = (initial: Record<string, string> = {}): StorageLike & { data: Map<string, string> } => {
  const data = new Map(Object.entries(initial));
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

test('prefs: defaults, persistence, and restore on hydrate', () => {
  const storage = memory();
  const p = createMinimapPrefs(storage);
  assert.deepEqual([p.getState().width, p.getState().collapsed], [MAP_DEFAULT_W, false]);
  p.getState().setWidth(300);
  p.getState().setCollapsed(true);
  assert.deepEqual(JSON.parse(storage.data.get('darknotes:v1:minimap')!), { width: 300, collapsed: true });
  const again = createMinimapPrefs(storage);
  again.getState().hydrate();
  assert.deepEqual([again.getState().width, again.getState().collapsed], [300, true]);
});

test('prefs: widths are clamped, and damaged or missing storage falls back to defaults', () => {
  const p = createMinimapPrefs(memory());
  p.getState().setWidth(5);
  assert.equal(p.getState().width, MAP_MIN_W);
  for (const bad of ['{ nope', JSON.stringify({ width: 'wide', collapsed: 'yes' }), JSON.stringify({ width: 99999 })]) {
    const q = createMinimapPrefs(memory({ 'darknotes:v1:minimap': bad }));
    q.getState().hydrate();
    assert.ok(q.getState().width >= MAP_MIN_W && q.getState().width <= MAP_MAX_W, bad);
    assert.equal(q.getState().collapsed, false);
  }
  const none = createMinimapPrefs(null);
  none.getState().hydrate();
  none.getState().setWidth(280);
  assert.equal(none.getState().width, 280);
});

test('board constants used by the map', () => {
  assert.deepEqual([BOARD_W, BOARD_H], [4000, 3000]);
});
