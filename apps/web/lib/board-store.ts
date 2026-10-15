/**
 * Client state for the board. The server is the source of truth.
 *
 * Edits apply locally at once. They are saved after a short debounce as *incremental changes* (only what
 * differs from the last server state we saw), and the server's reply is merged back three ways, so notes that
 * Claude adds over MCP, or another tab adds, are never overwritten and show up here. localStorage is only an
 * offline cache.
 */

import { DEFAULT_NOTE_STYLE } from '@darknotes/core/defaults';
import { exportFilename } from '@darknotes/core/export-format';
import { createStore } from 'zustand/vanilla';
import type { Arrows, Connection, Group, Line, Note, Side, Workspace } from '@darknotes/core/types';
import type { Api, WorkspaceSummary } from './api';
import type { View } from './board-math';
import { isDuplicateConnection } from './connection-geometry';
import { pickGroupColor, placementInGroup } from './group-geometry';
import { diffToChanges, mergeWorkspace } from './sync';

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
  /** Pull in changes made elsewhere (MCP, another tab) and merge them with local edits. */
  refresh(): Promise<void>;
  flush(): Promise<void>;
  clearNotice(): void;

  switchWorkspace(id: string): Promise<void>;
  createWorkspace(name: string): Promise<void>;
  renameWorkspace(id: string, name: string): Promise<void>;
  deleteWorkspace(id: string): Promise<void>;
  /** Saves pending edits, then returns the current workspace as an export file (null if it could not be read). */
  exportWorkspace(): Promise<{ filename: string; json: string } | null>;
  /** Creates a new workspace from an export file's text and switches to it. */
  importWorkspace(text: string): Promise<{ ok: true } | { ok: false; error: string }>;

  addNote(init?: Partial<Omit<Note, 'id'>>): string | null;
  updateNote(id: string, patch: Partial<Omit<Note, 'id'>>): void;
  deleteNote(id: string): void;
  setView(view: View): void;
  /** Copies a note 30px down-right with "(copy)" appended; returns the new id. */
  duplicateNote(id: string): string | null;

  addGroup(init?: Partial<Omit<Group, 'id'>>): string | null;
  updateGroup(id: string, patch: Partial<Omit<Group, 'id'>>): void;
  /** Moves a group and the given notes (offsets from the group's origin at drag start) together. */
  moveGroup(id: string, pos: { x: number; y: number }, noteOffsets: Record<string, { dx: number; dy: number }>): void;
  /** Deletes the group; its notes stay where they are but are ungrouped. */
  deleteGroup(id: string): void;
  /** Sets the note's group; moves it inside the group if it is outside. Pass null to ungroup. */
  setNoteGroup(noteId: string, groupId: string | null): void;

  /** Returns the new id, or null if a note is missing or the same two dots are already joined. */
  addConnection(c: { fromNote: string; fromSide: Side; toNote: string; toSide: Side }): string | null;
  deleteConnection(id: string): void;
  setConnectionArrows(id: string, arrows: Arrows): void;
}

export type IdPrefix = 'n' | 'g' | 'c';

export interface BoardStoreOptions {
  api: Api;
  storage?: StorageLike | null;
  saveDelayMs?: number;
  retryDelayMs?: number;
  /** New entity ids. Random by default so ids made here can never collide with ones made by Claude or another tab. */
  idGen?: (prefix: IdPrefix) => string;
}

