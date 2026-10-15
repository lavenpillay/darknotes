/**
 * DarkNotes service layer: the single owner of data rules.
 * REST routes and MCP tools are thin adapters over these functions.
 *
 * Every function is synchronous: it reads the data file, mutates, and writes (when it mutates)
 * without yielding, so calls within one Node process cannot interleave.
 * `wsId` is optional everywhere and defaults to the current workspace.
 */

import { DEFAULT_NOTE_STYLE } from './defaults';
import { EXPORT_APP, EXPORT_VERSION } from './export-format';
import { ConflictError, NotFoundError, ValidationError } from './errors';
import {
  boardSchema,
  changesSchema,
  connectionInputSchema,
  groupInputSchema,
  groupPatchSchema,
  lineSchema,
  noteInputSchema,
  notePatchSchema,
  parse,
  workspacePatchSchema,
  type BoardInput,
  type Change,
  type ConnectionInput,
  type GroupInput,
  type GroupPatch,
  type NoteInput,
  type NotePatch,
  type WorkspacePatch,
} from './schemas';
import { collectionToMap, nextId, readData, writeData } from './store';
import type { Connection, DarknotesData, Group, Line, Note, Workspace } from './types';

// ─── helpers ─────────────────────────────────────────────────

function mutate<T>(fn: (data: DarknotesData) => T): T {
  const data = readData();
  const result = fn(data);
  writeData(data);
  return result;
}

function getWs(data: DarknotesData, wsId?: string): Workspace {
  const ws = data.workspaces[wsId || data.currentWorkspaceId];
  if (!ws) throw new NotFoundError('Workspace not found');
  return ws;
}

function getNoteIn(ws: Workspace, noteId: string): Note {
  const note = ws.notes[noteId];
  if (!note) throw new NotFoundError('Note not found');
  return note;
}

function getGroupIn(ws: Workspace, groupId: string): Group {
  const group = ws.groups[groupId];
  if (!group) throw new NotFoundError('Group not found');
  return group;
}

export function bodyToLines(body: string): Line[] {
  return body.split('\n').map((text) => ({ type: 'text', text }));
}

export function noteMatches(note: Note, query: string): boolean {
  const q = query.toLowerCase();
  return (
    !!note.heading?.toLowerCase().includes(q) ||
    (note.lines ?? []).some((l) => l.text?.toLowerCase().includes(q)) ||
    (note.labels ?? []).some((l) => l.toLowerCase().includes(q))
  );
}

function assertGroupExists(ws: Workspace, groupId: string | null | undefined) {
  if (groupId != null) getGroupIn(ws, groupId);
}

// ─── workspaces ──────────────────────────────────────────────

export interface WorkspaceSummary {
  id: string;
  name: string;
  noteCount: number;
  groupCount: number;
  isCurrent: boolean;
}

export function listWorkspaces(): { workspaces: WorkspaceSummary[]; currentWorkspaceId: string } {
  const data = readData();
  return {
    workspaces: Object.values(data.workspaces).map((ws) => ({
      id: ws.id,
      name: ws.name,
      noteCount: Object.keys(ws.notes).length,
      groupCount: Object.keys(ws.groups).length,
      isCurrent: ws.id === data.currentWorkspaceId,
    })),
    currentWorkspaceId: data.currentWorkspaceId,
  };
}

export function getWorkspaceById(wsId?: string): Workspace {
  return getWs(readData(), wsId);
}

export function createWorkspace(name?: string): Workspace {
  return mutate((data) => {
    const id = nextId('ws', data.nextWorkspaceId++);
    const ws: Workspace = {
      id,
      name: (name ?? '').trim() || 'New Workspace',
      notes: {},
      groups: {},
      connections: {},
      boardOffsetX: 0,
      boardOffsetY: 0,
      boardZoom: 1,
      nextNoteId: 1,
      nextGroupId: 1,
      nextConnectionId: 1,
    };
    data.workspaces[id] = ws;
    return ws;
  });
}

export function updateWorkspace(wsId: string, patch: WorkspacePatch): Workspace {
  const p = parse(workspacePatchSchema, patch);
  return mutate((data) => {
    const ws = getWs(data, wsId);
    Object.assign(ws, p);
    return ws;
  });
}

