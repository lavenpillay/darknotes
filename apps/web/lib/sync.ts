/**
 * Incremental sync between the browser's board and the server.
 *
 *  - `diffToChanges(base, local)`: what the user changed since the last sync, as small idempotent ops.
 *  - `mergeWorkspace(base, local, server)`: three-way merge. Anything the server has that we did not touch is
 *    taken from the server (so notes Claude adds via MCP appear); anything we changed locally is kept.
 *
 * `base` is always the last server state we saw. Both functions are pure.
 */

import type { Change, Connection, Group, Note, Workspace } from '@darknotes/core/types';

const NOTE_FIELDS = [
  'heading', 'lines', 'labels', 'x', 'y', 'w', 'h', 'bgColor', 'fontColor', 'fontSize', 'headingFont',
  'headingSize', 'groupId', 'zIndex',
] as const;
const GROUP_FIELDS = ['name', 'x', 'y', 'w', 'h', 'color', 'minimized'] as const;
const VIEW_FIELDS = ['boardOffsetX', 'boardOffsetY', 'boardZoom'] as const;

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

type Rec = Record<string, unknown>;

function changedFields<T extends object>(base: T, local: T, fields: readonly string[]): Rec {
  const out: Rec = {};
  for (const f of fields) {
    const l = (local as Rec)[f];
    if (!deepEqual((base as Rec)[f], l)) out[f] = l;
  }
  return out;
}

const pickFields = (o: object, fields: readonly string[]): Rec =>
  Object.fromEntries(fields.filter((f) => (o as Rec)[f] !== undefined).map((f) => [f, (o as Rec)[f]]));

/** Ops are ordered so every reference exists when it is used: groups, notes, connections, patches, deletes. */
export function diffToChanges(base: Workspace, local: Workspace): Change[] {
  const creates: Change[] = [];
  const patches: Change[] = [];
  const deletes: Change[] = [];

  for (const g of Object.values(local.groups)) {
    const b = base.groups[g.id];
    if (!b) creates.push({ op: 'createGroup', group: { id: g.id, ...pickFields(g, GROUP_FIELDS) } });
    else {
      const fields = changedFields(b, g, GROUP_FIELDS);
      if (Object.keys(fields).length) patches.push({ op: 'patchGroup', id: g.id, fields });
    }
  }
  for (const n of Object.values(local.notes)) {
    const b = base.notes[n.id];
    if (!b) creates.push({ op: 'createNote', note: { id: n.id, ...pickFields(n, NOTE_FIELDS) } });
    else {
      const fields = changedFields(b, n, NOTE_FIELDS);
      if (Object.keys(fields).length) patches.push({ op: 'patchNote', id: n.id, fields });
    }
  }
  for (const c of Object.values(local.connections)) {
    const b = base.connections[c.id];
    if (!b) creates.push({ op: 'createConnection', connection: c });
    else if ((b.arrows ?? 'none') !== (c.arrows ?? 'none')) {
      patches.push({ op: 'patchConnection', id: c.id, fields: { arrows: c.arrows ?? 'none' } });
    }
  }

  for (const c of Object.values(base.connections)) if (!local.connections[c.id]) deletes.push({ op: 'deleteConnection', id: c.id });
  for (const n of Object.values(base.notes)) if (!local.notes[n.id]) deletes.push({ op: 'deleteNote', id: n.id });
  for (const g of Object.values(base.groups)) if (!local.groups[g.id]) deletes.push({ op: 'deleteGroup', id: g.id });

  const view = changedFields(base, local, VIEW_FIELDS);
  const setView: Change[] = Object.keys(view).length ? [{ op: 'setView', fields: view }] : [];

  return [...creates, ...patches, ...setView, ...deletes];
}

/** Field-level three-way merge of one entity. Returns `local` itself when nothing from the server differs. */
function mergeEntity<T extends { id: string }>(base: T | undefined, local: T, server: T): T {
  const merged: Rec = { ...(server as Rec) };
  for (const key of new Set([...Object.keys(local), ...Object.keys(server)])) {
    const l = (local as Rec)[key];
    // Keep our value when we changed it since `base` (a locally created entity has no base: all ours).
    if (!base || !deepEqual((base as Rec)[key], l)) merged[key] = l;
  }
  return deepEqual(merged, local) ? local : (merged as T);
}

function mergeCollection<T extends { id: string }>(
  base: Record<string, T>,
  local: Record<string, T>,
  server: Record<string, T>,
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const id of new Set([...Object.keys(local), ...Object.keys(server)])) {
    const b = base[id];
    const l = local[id];
    const s = server[id];
    if (l && s) out[id] = mergeEntity(b, l, s);
    else if (l && !b) out[id] = l; // created here, not yet on the server
    else if (s && !b) out[id] = s; // created elsewhere (e.g. by Claude over MCP)
    // else: deleted on one side. A delete wins over an edit on the other side.
  }
  const sameShape =
    Object.keys(out).length === Object.keys(local).length && Object.keys(out).every((id) => out[id] === local[id]);
  return sameShape ? local : out;
}

export function mergeWorkspace(base: Workspace, local: Workspace, server: Workspace): Workspace {
  const notes = mergeCollection<Note>(base.notes, local.notes, server.notes);
  const groups = mergeCollection<Group>(base.groups, local.groups, server.groups);
  let connections = mergeCollection<Connection>(base.connections, local.connections, server.connections);

  // Repair references that a deletion on either side may have left dangling.
  let fixedNotes = notes;
  for (const n of Object.values(notes)) {
    if (n.groupId && !groups[n.groupId]) {
      if (fixedNotes === notes) fixedNotes = { ...notes };
      fixedNotes[n.id] = { ...n, groupId: null };
    }
  }
  const live = Object.values(connections).filter((c) => fixedNotes[c.fromNote] && fixedNotes[c.toNote]);
  if (live.length !== Object.keys(connections).length) connections = Object.fromEntries(live.map((c) => [c.id, c]));

  const view: Rec = {};
  for (const f of VIEW_FIELDS) view[f] = deepEqual(base[f], local[f]) ? server[f] : local[f];

  const merged: Workspace = { ...local, name: server.name, notes: fixedNotes, groups, connections, ...(view as object) };
  const same =
    merged.name === local.name &&
    merged.notes === local.notes &&
    merged.groups === local.groups &&
    merged.connections === local.connections &&
    VIEW_FIELDS.every((f) => merged[f] === local[f]);
  return same ? local : merged;
}
