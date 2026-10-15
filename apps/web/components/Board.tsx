'use client';

import { useEffect, useRef } from 'react';
import { BOARD_H, BOARD_W, roundZoom, wheelZoomFactor, zoomAround } from '@/lib/board-math';
import { boardStore, useBoard } from '@/lib/use-board';
import { NoteCard } from './NoteCard';

let viewportEl: HTMLDivElement | null = null;

/** Size of the visible board area (for "centre of the visible canvas" calculations). */
export function viewportSize() {
  return { w: viewportEl?.clientWidth ?? 1000, h: viewportEl?.clientHeight ?? 700 };
}

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

export function Board() {
  const ref = useRef<HTMLDivElement>(null);
  const notes = useBoard((s) => s.ws?.notes);
  const offsetX = useBoard((s) => s.ws?.boardOffsetX ?? 0);
  const offsetY = useBoard((s) => s.ws?.boardOffsetY ?? 0);
  const zoom = useBoard((s) => s.ws?.boardZoom ?? 1);
  const wsId = useBoard((s) => s.currentWsId);

  const spaceDown = useRef(false);
  const pan = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const currentView = () => {
    const ws = boardStore.getState().ws!;
    return { offsetX: ws.boardOffsetX, offsetY: ws.boardOffsetY, zoom: ws.boardZoom };
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    viewportEl = el;

    // Non-passive so we can stop the browser from zooming/scrolling the page.
    const onWheel = (e: WheelEvent) => {
      if (!boardStore.getState().ws) return;
      e.preventDefault();
      const view = currentView();
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const next = zoomAround(view, view.zoom * wheelZoomFactor(e.deltaY), {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
        boardStore.getState().setView({ ...next, zoom: roundZoom(next.zoom) });
      } else {
        boardStore.getState().setView({ ...view, offsetX: view.offsetX - e.deltaX, offsetY: view.offsetY - e.deltaY });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !typing(e.target)) {
        spaceDown.current = true;
        el.style.cursor = 'grab';
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDown.current = false;
        el.style.cursor = '';
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (viewportEl === el) viewportEl = null;
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Space+drag, middle button, or dragging empty board pans.
    const onEmpty = e.target === e.currentTarget || (e.target as HTMLElement).dataset.board !== undefined;
    if (!(spaceDown.current || e.button === 1 || (e.button === 0 && onEmpty))) return;
    e.preventDefault();
    const v = currentView();
    pan.current = { x: e.clientX, y: e.clientY, ox: v.offsetX, oy: v.offsetY };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.style.cursor = 'grabbing';
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = pan.current;
    if (!p) return;
    boardStore.getState().setView({ ...currentView(), offsetX: p.ox + e.clientX - p.x, offsetY: p.oy + e.clientY - p.y });
  };
  const endPan = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pan.current) return;
    pan.current = null;
    e.currentTarget.style.cursor = spaceDown.current ? 'grab' : '';
  };

  return (
    <div
      ref={ref}
      className="relative min-h-0 flex-1 touch-none overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
    >
      <div
        data-board
        key={wsId}
        className="board-grid absolute left-0 top-0 origin-top-left"
        style={{
          width: BOARD_W,
          height: BOARD_H,
          transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`,
        }}
      >
        {notes && Object.values(notes).map((note) => <NoteCard key={note.id} note={note} />)}
      </div>
    </div>
  );
}
