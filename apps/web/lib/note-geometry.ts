/** Pure geometry for moving and resizing notes. All inputs are viewport pixels; outputs are board units. */

import { BOARD_H, BOARD_W } from './board-math';

export const MIN_NOTE_W = 220;
export const MIN_NOTE_H = 140;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Point {
  x: number;
  y: number;
}

/** 'se' = corner, 'e' = right edge (width only), 's' = bottom edge (height only). */
export type ResizeHandle = 'se' | 'e' | 's';

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));
const round = (v: number) => Math.round(v);

/** New top-left after dragging by the pointer delta; the note stays fully on the board. */
export function dragPosition(start: Rect, pointerStart: Point, pointer: Point, zoom: number): Point {
  const dx = (pointer.x - pointerStart.x) / zoom;
  const dy = (pointer.y - pointerStart.y) / zoom;
  return {
    x: round(clamp(start.x + dx, 0, BOARD_W - start.w)),
    y: round(clamp(start.y + dy, 0, BOARD_H - start.h)),
  };
}

/** New size after dragging a resize handle; never below the minimum, never past the board edge. */
export function resizeSize(
  start: Rect,
  handle: ResizeHandle,
  pointerStart: Point,
  pointer: Point,
  zoom: number,
  min: { w: number; h: number } = { w: MIN_NOTE_W, h: MIN_NOTE_H },
): { w: number; h: number } {
  const dx = (pointer.x - pointerStart.x) / zoom;
  const dy = (pointer.y - pointerStart.y) / zoom;
  const w = handle === 's' ? start.w : round(clamp(start.w + dx, min.w, BOARD_W - start.x));
  const h = handle === 'e' ? start.h : round(clamp(start.h + dy, min.h, BOARD_H - start.y));
  return { w, h };
}

/** z-index that puts a note above every other note (returns null if it is already on top). */
export function bringToFrontZ(notes: Record<string, { id: string; zIndex?: number }>, id: string): number | null {
  const mine = notes[id]?.zIndex ?? 10;
  let top = 10;
  let othersAbove = false;
  for (const n of Object.values(notes)) {
    const z = n.zIndex ?? 10;
    if (n.id !== id) {
      top = Math.max(top, z);
      if (z >= mine) othersAbove = true;
    }
  }
  return othersAbove ? top + 1 : null;
}