export function renameWorkspace(wsId: string, name: string): Workspace {
  return updateWorkspace(wsId, { name });
}

export function deleteWorkspace(wsId: string): { name: string } {
  return mutate((data) => {
    const ws = getWs(data, wsId);
    if (Object.keys(data.workspaces).length === 1) {
      throw new ConflictError('Cannot delete the last workspace');
    }
    delete data.workspaces[ws.id];
    if (data.currentWorkspaceId === ws.id) {
      data.currentWorkspaceId = Object.keys(data.workspaces)[0]!;
    }
    return { name: ws.name };
  });
}

export function activateWorkspace(wsId: string): { currentWorkspaceId: string } {
  return mutate((data) => {
    const ws = getWs(data, wsId);
    data.currentWorkspaceId = ws.id;
    return { currentWorkspaceId: ws.id };
  });
}

/** Whole-board save from the browser. Collections may arrive as arrays; counters are repaired by the store. */
export function saveBoard(wsId: string, board: BoardInput): void {
  const b = parse(boardSchema, board);
  mutate((data) => {
    const ws = getWs(data, wsId);
    if (b.notes !== undefined) ws.notes = collectionToMap(b.notes) as unknown as Record<string, Note>;
    if (b.groups !== undefined) ws.groups = collectionToMap(b.groups) as unknown as Record<string, Group>;
    if (b.connections !== undefined) {
      ws.connections = collectionToMap(b.connections) as unknown as Record<string, Connection>;
    }
    if (b.boardOffsetX !== undefined) ws.boardOffsetX = b.boardOffsetX;
    if (b.boardOffsetY !== undefined) ws.boardOffsetY = b.boardOffsetY;
    if (b.boardZoom !== undefined) ws.boardZoom = b.boardZoom;
    if (b.nextNoteId !== undefined) ws.nextNoteId = b.nextNoteId;
    if (b.nextGroupId !== undefined) ws.nextGroupId = b.nextGroupId;
    if (b.nextConnectionId !== undefined) ws.nextConnectionId = b.nextConnectionId;
  });
}

// ─── notes ───────────────────────────────────────────────────

export interface NoteFilter {
  search?: string;
  label?: string;
  groupId?: string;
}

export function listNotes(wsId?: string, filter: NoteFilter = {}): Note[] {
  const ws = getWs(readData(), wsId);
  let notes = Object.values(ws.notes);
  if (filter.search) notes = notes.filter((n) => noteMatches(n, filter.search!));
  if (filter.label) notes = notes.filter((n) => (n.labels ?? []).includes(filter.label!));
  if (filter.groupId) notes = notes.filter((n) => n.groupId === filter.groupId);
  return notes;
}

export function getNote(wsId: string | undefined, noteId: string): Note {
  return getNoteIn(getWs(readData(), wsId), noteId);
}

export function createNote(wsId: string | undefined, input: NoteInput): Note {
  const i = parse(noteInputSchema, input);
  return mutate((data) => {
    const ws = getWs(data, wsId);
    assertGroupExists(ws, i.groupId);
    const id = nextId('n', ws.nextNoteId++);
    const note = buildNote(id, i);
    ws.notes[id] = note;
    return note;
  });
}

function buildNote(id: string, i: ReturnType<typeof noteInputSchema.parse>): Note {
  return {
    id,
    heading: i.heading ?? 'New Note',
    lines: (i.lines ?? (i.body ? bodyToLines(i.body) : [{ type: 'text', text: '' }])) as Line[],
    labels: i.labels ?? [],
    x: i.x ?? 100,
    y: i.y ?? 100,
    w: i.w ?? 300,
    h: i.h ?? 220,
    bgColor: i.bgColor ?? DEFAULT_NOTE_STYLE.bgColor,
    fontColor: i.fontColor ?? DEFAULT_NOTE_STYLE.fontColor,
    fontSize: i.fontSize ?? DEFAULT_NOTE_STYLE.fontSize,
    headingFont: i.headingFont ?? DEFAULT_NOTE_STYLE.headingFont,
    headingSize: i.headingSize ?? DEFAULT_NOTE_STYLE.headingSize,
    groupId: i.groupId ?? null,
    zIndex: i.zIndex ?? 10,
  };
}