const INDEX_KEY = 'darknotes:v3:index';
const boardKey = (id: string) => `darknotes:v3:board:${id}`;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
export function randomId(prefix: IdPrefix): string {
  const bytes = new Uint8Array(7);
  globalThis.crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (b) => ALPHABET[b % 36]).join('')}`;
}

export function defaultLines(): Line[] {
  return [{ type: 'text', text: '' }];
}

export function createBoardStore({
  api,
  storage = null,
  saveDelayMs = 600,
  retryDelayMs = 5000,
  idGen = randomId,
}: BoardStoreOptions) {
  let rev = 0; // bumped by every local edit
  let savedRev = 0; // highest rev known to be on the server
  let epoch = 0; // bumped whenever `base` changes, so stale poll responses can be discarded
  let base: Workspace | null = null; // the last server state we saw for the current workspace
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

  const uniqueId = (prefix: IdPrefix, taken: Record<string, unknown>) => {
    for (let i = 0; i < 20; i++) {
      const id = idGen(prefix);
      if (!(id in taken)) return id;
    }
    throw new Error('Could not generate a unique id');
  };

  return createStore<BoardState>()((set, get) => {
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
      schedule(saveDelayMs);
    };

    /** Show a workspace freshly loaded from the server. */
    const adopt = (ws: Workspace, offline = false) => {
      base = ws;
      epoch++;
      rev = savedRev = 0;
      set({ ws, currentWsId: ws.id, offline, save: 'saved' });
      cacheWrite(boardKey(ws.id), { ws, base: ws });
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
          adopt(ws);
          set({ phase: 'ready', error: null });
        } catch (err) {
          const index = cacheRead<{ workspaces: WorkspaceSummary[]; currentWsId: string }>(INDEX_KEY);
          const cached = index ? cacheRead<{ ws: Workspace; base: Workspace }>(boardKey(index.currentWsId)) : null;
          if (index && cached?.ws && cached.base) {
            set({ workspaces: index.workspaces, phase: 'ready', error: null });
            adopt(cached.ws, true);
            base = cached.base; // diff against what the server last had, so unsaved edits are sent once it is back
            rev = 1;
            set({ save: 'error' });
            schedule(retryDelayMs);
          } else {
            set({ phase: 'error', error: message(err) });
          }
        }
      },

      async refresh() {
        const { currentWsId } = get();
        if (!currentWsId || inflight || !base) return;
        const startEpoch = epoch;
        try {
          const [, server] = await Promise.all([loadList(), api.getWorkspace(currentWsId)]);
          // A save finished (or the workspace changed) while we were fetching: this copy may be stale.
          if (epoch !== startEpoch || inflight || get().currentWsId !== currentWsId || !base) return;
          const local = get().ws!;
          const merged = mergeWorkspace(base, local, server);
          base = server;
          epoch++;
          set({ offline: false, ...(merged !== local ? { ws: merged } : {}) });
          if (merged !== local) cacheWrite(boardKey(currentWsId), { ws: merged, base });
        } catch {
          /* stay on what we have; the next poll retries */
        }
      },

      flush() {
        clearTimeout(timer);
        if (inflight) return inflight; // the running save re-checks rev when it finishes
        if (rev === savedRev) return Promise.resolve();
        const { ws } = get();
        if (!ws || !base) return Promise.resolve();

        const sentRev = rev;
        const sentWs = ws;
        const changes = diffToChanges(base, sentWs);
        // Cache before the network call so edits survive a reload even if the save fails. Doing it here
        // (not per edit) keeps drags cheap: this runs once per debounce window, on tab hide, and on retry.
        cacheWrite(boardKey(ws.id), { ws: sentWs, base });
        if (changes.length === 0) {
          savedRev = sentRev;
          set({ save: 'saved' });
          return Promise.resolve();
        }

        set({ save: 'saving' });
        inflight = (async () => {
          try {
            const result = await api.applyChanges(ws.id, changes);
            savedRev = Math.max(savedRev, sentRev);
            if (get().currentWsId === ws.id) {
              // Three-way merge: our edits made while the request was in flight stay, everything else
              // (including notes added elsewhere) comes from the server's reply.
              const merged = mergeWorkspace(sentWs, get().ws!, result.workspace);
              base = result.workspace;
              epoch++;
              set({ ws: merged, offline: false });
              cacheWrite(boardKey(ws.id), { ws: merged, base });
            }
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
          adopt(await api.getWorkspace(id));
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
          adopt(created);
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
          if (id === get().currentWsId) adopt(await api.getWorkspace(list.currentWorkspaceId));
        } catch (err) {
          set({ notice: `Could not delete workspace: ${message(err)}` });
        }
      },

      async exportWorkspace() {
        const { currentWsId, ws } = get();
        if (!currentWsId || !ws) return null;
        await get().flush();
        try {
          const json = await api.exportWorkspace(currentWsId);
          const note = get().save === 'error' ? ' (some recent edits were not saved yet and are not included)' : '';
          set({ notice: `Exported "${ws.name}"${note}` });
          return { filename: exportFilename(ws.name), json };
        } catch (err) {
          set({ notice: `Could not export: ${message(err)}` });
          return null;
        }
      },

      async importWorkspace(text) {
        let payload: unknown;
        try {
          payload = JSON.parse(text);
        } catch {
          return { ok: false, error: 'That is not valid JSON. Choose a file exported from DarkNotes.' };
        }
        await get().flush(); // never switch away from unsaved edits
        if (get().save === 'error') return { ok: false, error: 'Your recent edits are not saved yet. Wait for “Saved”, then try again.' };
        try {
          const result = await api.importWorkspace(payload);
          await loadList();
          adopt(result.workspace);
          void api.activateWorkspace(result.workspace.id).catch(() => {});
          const { notes, groups, connections } = result.imported;
          const skipped = result.skipped.connections;
          set({
            notice:
              `Imported "${result.workspace.name}": ${notes} note${notes === 1 ? '' : 's'}, ${groups} group${groups === 1 ? '' : 's'}, ` +
              `${connections} connection${connections === 1 ? '' : 's'}` +
              (skipped ? ` (${skipped} connection${skipped === 1 ? '' : 's'} skipped: not matched to a note in the file)` : ''),
          });
          return { ok: true };
        } catch (err) {
          return { ok: false, error: message(err) };
        }
      },

      addNote(init = {}) {
        const { ws } = get();
        if (!ws) return null;
        const id = uniqueId('n', ws.notes);
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
          ...DEFAULT_NOTE_STYLE,
          groupId: null,
          zIndex: top + 1,
          ...init,
        };
        edit((w) => ({ ...w, notes: { ...w.notes, [id]: note } }));
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

      duplicateNote(id) {
        const src = get().ws?.notes[id];
        if (!src) return null;
        return get().addNote({
          ...src,
          heading: `${src.heading} (copy)`,
          lines: src.lines.map((l) => ({ ...l })),
          labels: [...src.labels],
          x: src.x + 30,
          y: src.y + 30,
          groupId: null,
        } as Partial<Omit<Note, 'id'>>);
      },

      addGroup(init = {}) {
        const { ws } = get();
        if (!ws) return null;
        const id = uniqueId('g', ws.groups);
        const group: Group = {
          id,
          name: 'Group',
          x: 60,
          y: 60,
          w: 460,
          h: 320,
          color: pickGroupColor(ws.groups),
          minimized: false,
          ...init,
        };
        edit((w) => ({ ...w, groups: { ...w.groups, [id]: group } }));
        return id;
      },

      updateGroup(id, patch) {
        edit((ws) => {
          const g = ws.groups[id];
          return g ? { ...ws, groups: { ...ws.groups, [id]: { ...g, ...patch } } } : ws;
        });
      },

      moveGroup(id, pos, noteOffsets) {
        edit((ws) => {
          const g = ws.groups[id];
          if (!g) return ws;
          const notes = { ...ws.notes };
          for (const [nid, { dx, dy }] of Object.entries(noteOffsets)) {
            const n = notes[nid];
            if (n) notes[nid] = { ...n, x: pos.x + dx, y: pos.y + dy };
          }
          return { ...ws, notes, groups: { ...ws.groups, [id]: { ...g, x: pos.x, y: pos.y } } };
        });
      },

      deleteGroup(id) {
        edit((ws) => {
          if (!ws.groups[id]) return ws;
          const { [id]: _removed, ...groups } = ws.groups;
          const notes = Object.fromEntries(
            Object.entries(ws.notes).map(([nid, n]) => [nid, n.groupId === id ? { ...n, groupId: null } : n]),
          );
          return { ...ws, groups, notes };
        });
      },

      setNoteGroup(noteId, groupId) {
        edit((ws) => {
          const note = ws.notes[noteId];
          if (!note) return ws;
          if (groupId === null) {
            return note.groupId === null ? ws : { ...ws, notes: { ...ws.notes, [noteId]: { ...note, groupId: null } } };
          }
          const group = ws.groups[groupId];
          if (!group) return ws;
          const moved = placementInGroup(note, group);
          return { ...ws, notes: { ...ws.notes, [noteId]: { ...note, groupId, ...(moved ?? {}) } } };
        });
      },

      addConnection(c) {
        const { ws } = get();
        if (!ws || c.fromNote === c.toNote || !ws.notes[c.fromNote] || !ws.notes[c.toNote]) return null;
        if (isDuplicateConnection(ws.connections, c)) return null;
        const id = uniqueId('c', ws.connections);
        const conn: Connection = { id, ...c, arrows: 'none' };
        edit((w) => ({ ...w, connections: { ...w.connections, [id]: conn } }));
        return id;
      },

      deleteConnection(id) {
        edit((ws) => {
          if (!ws.connections[id]) return ws;
          const { [id]: _removed, ...connections } = ws.connections;
          return { ...ws, connections };
        });
      },

      setConnectionArrows(id, arrows) {
        edit((ws) => {
          const c = ws.connections[id];
          if (!c || (c.arrows ?? 'none') === arrows) return ws;
          return { ...ws, connections: { ...ws.connections, [id]: { ...c, arrows } } };
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
}

export type BoardStore = ReturnType<typeof createBoardStore>;
