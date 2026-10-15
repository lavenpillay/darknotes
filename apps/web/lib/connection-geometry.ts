/** Pure connection geometry, ported from the legacy app so existing boards look identical. */

import type { Connection, Note, Side } from '@darknotes/core/types';

export interface Point {
  x: number;
  y: number;
}

export const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];
export const SNAP_RADIUS = 30;

type Box = Pick<Note, 'x' | 'y' | 'w' | 'h'>;

/** Midpoint of one edge of a note, in board coordinates. */
export function connPointPos(note: Box, side: Side): Point {
  const { x, y, w, h } = note;
  switch (side) {
    case 'top':
      return { x: x + w / 2, y };
    case 'right':
      return { x: x + w, y: y + h / 2 };
    case 'bottom':
      return { x: x + w / 2, y: y + h };
    default:
      return { x, y: y + h / 2 };
  }
}

const offset = (side: Side, d: number): Point =>
  side === 'top' ? { x: 0, y: -d } : side === 'right' ? { x: d, y: 0 } : side === 'bottom' ? { x: 0, y: d } : { x: -d, y: 0 };

/** Cubic bezier leaving p1 in the direction of s1 and arriving at p2 from the direction of s2. */
export function bezierPath(p1: Point, s1: Side, p2: Point, s2: Side): string {
  const d = Math.max(60, Math.hypot(p2.x - p1.x, p2.y - p1.y) * 0.45);
  const o1 = offset(s1, d);
  const o2 = offset(s2, d);
  return `M ${p1.x} ${p1.y} C ${p1.x + o1.x} ${p1.y + o1.y}, ${p2.x + o2.x} ${p2.y + o2.y}, ${p2.x} ${p2.y}`;
}

/** Which side of the target a free-floating preview line should arrive on. */
export function guessSide(from: Point, to: Point): Side {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'left' : 'right') : dy > 0 ? 'top' : 'bottom';
}

export interface Snap {
  noteId: string;
  side: Side;
  point: Point;
}

/** Nearest connection dot (on any note but `excludeId`) within `radius` of the board point. */
export function findSnap(
  notes: Record<string, Note>,
  excludeId: string,
  at: Point,
  radius = SNAP_RADIUS,
): Snap | null {
  let best: Snap | null = null;
  let bestDist = radius;
  for (const n of Object.values(notes)) {
    if (n.id === excludeId) continue;
    for (const side of SIDES) {
      const point = connPointPos(n, side);
      const d = Math.hypot(point.x - at.x, point.y - at.y);
      if (d < bestDist) {
        bestDist = d;
        best = { noteId: n.id, side, point };
      }
    }
  }
  return best;
}

/** The same two dots joined in either direction count as one connection. */
export function isDuplicateConnection(
  connections: Record<string, Connection>,
  c: Pick<Connection, 'fromNote' | 'fromSide' | 'toNote' | 'toSide'>,
): boolean {
  return Object.values(connections).some(
    (x) =>
      (x.fromNote === c.fromNote && x.fromSide === c.fromSide && x.toNote === c.toNote && x.toSide === c.toSide) ||
      (x.fromNote === c.toNote && x.fromSide === c.toSide && x.toNote === c.fromNote && x.toSide === c.fromSide),
  );
}