function applyNotePatch(note: Note, { body, ...p }: ReturnType<typeof notePatchSchema.parse>) {
  for (const [key, value] of Object.entries(p)) {
    if (value !== undefined) (note as unknown as Record<string, unknown>)[key] = value;
  }
  // `body` replaces everything, mirroring the legacy tool (it wins over `lines`).
  if (body !== undefined) note.lines = bodyToLines(body);
}

export function updateNote(wsId: string | undefined, noteId: string, patch: NotePatch): Note {
  const p = parse(notePatchSchema, patch);
  return mutate((data) => {
    const ws = getWs(data, wsId);
    const note = getNoteIn(ws, noteId);
    assertGroupExists(ws, p.groupId);
    applyNotePatch(note, p);
    return note;
  });
}

export function deleteNote(wsId: string | undefined, noteId: string): { heading: string } {
  return mutate((data) => {
    const ws = getWs(data, wsId);
    const note = getNoteIn(ws, noteId);
    delete ws.notes[noteId];
    for (const [cid, c] of Object.entries(ws.connections)) {
      if (c.fromNote === noteId || c.toNote === noteId) delete ws.connections[cid];
    }
    return { heading: note.heading };
  });
}

export function appendToNote(
  wsId: string | undefined,
  noteId: string,
  input: { body?: string; lines?: unknown[] },
): Note {
  const lines = input.lines ? (input.lines.map((l) => parse(lineSchema, l)) as Line[]) : undefined;
  return mutate((data) => {
    const note = getNoteIn(getWs(data, wsId), noteId);
    const extra = lines ?? (input.body ? bodyToLines(input.body) : []);
    note.lines = [...(note.lines ?? []), ...extra];
    return note;
  });
}

export function addLabel(wsId: string | undefined, noteId: string, label: string): string[] {
  return mutate((data) => {
    const note = getNoteIn(getWs(data, wsId), noteId);
    note.labels ??= [];
    if (!note.labels.includes(label)) note.labels.push(label);
    return note.labels;
  });
}

export function removeLabel(wsId: string | undefined, noteId: string, label: string): string[] {
  return mutate((data) => {
    const note = getNoteIn(getWs(data, wsId), noteId);
    note.labels = (note.labels ?? []).filter((l) => l !== label);
    return note.labels;
  });
}

export function checkItem(wsId: string | undefined, noteId: string, lineIndex: number, checked: boolean): Extract<Line, { type: 'check' }> {
  return mutate((data) => {
    const note = getNoteIn(getWs(data, wsId), noteId);
    const line = note.lines?.[lineIndex];
    if (!line) throw new NotFoundError(`No line at index ${lineIndex}`);
    if (line.type !== 'check') throw new ValidationError('Line is not a checklist item');
    line.checked = checked;
    return line;
  });
}

// ─── groups ──────────────────────────────────────────────────

export function listGroups(wsId?: string): Array<Group & { noteCount: number }> {
  const ws = getWs(readData(), wsId);
  const notes = Object.values(ws.notes);
  return Object.values(ws.groups).map((g) => ({
    ...g,
    noteCount: notes.filter((n) => n.groupId === g.id).length,
  }));
}

export function createGroup(wsId: string | undefined, input: GroupInput): Group {
  const i = parse(groupInputSchema, input);
  return mutate((data) => {
    const ws = getWs(data, wsId);
    const id = nextId('g', ws.nextGroupId++);
    const group = buildGroup(id, i);
    ws.groups[id] = group;
    return group;
  });
}

function buildGroup(id: string, i: ReturnType<typeof groupInputSchema.parse>): Group {
  return {
    id,
    name: i.name ?? 'New Group',
    x: i.x ?? 60,
    y: i.y ?? 60,
    w: i.w ?? 460,
    h: i.h ?? 320,
    color: i.color ?? 'rgba(196,82,42,0.08)',
    minimized: i.minimized ?? false,
  };
}

export function updateGroup(wsId: string | undefined, groupId: string, patch: GroupPatch): Group {
  const p = parse(groupPatchSchema, patch);
  return mutate((data) => {
    const group = getGroupIn(getWs(data, wsId), groupId);
    for (const [key, value] of Object.entries(p)) {
      if (value !== undefined) (group as unknown as Record<string, unknown>)[key] = value;
    }
    return group;
  });
}

