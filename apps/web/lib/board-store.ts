/**
 * Client state for the board. The server is the source of truth; edits are applied locally at once and
 * saved with a debounce (whole-board PUT, as the API expects). localStorage is only an offline cache.
 */

import { createStore } from 'zustand/vanilla';
import type { Line, Note, Workspace } from '@darknotes/core/types';
import type { Api, BoardPayload, WorkspaceSummary } from './api';
import type { View } from './board-math';

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';
export type Phase = 'loading' | 'ready' | 'error';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface BoardState {
  phase: Phase;
  /** True while showing the localStorage copy because the server could not be reached. */
  offline: boolean;
  error: string | null;
  /** Transient message for the UI (e.g. a failed rename). */
  notice: string | null;
  workspaces: WorkspaceSummary[];
  currentWsId: string | null;
  ws: Workspace | null;
  save: SaveState;

  init(): Promise<void>;
  refresh(): Promise<void>;
  flush(): Promise<void>;
  clearNotice(): void;

  switchWorkspace(id: string): Promise<void>;
  createWorkspace(name: string): Promise<void>;
  renameWorkspace(id: string, name: string): Promise<void>;
  deleteWorkspace(id: string): Promise<void>;

  addNote(init?: Partial<Omit<Note, 'id'>>): string | null;
  updateNote(id: string, patch: Partial<Omit<Note, 'id'>>): void;
  deleteNote(id: string): void;
  setView(view: View): void;
}

export interface BoardStoreOptions {
  api: Api;
  storage?: StorageLike | null;
  saveDelayMs?: number;
  retryDelayMs?: number;
}

const INDEX_KEY = 'darknotes:v2:index';
const boardKey = (id: string) => `darknotes:v2:board:${id}`;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function boardPayload(ws: Workspace): BoardPayload {
  return {
    notes: ws.notes,
    groups: ws.groups,
    connections: ws.connections,
    boardOffsetX: ws.boardOffsetX,
    boardOffsetY: ws.boardOffsetY,
    boardZoom: ws.boardZoom,
    nextNoteId: ws.nextNoteId,
    nextGroupId: ws.nextGroupId,
    nextConnectionId: ws.nextConnectionId,
  };
}

export function defaultLines(): Line[] {
  return [{ type: 'text', text: '' }];
}

