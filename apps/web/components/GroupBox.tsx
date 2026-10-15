'use client';

import { memo, useRef, useState } from 'react';
import type { Group } from '@darknotes/core/types';
import { GROUP_COLORS, MIN_GROUP_H, MIN_GROUP_W, groupBorderColor, notesInside } from '@/lib/group-geometry';
import { dragPosition, resizeSize } from '@/lib/note-geometry';
import { boardStore } from '@/lib/use-board';

type Gesture =
  | { kind: 'drag'; start: Group; px: number; py: number; offsets: Record<string, { dx: number; dy: number }> }
  | { kind: 'resize'; start: Group; px: number; py: number };

function ColorPicker({ group }: { group: Group }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        aria-label="Group colour"
        title="Group colour"
        className="size-4 rounded-full border-[1.5px] border-black/20"
        style={{ background: group.color }}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
      />
      {open && (
        <div className="absolute right-0 top-6 z-30 grid w-[142px] grid-cols-5 gap-1.5 rounded-xl border border-border bg-white p-2 shadow-xl">
          {GROUP_COLORS.map((c) => (
            <button
              key={c}
              aria-label={`Colour ${c}`}
              className="size-[22px] rounded-md border-[1.5px] border-black/15"
              style={{ background: c, outline: c === group.color ? '2px solid #555' : undefined }}
              // mousedown (not click) so the picker's own blur does not close it before the pick registers
              onMouseDown={(e) => {
                e.preventDefault();
                boardStore.getState().updateGroup(group.id, { color: c });
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A translucent container behind the notes. The root ignores the pointer so the empty body still pans the
 * board; only the header and the resize handle take input.
 */
export const GroupBox = memo(function GroupBox({ group }: { group: Group }) {
  const gesture = useRef<Gesture | null>(null);
  const update = (patch: Partial<Omit<Group, 'id'>>) => boardStore.getState().updateGroup(group.id, patch);

  const onHeaderDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('input, button')) return;
    const ws = boardStore.getState().ws;
    if (!ws) return;
    e.preventDefault();
    e.stopPropagation();
    const offsets: Record<string, { dx: number; dy: number }> = {};
    // Minimized groups carry nothing: their notes are hidden, so only move what is geometrically inside while open.
    if (!group.minimized) {
      for (const n of notesInside(ws.notes, group)) offsets[n.id] = { dx: n.x - group.x, dy: n.y - group.y };
    }
    gesture.current = { kind: 'drag', start: group, px: e.clientX, py: e.clientY, offsets };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onResizeDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    gesture.current = { kind: 'resize', start: group, px: e.clientX, py: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    const g = gesture.current;
    const ws = boardStore.getState().ws;
    if (!g || !ws) return;
    const a = { x: g.px, y: g.py };
    const b = { x: e.clientX, y: e.clientY };
    if (g.kind === 'drag') {
      boardStore.getState().moveGroup(group.id, dragPosition(g.start, a, b, ws.boardZoom), g.offsets);
    } else {
      update(resizeSize(g.start, 'se', a, b, ws.boardZoom, { w: MIN_GROUP_W, h: MIN_GROUP_H }));
    }
  };

  const onUp = (e: React.PointerEvent<HTMLElement>) => {
    gesture.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const pill = group.minimized;
  return (
    <section
      data-group={group.id}
      className="pointer-events-none absolute z-[2] flex select-none flex-col overflow-hidden rounded-2xl border-2"
      style={{
        left: group.x,
        top: group.y,
        width: pill ? 'auto' : group.w,
        height: pill ? 'auto' : group.h,
        minWidth: pill ? 0 : MIN_GROUP_W,
        background: group.color,
        borderColor: groupBorderColor(group.color),
      }}
    >
      <header
        className={`group/header pointer-events-auto flex shrink-0 cursor-grab items-center gap-1 py-[7px] pl-3 pr-2.5 active:cursor-grabbing ${pill ? 'rounded-[14px]' : 'rounded-t-[14px]'}`}
        onPointerDown={onHeaderDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <input
          value={group.name}
          aria-label="Group name"
          placeholder="Group name…"
          spellCheck={false}
          className="min-w-[60px] flex-1 cursor-text rounded bg-transparent px-1 py-0.5 text-[13px] font-semibold outline-none hover:bg-black/5 focus:bg-black/10"
          onChange={(e) => update({ name: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <button
          aria-label={pill ? 'Restore group' : 'Minimize group'}
          title={pill ? 'Restore group' : 'Minimize group'}
          aria-pressed={pill}
          className="grid size-[22px] shrink-0 place-items-center rounded text-black/40 opacity-0 hover:bg-black/10 hover:text-black/70 focus:opacity-100 group-hover/header:opacity-100"
          style={pill ? { opacity: 1 } : undefined}
          onClick={() => update({ minimized: !group.minimized })}
        >
          <svg viewBox="0 0 24 24" className={`size-[13px] transition-transform ${pill ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {!pill && (
          <>
            <ColorPicker group={group} />
            <button
              aria-label="Delete group"
              title="Delete group (notes are kept)"
              className="grid size-[22px] shrink-0 place-items-center rounded text-[#c0392b] opacity-0 hover:bg-black/10 focus:opacity-100 group-hover/header:opacity-100"
              onClick={() => boardStore.getState().deleteGroup(group.id)}
            >
              <svg viewBox="0 0 24 24" className="size-[13px]" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </>
        )}
      </header>
      {!pill && (
        <div
          aria-label="Resize group"
          className="pointer-events-auto absolute bottom-0 right-0 size-5 cursor-nwse-resize text-black/30"
          onPointerDown={onResizeDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <svg viewBox="0 0 10 10" className="size-full p-1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="9" y1="3" x2="3" y2="9" />
            <line x1="9" y1="6" x2="6" y2="9" />
          </svg>
        </div>
      )}
    </section>
  );
});