export function deleteGroup(wsId: string | undefined, groupId: string): { name: string } {
  return mutate((data) => {
    const ws = getWs(data, wsId);
    const group = getGroupIn(ws, groupId);
    for (const n of Object.values(ws.notes)) {
      if (n.groupId === groupId) n.groupId = null;
    }
    delete ws.groups[groupId];
    return { name: group.name };
  });
}

export function addNoteToGroup(wsId: string | undefined, noteId: string, groupId: string): Note {
  return updateNote(wsId, noteId, { groupId });
}

export function removeNoteFromGroup(wsId: string | undefined, noteId: string): Note {
  return updateNote(wsId, noteId, { groupId: null });
}

// ─── connections ─────────────────────────────────────────────

export function listConnections(
  wsId?: string,
): Array<Connection & { fromHeading?: string; toHeading?: string }> {
  const ws = getWs(readData(), wsId);
  return Object.values(ws.connections).map((c) => ({
    ...c,
    fromHeading: ws.notes[c.fromNote]?.heading,
    toHeading: ws.notes[c.toNote]?.heading,
  }));
}

export function createConnection(wsId: string | undefined, input: ConnectionInput): Connection {
  const i = parse(connectionInputSchema, input);
  return mutate((data) => {
    const ws = getWs(data, wsId);
    if (!ws.notes[i.fromNote]) throw new NotFoundError('Source note not found');
    if (!ws.notes[i.toNote]) throw new NotFoundError('Target note not found');
    const id = nextId('c', ws.nextConnectionId++);
    const conn: Connection = { id, ...i };
    ws.connections[id] = conn;
    return conn;
  });
}

export function deleteConnection(wsId: string | undefined, connectionId: string): void {
  mutate((data) => {
    const ws = getWs(data, wsId);
    if (!ws.connections[connectionId]) throw new NotFoundError('Connection not found');
    delete ws.connections[connectionId];
  });
}

// ─── search ──────────────────────────────────────────────────

export interface SearchHit {
  workspaceId: string;
  workspaceName: string;
  note: Note;
}

export function searchNotes(query: string): SearchHit[] {
  if (!query) throw new ValidationError('Missing search query');
  const hits: SearchHit[] = [];
  for (const ws of Object.values(readData().workspaces)) {
    for (const note of Object.values(ws.notes)) {
      if (noteMatches(note, query)) hits.push({ workspaceId: ws.id, workspaceName: ws.name, note });
    }
  }
  return hits;
}

// ─── incremental changes ─────────────────────────────────────

export interface ChangeResult {
  /** Ops that changed something. */
  applied: number;
  /** Ops that were safely ignored, e.g. a patch to a note someone else deleted. */
  skipped: Array<{ index: number; op: string; reason: string }>;
}

/**
 * Apply a batch of edits to one workspace atomically (one read-modify-write).
 *
 * Unlike saveBoard, this never replaces whole collections, so it cannot erase notes, groups or connections
 * that another client added in the meantime. Ops are idempotent and lenient about concurrent edits:
 * creating something that already exists, deleting something already gone, or patching something deleted
 * elsewhere is skipped, not an error. A reference to a group that no longer exists becomes "ungrouped".
 * Invalid input (schema violations) rejects the whole batch before anything is written.
 */
