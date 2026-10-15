/** Draws the minimap onto a 2D context. Pure apart from the context calls, so it can be tested with a stub. */

import type { Connection, Group, Note } from '@darknotes/core/types';
import { BOARD_H, BOARD_W, type View } from './board-math';
import { connPointPos } from './connection-geometry';
import { groupBorderColor, hiddenNoteIds } from './group-geometry';
import { mapScale, viewportOnMap } from './minimap-geometry';

export interface MapScene {
  notes: Record<string, Note>;
  groups: Record<string, Group>;
  connections: Record<string, Connection>;
  view: View;
  viewportW: number;
  viewportH: number;
}

/** A minimized group is drawn as a small pill (its real width depends on its name). */
const PILL = { w: 140, h: 32 };

export function drawMinimap(ctx: CanvasRenderingContext2D, mapW: number, mapH: number, scene: MapScene) {
  const s = mapScale(mapW);
  const hidden = hiddenNoteIds(scene.notes, scene.groups);

  ctx.clearRect(0, 0, mapW, mapH);
  ctx.fillStyle = '#faf7f2';
  ctx.fillRect(0, 0, mapW, mapH);

  for (const g of Object.values(scene.groups)) {
    const w = g.minimized ? PILL.w : g.w;
    const h = g.minimized ? PILL.h : g.h;
    ctx.fillStyle = g.color;
    ctx.fillRect(g.x * s, g.y * s, w * s, h * s);
    ctx.strokeStyle = groupBorderColor(g.color);
    ctx.lineWidth = 1;
    ctx.strokeRect(g.x * s, g.y * s, w * s, h * s);
  }

  ctx.strokeStyle = 'rgba(176,152,120,0.9)';
  ctx.lineWidth = 1;
  for (const c of Object.values(scene.connections)) {
    const a = scene.notes[c.fromNote];
    const b = scene.notes[c.toNote];
    if (!a || !b || hidden.has(a.id) || hidden.has(b.id)) continue;
    const p1 = connPointPos(a, c.fromSide);
    const p2 = connPointPos(b, c.toSide);
    ctx.beginPath();
    ctx.moveTo(p1.x * s, p1.y * s);
    ctx.lineTo(p2.x * s, p2.y * s);
    ctx.stroke();
  }

  for (const n of Object.values(scene.notes)) {
    if (hidden.has(n.id)) continue;
    const w = Math.max(2, n.w * s);
    const h = Math.max(2, n.h * s);
    ctx.fillStyle = n.bgColor;
    ctx.fillRect(n.x * s, n.y * s, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.strokeRect(n.x * s, n.y * s, w, h);
  }

  if (scene.viewportW > 0 && scene.viewportH > 0) {
    const v = viewportOnMap(scene.view, scene.viewportW, scene.viewportH, mapW);
    ctx.fillStyle = 'rgba(196,82,42,0.12)';
    ctx.fillRect(v.x, v.y, v.w, v.h);
    ctx.strokeStyle = '#c4522a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(v.x, v.y, v.w, v.h);
  }
}

export const MAP_BOARD = { w: BOARD_W, h: BOARD_H };
