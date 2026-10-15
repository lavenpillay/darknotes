/**
 * DarkNotes service layer: the single owner of data rules.
 * REST routes and MCP tools are thin adapters over these functions.
 *
 * Every function is synchronous: it reads the data file, mutates, and writes (when it mutates)
 * without yielding, so calls within one Node process cannot interleave.
 * `wsId` is optional everywhere and defaults to the current workspace.
 */

import { ConflictError, NotFoundError, ValidationError } from './errors';
import {
  boardSchema,
  connectionInputSchema,
  groupInputSchema,
  groupPatchSchema,
  lineSchema,
  noteInputSchema,
  notePatchSchema,
  parse,
  workspacePatchSchema,
  type BoardInput,
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
    const note: Note = {
      id,
      heading: i.heading ?? 'New Note',
      lines: (i.lines ?? (i.body ? bodyToLines(i.body) : [{ type: 'text', text: '' }])) as Line[],
      labels: i.labels ?? [],
      x: i.x ?? 100,
      y: i.y ?? 100,
      w: i.w ?? 300,
      h: i.h ?? 220,
      bgColor: i.bgColor ?? '#FFF9C4',
      fontColor: i.fontColor ?? '#1a1612',
      fontSize: i.fontSize ?? 14,
      headingFont: i.headingFont ?? 'Playfair Display',
      headingSize: i.headingSize ?? 17,
      groupId: i.groupId ?? null,
      zIndex: i.zIndex ?? 10,
    };
    ws.notes[id] = note;
    return note;
  });
}

export function updateNote(wsId: string | undefined, noteId: string, patch: NotePatch): Note {
  const { body, ...p } = parse(notePatchSchema, patch);
  return mutate((data) => {
    const ws = getWs(data, wsId);
    const note = getNoteIn(ws, noteId);
    assertGroupExists(ws, p.groupId);
    for (const [key, value] of Object.entries(p)) {
      if (value !== undefined) (note as unknown as Record<string, unknown>)[key] = value;
    }
    // `body` replaces everything, mirroring the legacy tool (it wins over `lines`).
    if (body !== undefined) note.lines = bodyToLines(body);
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
    const group: Group = {
      id,
      name: i.name ?? 'New Group',
      x: i.x ?? 60,
      y: i.y ?? 60,
      w: i.w ?? 460,
      h: i.h ?? 320,
      color: i.color ?? 'rgba(196,82,42,0.08)',
      minimized: i.minimized ?? false,
    };
    ws.groups[id] = group;
    return group;
  });
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
