/** Pure group logic, ported from the legacy app so existing boards behave identically. */

import type { Group, Note } from '@darknotes/core/types';

export const MIN_GROUP_W = 200;
export const MIN_GROUP_H = 120;
export const GROUP_PAD = 40;

export const GROUP_COLORS = [
  'rgba(255,245,180,0.55)',
  'rgba(255,220,180,0.55)',
  'rgba(255,200,210,0.55)',
  'rgba(220,235,255,0.55)',
  'rgba(210,245,220,0.55)',
  'rgba(235,220,255,0.55)',
  'rgba(255,240,200,0.55)',
  'rgba(200,240,240,0.55)',
  'rgba(240,230,220,0.55)',
  'rgba(230,230,230,0.55)',
];

type Box = Pick<Note, 'x' | 'y' | 'w' | 'h'>;

/** Geometric containment: the whole note lies within the group's rectangle. */
export function isNoteInGroup(note: Box, group: Box): boolean {
  return (
    note.x >= group.x &&
    note.y >= group.y &&
    note.x + note.w <= group.x + group.w &&
    note.y + (note.h || 220) <= group.y + group.h
  );
}

/** Notes dragged along with a group: everything geometrically inside it, whether or not it has the groupId. */
export function notesInside(notes: Record<string, Note>, group: Box): Note[] {
  return Object.values(notes).filter((n) => isNoteInGroup(n, group));
}

/** Notes whose group is minimized are hidden (together with their connections). */
export function hiddenNoteIds(notes: Record<string, Note>, groups: Record<string, Group>): Set<string> {
  const minimized = new Set(
    Object.values(groups)
      .filter((g) => g.minimized)
      .map((g) => g.id),
  );
  const hidden = new Set<string>();
  if (minimized.size === 0) return hidden;
  for (const n of Object.values(notes)) if (n.groupId && minimized.has(n.groupId)) hidden.add(n.id);
  return hidden;
}

/** Where a note goes when added to a group: unchanged if already inside, else the group's top-left with padding. */
export function placementInGroup(note: Box, group: Box, pad = GROUP_PAD): { x: number; y: number } | null {
  return isNoteInGroup(note, group) ? null : { x: group.x + pad, y: group.y + pad };
}

/** Border colour derived from the (rgba) fill, as in the legacy app. */
export function groupBorderColor(color: string): string {
  return color.replace(/[\d.]+\)$/, '0.35)');
}

/** A colour that is not used by an existing group where possible, so new groups are distinguishable. */
export function pickGroupColor(groups: Record<string, Group>, random: () => number = Math.random): string {
  const used = new Set(Object.values(groups).map((g) => g.color));
  const free = GROUP_COLORS.filter((c) => !used.has(c));
  const pool = free.length > 0 ? free : GROUP_COLORS;
  return pool[Math.floor(random() * pool.length)] ?? GROUP_COLORS[0]!;
}