export function createBoardStore({ api, storage = null, saveDelayMs = 600, retryDelayMs = 5000 }: BoardStoreOptions) {
  let rev = 0; // bumped by every local edit
  let savedRev = 0; // highest rev known to be on the server
  let inflight: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const cacheWrite = (key: string, value: unknown) => {
    try {
      storage?.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or blocked: the cache is best-effort */
    }
  };
  const cacheRead = <T>(key: string): T | null => {
    try {
      const raw = storage?.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  };

  const store = createStore<BoardState>()((set, get) => {
    const schedule = (delay: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => void get().flush(), delay);
    };

    /** Apply a local edit to the current workspace. */
    const edit = (fn: (ws: Workspace) => Workspace) => {
      const { ws } = get();
      if (!ws) return;
      const next = fn(ws);
      if (next === ws) return;
      rev++;
      set({ ws: next, save: 'dirty' });
      cacheWrite(boardKey(next.id), next);
      schedule(saveDelayMs);
    };

    const showWorkspace = (ws: Workspace, offline = false) => {
      set({ ws, currentWsId: ws.id, offline, save: 'saved' });
      rev = savedRev = 0;
      cacheWrite(boardKey(ws.id), ws);
    };

    const loadList = async () => {
      const list = await api.listWorkspaces();
      set({ workspaces: list.workspaces });
      cacheWrite(INDEX_KEY, { workspaces: list.workspaces, currentWsId: list.currentWorkspaceId });
      return list;
    };

    return {
      phase: 'loading',
      offline: false,
      error: null,
      notice: null,
      workspaces: [],
      currentWsId: null,
      ws: null,
      save: 'saved',

      async init() {
        try {
          const list = await loadList();
          const ws = await api.getWorkspace(list.currentWorkspaceId);
          showWorkspace(ws);
          set({ phase: 'ready', error: null });
        } catch (err) {
          const index = cacheRead<{ workspaces: WorkspaceSummary[]; currentWsId: string }>(INDEX_KEY);
          const cached = index ? cacheRead<Workspace>(boardKey(index.currentWsId)) : null;
          if (index && cached) {
            set({ workspaces: index.workspaces, phase: 'ready', error: null });
            showWorkspace(cached, true);
            // Keep what we have, but treat it as unsaved so it reaches the server once it is back.
            rev = 1;
            set({ save: 'error' });
            schedule(retryDelayMs);
          } else {
            set({ phase: 'error', error: message(err) });
          }
        }
      },

      /** Pull server changes (e.g. made through MCP) when there is nothing unsaved locally. */
      async refresh() {
        const { currentWsId } = get();
        if (!currentWsId || inflight || rev !== savedRev) return;
        const startRev = rev;
        try {
          const [, ws] = await Promise.all([loadList(), api.getWorkspace(currentWsId)]);
          if (rev !== startRev || get().currentWsId !== currentWsId) return; // edited meanwhile
          if (JSON.stringify(ws) !== JSON.stringify(get().ws)) showWorkspace(ws);
          set({ offline: false });
        } catch {
          /* stay on what we have */
        }
      },

      flush() {
        clearTimeout(timer);
        if (inflight) return inflight; // the running save re-checks rev when it finishes
        if (rev === savedRev) return Promise.resolve();
        const { ws } = get();
        if (!ws) return Promise.resolve();

        const sentRev = rev;
        set({ save: 'saving' });
        inflight = (async () => {
          try {
            await api.saveBoard(ws.id, boardPayload(ws));
            savedRev = Math.max(savedRev, sentRev);
            set({ offline: false });
          } catch (err) {
            set({ save: 'error', notice: `Could not save: ${message(err)}` });
            inflight = null;
            schedule(retryDelayMs);
            return;
          }
          inflight = null;
          if (rev !== savedRev) {
            set({ save: 'dirty' });
            schedule(saveDelayMs);
          } else {
            set({ save: 'saved' });
          }
        })();
        return inflight;
      },

      clearNotice: () => set({ notice: null }),

      async switchWorkspace(id) {
        if (id === get().currentWsId) return;
        await get().flush();
        if (get().save === 'error') return; // do not leave unsaved edits behind
        try {
          showWorkspace(await api.getWorkspace(id));
          void api.activateWorkspace(id).catch(() => {});
        } catch (err) {
          set({ notice: `Could not open workspace: ${message(err)}` });
        }
      },

      async createWorkspace(name) {
        await get().flush();
        if (get().save === 'error') return;
        try {
          const created = await api.createWorkspace(name);
          await loadList();
          showWorkspace(created);
          void api.activateWorkspace(created.id).catch(() => {});
        } catch (err) {
          set({ notice: `Could not create workspace: ${message(err)}` });
        }
      },

      async renameWorkspace(id, name) {
        const trimmed = name.trim();
        if (!trimmed) return;
        try {
          await api.renameWorkspace(id, trimmed);
          set((s) => ({
            workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, name: trimmed } : w)),
            ws: s.ws && s.ws.id === id ? { ...s.ws, name: trimmed } : s.ws,
          }));
        } catch (err) {
          set({ notice: `Could not rename workspace: ${message(err)}` });
        }
      },

      async deleteWorkspace(id) {
        try {
          await api.deleteWorkspace(id);
          const list = await loadList();
          if (id === get().currentWsId) showWorkspace(await api.getWorkspace(list.currentWorkspaceId));
        } catch (err) {
          set({ notice: `Could not delete workspace: ${message(err)}` });
        }
      },

      addNote(init = {}) {
        const { ws } = get();
        if (!ws) return null;
        const id = `n_${ws.nextNoteId}`;
        const top = Math.max(9, ...Object.values(ws.notes).map((n) => n.zIndex ?? 10));
        const note: Note = {
          id,
          heading: 'New Note',
          lines: defaultLines(),
          labels: [],
          x: 100,
          y: 100,
          w: 300,
          h: 220,
          bgColor: '#FFF9C4',
          fontColor: '#1a1612',
          fontSize: 14,
          headingFont: 'Playfair Display',
          headingSize: 17,
          groupId: null,
          zIndex: top + 1,
          ...init,
        };
        edit((w) => ({ ...w, nextNoteId: w.nextNoteId + 1, notes: { ...w.notes, [id]: note } }));
        return id;
      },

      updateNote(id, patch) {
        edit((ws) => {
          const note = ws.notes[id];
          if (!note) return ws;
          return { ...ws, notes: { ...ws.notes, [id]: { ...note, ...patch } } };
        });
      },

      deleteNote(id) {
        edit((ws) => {
          if (!ws.notes[id]) return ws;
          const { [id]: _removed, ...notes } = ws.notes;
          const connections = Object.fromEntries(
            Object.entries(ws.connections).filter(([, c]) => c.fromNote !== id && c.toNote !== id),
          );
          return { ...ws, notes, connections };
        });
      },

      setView(view) {
        edit((ws) =>
          ws.boardOffsetX === view.offsetX && ws.boardOffsetY === view.offsetY && ws.boardZoom === view.zoom
            ? ws
            : { ...ws, boardOffsetX: view.offsetX, boardOffsetY: view.offsetY, boardZoom: view.zoom },
        );
      },
    };
  });

  return store;
}

export type BoardStore = ReturnType<typeof createBoardStore>;
