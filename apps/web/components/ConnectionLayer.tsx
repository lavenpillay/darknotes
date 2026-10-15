'use client';

import { memo, useMemo } from 'react';
import type { Connection } from '@darknotes/core/types';
import { BOARD_H, BOARD_W } from '@/lib/board-math';
import { bezierPath, connPointPos, guessSide } from '@/lib/connection-geometry';
import { hiddenNoteIds } from '@/lib/group-geometry';
import { useUi } from '@/lib/ui-store';
import { boardStore, useBoard } from '@/lib/use-board';

const ConnectionPath = memo(function ConnectionPath({ d, conn }: { d: string; conn: Connection }) {
  const arrows = conn.arrows ?? 'none';
  return (
    <path
      d={d}
      className="conn-line"
      markerStart={arrows === 'start' || arrows === 'both' ? 'url(#arrow-start)' : undefined}
      markerEnd={arrows === 'end' || arrows === 'both' ? 'url(#arrow-end)' : undefined}
      onClick={(e) => {
        e.stopPropagation();
        boardStore.getState().deleteConnection(conn.id);
        boardStore.setState({ notice: 'Connection removed' });
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        useUi.setState({ menu: { connId: conn.id, x: e.clientX, y: e.clientY } });
      }}
    >
      <title>Click to remove · Right-click for arrow options</title>
    </path>
  );
});

/** Lines under the notes. Paths are derived from note geometry, so they follow drags and resizes. */
export function ConnectionLayer() {
  const notes = useBoard((s) => s.ws?.notes);
  const connections = useBoard((s) => s.ws?.connections);
  const groups = useBoard((s) => s.ws?.groups);
  const hidden = useMemo(() => hiddenNoteIds(notes ?? {}, groups ?? {}), [notes, groups]);
  const connecting = useUi((s) => s.connecting);
  const cursor = useUi((s) => s.cursor);
  const snap = useUi((s) => s.snap);

  let preview: string | null = null;
  const from = connecting && notes?.[connecting.fromNote];
  if (connecting && from && cursor) {
    const start = connPointPos(from, connecting.fromSide);
    preview = snap
      ? bezierPath(start, connecting.fromSide, snap.point, snap.side)
      : bezierPath(start, connecting.fromSide, cursor, guessSide(start, cursor));
  }

  return (
    <svg
      width={BOARD_W}
      height={BOARD_H}
      className="pointer-events-none absolute left-0 top-0 z-[5] overflow-visible"
      aria-hidden
    >
      <defs>
        {/* context-stroke makes the arrowhead follow the line colour, including the hover colour */}
        <marker id="arrow-end" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L8,3 z" fill="context-stroke" />
        </marker>
        <marker id="arrow-start" markerWidth="8" markerHeight="8" refX="2" refY="3" orient="auto-start-reverse" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L8,3 z" fill="context-stroke" />
        </marker>
      </defs>
      {connections &&
        notes &&
        Object.values(connections).map((c) => {
          const a = notes[c.fromNote];
          const b = notes[c.toNote];
          if (!a || !b) return null; // dangling connection: nothing to draw
          if (hidden.has(c.fromNote) || hidden.has(c.toNote)) return null; // inside a minimized group
          return <ConnectionPath key={c.id} conn={c} d={bezierPath(connPointPos(a, c.fromSide), c.fromSide, connPointPos(b, c.toSide), c.toSide)} />;
        })}
      {preview && <path d={preview} className="conn-line preview" />}
    </svg>
  );
}
