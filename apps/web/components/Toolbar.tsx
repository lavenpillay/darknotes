'use client';

import { useEffect, useRef, useState } from 'react';
import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP, roundZoom, visibleCenter, zoomAround } from '@/lib/board-math';
import { downloadText } from '@/lib/download';
import { useUi } from '@/lib/ui-store';
import { boardStore, useBoard } from '@/lib/use-board';
import { viewportSize } from './Board';

const SAVE_LABEL = { saved: 'Saved', dirty: 'Unsaved changes', saving: 'Saving…', error: 'Not saved' } as const;
const SAVE_DOT = {
  saved: 'bg-emerald-500',
  dirty: 'bg-amber-500',
  saving: 'bg-amber-500',
  error: 'bg-red-500',
} as const;

function WorkspaceSwitcher() {
  const workspaces = useBoard((s) => s.workspaces);
  const currentId = useBoard((s) => s.currentWsId);
  const liveCount = useBoard((s) => (s.ws ? Object.keys(s.ws.notes).length : 0));
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = workspaces.find((w) => w.id === currentId);
  const store = boardStore.getState();

  return (
    <div ref={rootRef} className="relative">
      <button
        className="flex items-center gap-2 rounded-full border border-border bg-bg px-3 py-1.5 text-sm font-medium hover:bg-accent-light"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="max-w-48 truncate">{current?.name || 'Workspace'}</span>
        <span className="font-mono text-xs text-ink-muted">{liveCount}</span>
        <span aria-hidden>▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-border bg-surface p-2 shadow-xl">
          <ul role="listbox" className="max-h-72 overflow-auto">
            {workspaces.map((w) => (
              <li key={w.id} className="group flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-bg">
                {editingId === w.id ? (
                  <input
                    autoFocus
                    className="min-w-0 flex-1 rounded border border-border bg-white px-2 py-1 text-sm"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        void store.renameWorkspace(w.id, editName);
                        setEditingId(null);
                      } else if (e.key === 'Escape') {
                        e.stopPropagation();
                        setEditingId(null);
                      }
                    }}
                    onBlur={() => setEditingId(null)}
                  />
                ) : (
                  <button
                    role="option"
                    aria-selected={w.id === currentId}
                    className={`min-w-0 flex-1 truncate text-left text-sm ${w.id === currentId ? 'font-semibold text-accent' : ''}`}
                    onClick={() => {
                      void store.switchWorkspace(w.id);
                      setOpen(false);
                    }}
                  >
                    {w.name || <em className="text-ink-muted">Untitled</em>}
                  </button>
                )}
                <span className="font-mono text-xs text-ink-muted">
                  {w.id === currentId ? liveCount : w.noteCount}
                </span>
                {confirmDelete === w.id ? (
                  <button
                    className="rounded bg-red-600 px-2 py-0.5 text-xs text-white"
                    onClick={() => {
                      setConfirmDelete(null);
                      void store.deleteWorkspace(w.id);
                    }}
                  >
                    Delete?
                  </button>
                ) : (
                  <span className="hidden gap-1 group-hover:flex">
                    <button
                      aria-label={`Rename ${w.name}`}
                      title="Rename"
                      className="px-1 text-ink-muted hover:text-ink"
                      onClick={() => {
                        setEditingId(w.id);
                        setEditName(w.name);
                      }}
                    >
                      ✎
                    </button>
                    {workspaces.length > 1 && (
                      <button
                        aria-label={`Delete ${w.name}`}
                        title="Delete"
                        className="px-1 text-ink-muted hover:text-red-600"
                        onClick={() => setConfirmDelete(w.id)}
                      >
                        ×
                      </button>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <form
            className="mt-2 flex gap-2 border-t border-border pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newName.trim()) return;
              void store.createWorkspace(newName.trim());
              setNewName('');
              setOpen(false);
            }}
          >
            <input
              className="min-w-0 flex-1 rounded border border-border bg-white px-2 py-1 text-sm"
              placeholder="New workspace name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button className="rounded bg-accent px-3 py-1 text-sm text-white" aria-label="Create workspace">
              +
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

const btn =
  'grid h-8 min-w-8 place-items-center rounded-lg border border-border bg-bg px-2 text-sm hover:bg-accent-light disabled:opacity-40';

export function Toolbar() {
  const save = useBoard((s) => s.save);
  const zoom = useBoard((s) => s.ws?.boardZoom ?? 1);
  const hasWs = useBoard((s) => !!s.ws);

  const setZoom = (z: number) => {
    const { ws } = boardStore.getState();
    if (!ws) return;
    const view = { offsetX: ws.boardOffsetX, offsetY: ws.boardOffsetY, zoom: ws.boardZoom };
    // Zoom around the centre of the visible board, like the keyboard shortcuts do.
    const { w, h } = viewportSize();
    const next = zoomAround(view, z, { x: w / 2, y: h / 2 });
    boardStore.getState().setView({ ...next, zoom: roundZoom(next.zoom) });
  };

  const newNote = () => {
    const { ws } = boardStore.getState();
    if (!ws) return;
    const { w, h } = viewportSize();
    const c = visibleCenter({ offsetX: ws.boardOffsetX, offsetY: ws.boardOffsetY, zoom: ws.boardZoom }, w, h);
    boardStore.getState().addNote({ x: Math.round(c.x - 150), y: Math.round(c.y - 110) });
  };

  const exportNow = async () => {
    const out = await boardStore.getState().exportWorkspace();
    if (out) downloadText(out.filename, out.json);
  };

  const newGroup = () => {
    const { ws } = boardStore.getState();
    if (!ws) return;
    const { w, h } = viewportSize();
    const c = visibleCenter({ offsetX: ws.boardOffsetX, offsetY: ws.boardOffsetY, zoom: ws.boardZoom }, w, h);
    boardStore.getState().addGroup({ x: Math.round(c.x - 230), y: Math.round(c.y - 160) });
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      <span className="font-display text-xl font-bold">
        DarkNotes<span className="text-accent">.</span>
      </span>
      <WorkspaceSwitcher />
      <span className="flex items-center gap-1.5 text-xs text-ink-muted" title={SAVE_LABEL[save]}>
        <span className={`inline-block size-2 rounded-full ${SAVE_DOT[save]}`} />
        <span className="hidden sm:inline">{SAVE_LABEL[save]}</span>
      </span>

      <div className="ml-auto flex items-center gap-2">
        <button className={btn} aria-label="Export this workspace" title="Export this workspace as a file" disabled={!hasWs} onClick={() => void exportNow()}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
        <button className={btn} aria-label="Import a workspace" title="Import a workspace from a file" disabled={!hasWs} onClick={() => useUi.setState({ importOpen: true })}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </button>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <button className={btn} aria-label="Zoom out" disabled={!hasWs || zoom <= MIN_ZOOM} onClick={() => setZoom(zoom - ZOOM_STEP)}>
          −
        </button>
        <button className={`${btn} w-14 font-mono text-xs`} aria-label="Reset zoom" disabled={!hasWs} onClick={() => setZoom(1)}>
          {Math.round(zoom * 100)}%
        </button>
        <button className={btn} aria-label="Zoom in" disabled={!hasWs || zoom >= MAX_ZOOM} onClick={() => setZoom(zoom + ZOOM_STEP)}>
          +
        </button>
        <button className={`${btn} px-3`} disabled={!hasWs} onClick={newGroup}>
          + New Group
        </button>
        <button
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          disabled={!hasWs}
          onClick={newNote}
        >
          + New Note
        </button>
      </div>
    </header>
  );
}
