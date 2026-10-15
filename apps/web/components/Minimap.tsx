'use client';

import { useEffect, useRef, useState } from 'react';
import type { View } from '@/lib/board-math';
import { drawMinimap } from '@/lib/minimap-draw';
import {
  MAP_MINI_W,
  clampMapWidth,
  insideRect,
  mapSize,
  mapToBoard,
  resizedWidth,
  viewForCenter,
  viewForDrag,
  viewportOnMap,
} from '@/lib/minimap-geometry';
import { boardStore, useBoard } from '@/lib/use-board';
import { minimapPrefs, useMinimapPrefs } from '@/lib/use-minimap-prefs';

const MARGIN = 12;

const currentView = (): View | null => {
  const ws = boardStore.getState().ws;
  return ws ? { offsetX: ws.boardOffsetX, offsetY: ws.boardOffsetY, zoom: ws.boardZoom } : null;
};

/**
 * An overview of the whole board with a box for what is on screen. Click to jump, drag the box to pan, drag the
 * top-left corner to resize, and collapse it to a small thumbnail (mini-mode) that still navigates.
 */
export function Minimap() {
  const notes = useBoard((s) => s.ws?.notes);
  const groups = useBoard((s) => s.ws?.groups);
  const connections = useBoard((s) => s.ws?.connections);
  const offsetX = useBoard((s) => s.ws?.boardOffsetX ?? 0);
  const offsetY = useBoard((s) => s.ws?.boardOffsetY ?? 0);
  const zoom = useBoard((s) => s.ws?.boardZoom ?? 1);
  const width = useMinimapPrefs((s) => s.width);
  const collapsed = useMinimapPrefs((s) => s.collapsed);

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 }); // the board area this map sits in
  const drag = useRef<{ start: View; px: number; py: number } | null>(null);
  const resize = useRef<{ w: number; px: number; py: number } | null>(null);

  useEffect(() => minimapPrefs.getState().hydrate(), []);

  // Track the size of the board area (the map shows what part of the board it covers).
  useEffect(() => {
    const parent = rootRef.current?.parentElement;
    if (!parent) return;
    const measure = () => setVp({ w: parent.clientWidth, h: parent.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  const available = vp.w > 0 ? vp.w - MARGIN * 2 : Infinity;
  const mapW = collapsed ? MAP_MINI_W : clampMapWidth(width, available);
  const { h: mapH } = mapSize(mapW);

  // Repaint when anything visible changes (once per frame at most).
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !notes || !groups || !connections) return;
    const frame = requestAnimationFrame(() => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(mapW * dpr);
      canvas.height = Math.round(mapH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawMinimap(ctx, mapW, mapH, {
        notes,
        groups,
        connections,
        view: { offsetX, offsetY, zoom },
        viewportW: vp.w,
        viewportH: vp.h,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [notes, groups, connections, offsetX, offsetY, zoom, vp.w, vp.h, mapW, mapH]);

  if (!notes) return null;

  // ── navigate ──
  const onMapDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || vp.w === 0) return;
    const view = currentView();
    if (!view) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    let start = view;
    if (!insideRect(p, viewportOnMap(view, vp.w, vp.h, mapW))) {
      // Clicked outside the box: jump there (and keep dragging from the new spot).
      start = viewForCenter(mapToBoard(p, mapW), view.zoom, vp.w, vp.h);
      boardStore.getState().setView(start);
    }
    drag.current = { start, px: e.clientX, py: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMapMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d) return;
    boardStore.getState().setView(viewForDrag(d.start, { x: e.clientX - d.px, y: e.clientY - d.py }, mapW));
  };
  const endMapDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const onMapKey = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const view = currentView();
    const step = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!view || !step) return;
    e.preventDefault();
    boardStore.getState().setView({
      ...view,
      offsetX: view.offsetX + step[0]! * vp.w * 0.1,
      offsetY: view.offsetY + step[1]! * vp.h * 0.1,
    });
  };

  // ── resize (top-left corner) ──
  const onGripDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    resize.current = { w: mapW, px: e.clientX, py: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onGripMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = resize.current;
    if (r) minimapPrefs.getState().setWidth(resizedWidth(r.w, e.clientX - r.px, e.clientY - r.py, available));
  };
  const endGrip = (e: React.PointerEvent<HTMLDivElement>) => {
    resize.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const canvas = (
    <canvas
      ref={canvasRef}
      tabIndex={0}
      aria-label="Minimap of the whole board. Click or drag to move around; arrow keys pan."
      className="block cursor-crosshair touch-none outline-offset-[-2px]"
      style={{ width: mapW, height: mapH }}
      onPointerDown={onMapDown}
      onPointerMove={onMapMove}
      onPointerUp={endMapDrag}
      onPointerCancel={endMapDrag}
      onKeyDown={onMapKey}
    />
  );

  return (
    <div
      ref={rootRef}
      role="region"
      aria-label="Minimap"
      className="absolute bottom-3 right-3 z-30 select-none overflow-hidden rounded-xl border-[1.5px] border-border bg-white shadow-[0_6px_24px_rgba(26,22,18,0.16)]"
      style={{ width: mapW }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {collapsed ? (
        <div className="relative">
          {canvas}
          <button
            type="button"
            aria-label="Expand the minimap"
            title="Expand the minimap"
            className="absolute right-1 top-1 grid size-6 place-items-center rounded-md bg-white/90 text-ink shadow hover:bg-white"
            onClick={() => minimapPrefs.getState().setCollapsed(false)}
          >
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
        </div>
      ) : (
        <>
          <div className="flex h-7 items-center border-b border-border bg-surface pl-6 pr-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Map</span>
            <span className="ml-2 font-mono text-[10px] text-ink-muted">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              aria-label="Collapse to a small thumbnail"
              title="Collapse to mini-mode"
              className="ml-auto grid size-5 place-items-center rounded text-ink-muted hover:bg-black/10 hover:text-ink"
              onClick={() => minimapPrefs.getState().setCollapsed(true)}
            >
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
          {canvas}
          <div
            role="separator"
            aria-label="Resize the minimap"
            title="Drag to resize"
            className="absolute left-0 top-0 z-10 grid size-6 cursor-nwse-resize touch-none place-items-center text-ink-muted hover:text-accent"
            onPointerDown={onGripDown}
            onPointerMove={onGripMove}
            onPointerUp={endGrip}
            onPointerCancel={endGrip}
          >
            <svg viewBox="0 0 10 10" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
              <line x1="1" y1="7" x2="7" y2="1" />
              <line x1="1" y1="4" x2="4" y2="1" />
            </svg>
          </div>
        </>
      )}
    </div>
  );
}