export function applyChanges(wsId: string | undefined, input: { changes: Change[] }): ChangeResult & { workspace: Workspace } {
  const { changes } = parse(changesSchema, input);
  return mutate((data) => {
    const ws = getWs(data, wsId);
    const result: ChangeResult = { applied: 0, skipped: [] };
    const skip = (index: number, op: string, reason: string) => void result.skipped.push({ index, op, reason });
    const knownGroup = (g: string | null | undefined) => (g && ws.groups[g] ? g : null);

    changes.forEach((c, index) => {
      switch (c.op) {
        case 'createNote': {
          if (ws.notes[c.note.id]) return skip(index, c.op, 'exists');
          const note = buildNote(c.note.id, c.note);
          note.groupId = knownGroup(note.groupId);
          ws.notes[note.id] = note;
          break;
        }
        case 'patchNote': {
          const note = ws.notes[c.id];
          if (!note) return skip(index, c.op, 'missing');
          const fields = { ...c.fields };
          if ('groupId' in fields) fields.groupId = knownGroup(fields.groupId);
          applyNotePatch(note, fields);
          break;
        }
        case 'deleteNote': {
          if (!ws.notes[c.id]) return skip(index, c.op, 'missing');
          delete ws.notes[c.id];
          for (const [cid, conn] of Object.entries(ws.connections)) {
            if (conn.fromNote === c.id || conn.toNote === c.id) delete ws.connections[cid];
          }
          break;
        }
        case 'createGroup': {
          if (ws.groups[c.group.id]) return skip(index, c.op, 'exists');
          ws.groups[c.group.id] = buildGroup(c.group.id, c.group);
          break;
        }
        case 'patchGroup': {
          const group = ws.groups[c.id];
          if (!group) return skip(index, c.op, 'missing');
          for (const [key, value] of Object.entries(c.fields)) {
            if (value !== undefined) (group as unknown as Record<string, unknown>)[key] = value;
          }
          break;
        }
        case 'deleteGroup': {
          if (!ws.groups[c.id]) return skip(index, c.op, 'missing');
          for (const n of Object.values(ws.notes)) if (n.groupId === c.id) n.groupId = null;
          delete ws.groups[c.id];
          break;
        }
        case 'createConnection': {
          const { id, ...rest } = c.connection;
          if (ws.connections[id]) return skip(index, c.op, 'exists');
          if (!ws.notes[rest.fromNote] || !ws.notes[rest.toNote]) return skip(index, c.op, 'note missing');
          ws.connections[id] = { id, ...rest };
          break;
        }
        case 'patchConnection': {
          const conn = ws.connections[c.id];
          if (!conn) return skip(index, c.op, 'missing');
          if (c.fields.arrows !== undefined) conn.arrows = c.fields.arrows;
          break;
        }
        case 'deleteConnection': {
          if (!ws.connections[c.id]) return skip(index, c.op, 'missing');
          delete ws.connections[c.id];
          break;
        }
        case 'setView': {
          Object.assign(ws, c.fields);
          break;
        }
      }
      result.applied++;
    });

    return { ...result, workspace: ws };
  });
}

// ─── export / import ─────────────────────────────────────────

/** What an exported workspace file contains. Flat, so the original app's importer can still read it. */
export interface WorkspaceExport {
  app: typeof EXPORT_APP;
  version: number;
  exportedAt: string;
  name: string;
  boardOffsetX: number;
  boardOffsetY: number;
  boardZoom: number;
  notes: Note[];
  groups: Group[];
  connections: Connection[];
}

export function exportWorkspace(wsId?: string): WorkspaceExport {
  const ws = getWs(readData(), wsId);
  return {
    app: EXPORT_APP,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    name: ws.name,
    boardOffsetX: ws.boardOffsetX,
    boardOffsetY: ws.boardOffsetY,
    boardZoom: ws.boardZoom,
    notes: Object.values(ws.notes),
    groups: Object.values(ws.groups),
    connections: Object.values(ws.connections),
  };
}

export interface ImportResult {
  workspace: Workspace;
  imported: { notes: number; groups: number; connections: number };
  /** Connections left out because they were malformed or pointed at a note that is not in the file. */
  skipped: { connections: number };
}

const IMPORT_MAX_ITEMS = 5000;
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const idString = (v: unknown): string | null =>
  typeof v === 'string' && v !== '' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : null;
const listOf = (v: unknown): unknown[] => (Array.isArray(v) ? v : isObject(v) ? Object.values(v) : []);

function parseAt<S extends Parameters<typeof parse>[0]>(label: string, schema: S, value: unknown) {
  try {
    return parse(schema, value);
  } catch (err) {
    throw new ValidationError(`${label}: ${(err as Error).message}`);
  }
}

/**
 * Create a NEW workspace from an exported file. Accepts this app's export, the original app's export (notes
 * without ids, arrays or id-keyed maps) and a bare array of notes. Everything is given fresh ids, so an import can
 * never collide with or change existing workspaces. Notes and groups are validated (a bad field rejects the file);
 * connections that cannot be placed are skipped and counted.
 */
