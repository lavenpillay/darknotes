/** Pure minimap geometry. The map shows the whole board (BOARD_W x BOARD_H) scaled to a width in CSS pixels. */

import { BOARD_H, BOARD_W, type View } from './board-math';

export const MAP_ASPECT = BOARD_H / BOARD_W;
export const MAP_MIN_W = 160;
export const MAP_MAX_W = 520;
export const MAP_DEFAULT_W = 240;
/** Width of the thumbnail shown in mini-mode. */
export const MAP_MINI_W = 132;

export interface Point {
  x: number;
  y: number;
}
export interface Rect extends Point {
  w: number;
  h: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));

export const mapScale = (mapW: number) => mapW / BOARD_W;
export const mapSize = (mapW: number) => ({ w: mapW, h: Math.round(mapW * MAP_ASPECT) });

/** Keep the map between its minimum and maximum, and no wider than the space it sits in. */
export function clampMapWidth(w: number, available = Infinity): number {
  if (!Number.isFinite(w)) return MAP_DEFAULT_W;
  return Math.round(clamp(w, MAP_MIN_W, Math.min(MAP_MAX_W, Math.max(MAP_MIN_W, available))));
}

/**
 * New width while dragging the top-left handle (the map is anchored bottom-right, so dragging up and to the
 * left grows it). The diagonal drag drives both axes, averaged, so the map keeps its shape.
 */
export function resizedWidth(startW: number, dx: number, dy: number, available = Infinity): number {
  const grow = (-dx + -dy / MAP_ASPECT) / 2;
  return clampMapWidth(startW + grow, available);
}

/** The part of the board that is on screen, in board coordinates. */
export function viewportRect(view: View, viewportW: number, viewportH: number): Rect {
  // `+ 0` turns a negative zero (from an offset of 0) into 0
  return { x: -view.offsetX / view.zoom + 0, y: -view.offsetY / view.zoom + 0, w: viewportW / view.zoom, h: viewportH / view.zoom };
}

/** A point on the map (px from its top-left) as a board point, kept on the board. */
export function mapToBoard(p: Point, mapW: number): Point {
  const s = mapScale(mapW);
  return { x: clamp(p.x / s, 0, BOARD_W), y: clamp(p.y / s, 0, BOARD_H) };
}

/** Pan so the given board point is in the middle of the screen. */
export function viewForCenter(center: Point, zoom: number, viewportW: number, viewportH: number): View {
  return { zoom, offsetX: viewportW / 2 - center.x * zoom, offsetY: viewportH / 2 - center.y * zoom };
}

/** Pan by a drag of the viewport box on the map: `delta` is map pixels, positive = box moved right/down. */
export function viewForDrag(start: View, delta: Point, mapW: number): View {
  const s = mapScale(mapW);
  return { zoom: start.zoom, offsetX: start.offsetX - (delta.x / s) * start.zoom, offsetY: start.offsetY - (delta.y / s) * start.zoom };
}

/** The viewport box in map pixels, clipped to the map. */
export function viewportOnMap(view: View, viewportW: number, viewportH: number, mapW: number): Rect {
  const s = mapScale(mapW);
  const r = viewportRect(view, viewportW, viewportH);
  const mapH = BOARD_H * s;
  const x0 = clamp(r.x * s, 0, mapW);
  const y0 = clamp(r.y * s, 0, mapH);
  const x1 = clamp((r.x + r.w) * s, 0, mapW);
  const y1 = clamp((r.y + r.h) * s, 0, mapH);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export const insideRect = (p: Point, r: Rect) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
