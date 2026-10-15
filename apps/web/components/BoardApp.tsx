'use client';

import { useEffect } from 'react';
import { clampZoom, roundZoom, ZOOM_STEP } from '@/lib/board-math';
import { boardStore, useBoard } from '@/lib/use-board';
import { Board } from './Board';
import { ConnectionMenu } from './ConnectionMenu';
import { ImportDialog } from './ImportDialog';
import { NoteContextMenu } from './NoteContextMenu';
import { StylePanel } from './StylePanel';
import { Toolbar } from './Toolbar';

/** How often the open tab merges in changes made by other writers. */
const POLL_MS = 4000;

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

export function BoardApp() {
  const phase = useBoard((s) => s.phase);
  const error = useBoard((s) => s.error);
  const notice = useBoard((s) => s.notice);
  const offline = useBoard((s) => s.offline);

  useEffect(() => {
    void boardStore.getState().init();

    // Pick up changes made elsewhere (MCP, another tab) when the tab becomes visible again.
    const onVisible = () => document.visibilityState === 'visible' && void boardStore.getState().refresh();
    // Do not lose the debounce window when the tab is closed or hidden.
    const onFlush = () => void boardStore.getState().flush();
    const onHide = () => document.visibilityState === 'hidden' && onFlush();
    document.addEventListener('visibilitychange', onVisible);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onFlush);
    window.addEventListener('online', onVisible);

    // Live-merge changes made elsewhere (Claude over MCP, another tab). Skipped while the tab is hidden.
    const poll = setInterval(() => document.visibilityState === 'visible' && void boardStore.getState().refresh(), POLL_MS);

    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || typing(e.target)) return;
      const ws = boardStore.getState().ws;
      if (!ws) return;
      const view = { offsetX: ws.boardOffsetX, offsetY: ws.boardOffsetY, zoom: ws.boardZoom };
      let zoom: number | null = null;
      if (e.key === '=' || e.key === '+') zoom = view.zoom + ZOOM_STEP;
      else if (e.key === '-') zoom = view.zoom - ZOOM_STEP;
      else if (e.key === '0') zoom = 1;
      if (zoom === null) return;
      e.preventDefault();
      boardStore.getState().setView({ ...view, zoom: roundZoom(clampZoom(zoom)) });
    };
    window.addEventListener('keydown', onKey);

    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onFlush);
      window.removeEventListener('online', onVisible);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // Auto-dismiss notices.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => boardStore.getState().clearNotice(), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  if (phase === 'error') {
    return (
      <main className="mx-auto max-w-md p-10 text-center">
        <h1 className="font-display text-2xl font-bold text-accent">Can’t reach the DarkNotes server</h1>
        <p className="mt-2 text-ink-muted">{error}</p>
        <p className="mt-4 text-sm text-ink-muted">
          Start it with <code className="font-mono">npm run serve</code>, then reload.
        </p>
        <button
          className="mt-6 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
          onClick={() => void boardStore.getState().init()}
        >
          Retry
        </button>
      </main>
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      <Toolbar />
      {offline && (
        <div className="bg-accent-light px-4 py-1 text-center text-xs text-ink">
          Offline: showing your last saved copy. Changes will sync when the server is back.
        </div>
      )}
      {phase === 'loading' ? (
        <div className="grid flex-1 place-items-center text-ink-muted">Loading…</div>
      ) : (
        <Board />
      )}
      <ConnectionMenu />
      <NoteContextMenu />
      <StylePanel />
      <ImportDialog />
      {notice && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-sm text-surface shadow-lg"
        >
          {notice}
        </div>
      )}
    </div>
  );
}