export function importWorkspace(raw: unknown): ImportResult {
  let doc: Record<string, unknown>;
  if (Array.isArray(raw)) doc = { notes: raw };
  else if (isObject(raw)) doc = isObject(raw.workspace) ? raw.workspace : raw;
  else throw new ValidationError('Not a DarkNotes export: expected a JSON object');

  const noteList = listOf(doc.notes);
  const groupList = listOf(doc.groups);
  const connList = listOf(doc.connections);
  if (noteList.length > IMPORT_MAX_ITEMS || groupList.length > IMPORT_MAX_ITEMS || connList.length > IMPORT_MAX_ITEMS) {
    throw new ValidationError(`Too many items: at most ${IMPORT_MAX_ITEMS} notes, groups and connections each`);
  }

  const groups = groupList.map((g, i) => {
    if (!isObject(g)) throw new ValidationError(`groups[${i}]: expected an object`);
    const { id, ...fields } = g;
    return { oldId: idString(id), fields: parseAt(`groups[${i}]`, groupInputSchema, fields) };
  });
  const notes = noteList.map((n, i) => {
    if (!isObject(n)) throw new ValidationError(`notes[${i}]: expected an object`);
    const { id, groupId, ...fields } = n;
    return { oldId: idString(id), oldGroup: idString(groupId), fields: parseAt(`notes[${i}]`, noteInputSchema, fields) };
  });

  return mutate((data) => {
    const wsId = nextId('ws', data.nextWorkspaceId++);
    const groupIds = new Map<string, string>();
    const noteIds = new Map<string, string>();
    const ws: Workspace = {
      id: wsId,
      name: (typeof doc.name === 'string' ? doc.name.trim().slice(0, 200) : '') || 'Imported workspace',
      notes: {},
      groups: {},
      connections: {},
      boardOffsetX: typeof doc.boardOffsetX === 'number' && Number.isFinite(doc.boardOffsetX) ? doc.boardOffsetX : 0,
      boardOffsetY: typeof doc.boardOffsetY === 'number' && Number.isFinite(doc.boardOffsetY) ? doc.boardOffsetY : 0,
      boardZoom:
        typeof doc.boardZoom === 'number' && Number.isFinite(doc.boardZoom) ? Math.min(3, Math.max(0.25, doc.boardZoom)) : 1,
      nextNoteId: notes.length + 1,
      nextGroupId: groups.length + 1,
      nextConnectionId: 1,
    };

    groups.forEach((g, i) => {
      const id = `g_${i + 1}`;
      if (g.oldId && !groupIds.has(g.oldId)) groupIds.set(g.oldId, id);
      ws.groups[id] = buildGroup(id, g.fields);
    });
    notes.forEach((n, i) => {
      const id = `n_${i + 1}`;
      if (n.oldId && !noteIds.has(n.oldId)) noteIds.set(n.oldId, id);
      const note = buildNote(id, n.fields);
      note.groupId = (n.oldGroup && groupIds.get(n.oldGroup)) || null;
      // Files from the original app carry no stacking order: keep file order, later notes on top.
      if (n.fields.zIndex === undefined) note.zIndex = DEFAULT_NOTE_Z + i;
      ws.notes[id] = note;
    });

    let skipped = 0;
    for (const c of connList) {
      if (!isObject(c)) {
        skipped++;
        continue;
      }
      const from = idString(c.fromNote);
      const to = idString(c.toNote);
      const parsed = connectionInputSchema.safeParse({ ...c, fromNote: from ?? '', toNote: to ?? '' });
      const fromId = from ? noteIds.get(from) : undefined;
      const toId = to ? noteIds.get(to) : undefined;
      if (!parsed.success || !fromId || !toId) {
        skipped++;
        continue;
      }
      const id = `c_${ws.nextConnectionId++}`;
      ws.connections[id] = { id, fromNote: fromId, fromSide: parsed.data.fromSide, toNote: toId, toSide: parsed.data.toSide, ...(parsed.data.arrows ? { arrows: parsed.data.arrows } : {}) };
    }

    data.workspaces[wsId] = ws;
    return {
      workspace: ws,
      imported: { notes: notes.length, groups: groups.length, connections: Object.keys(ws.connections).length },
      skipped: { connections: skipped },
    };
  });
}

const DEFAULT_NOTE_Z = 10;
