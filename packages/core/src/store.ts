/**
 * DarkNotes data store: reads and writes <dataDir>/data.json.
 *
 * Differences from the legacy store.js (see tests/characterization.test.mjs):
 *  - writes are atomic (temp file + fsync + rename) and keep a data.json.bak of the previous version
 *  - a corrupt data file is never replaced by defaults: it is copied aside and an error is thrown
 *  - missing/stale id counters are repaired on load so ids can never be reused
 *  - the data dir is resolved per call (DARKNOTES_DATA_DIR, default ~/.darknotes), not at import time
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Connection, DarknotesData, Group, Note, Workspace } from './types';

export class CorruptDataError extends Error {
  constructor(
    readonly dataFile: string,
    readonly preservedAt: string,
    cause: unknown,
  ) {
    super(
      `Data file ${dataFile} is not valid JSON. It was left untouched and a copy saved to ${preservedAt}. ` +
        `Fix or restore it (a previous version may be in ${dataFile}.bak) and retry.`,
      { cause },
    );
    this.name = 'CorruptDataError';
  }
}

export function getDataPaths() {
  const dir = process.env.DARKNOTES_DATA_DIR || path.join(os.homedir(), '.darknotes');
  const file = path.join(dir, 'data.json');
  return { dir, file, backup: `${file}.bak` };
}

/** Browser board sync uses arrays; MCP/API tools use id-keyed objects. */
export function collectionToMap<T extends { id: string }>(
  coll: T[] | Record<string, T> | null | undefined,
): Record<string, T> {
  if (!coll) return {};
  if (Array.isArray(coll)) {
    const map: Record<string, T> = {};
    for (const item of coll) {
      if (item?.id) map[item.id] = item;
    }
    return map;
  }
  return { ...coll };
}

/** Highest numeric suffix among ids like `n_12`; 0 if none. */
function maxIdNumber(ids: Iterable<string>, prefix: string): number {
  let max = 0;
  for (const id of ids) {
    if (!id.startsWith(`${prefix}_`)) continue;
    const n = Number(id.slice(prefix.length + 1));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return max;
}

function repairCounter(current: unknown, ids: Iterable<string>, prefix: string): number {
  const floor = maxIdNumber(ids, prefix) + 1;
  return typeof current === 'number' && Number.isFinite(current) && current >= floor ? current : floor;
}

export function normalizeWorkspace(ws: Workspace): Workspace {
  ws.notes = collectionToMap<Note>(ws.notes);
  ws.groups = collectionToMap<Group>(ws.groups);
  ws.connections = collectionToMap<Connection>(ws.connections);
  ws.nextNoteId = repairCounter(ws.nextNoteId, Object.keys(ws.notes), 'n');
  ws.nextGroupId = repairCounter(ws.nextGroupId, Object.keys(ws.groups), 'g');
  ws.nextConnectionId = repairCounter(ws.nextConnectionId, Object.keys(ws.connections), 'c');
  return ws;
}

export function normalizeData(data: DarknotesData): DarknotesData {
  data.workspaces ??= {};
  for (const ws of Object.values(data.workspaces)) normalizeWorkspace(ws);
  data.nextWorkspaceId = repairCounter(data.nextWorkspaceId, Object.keys(data.workspaces), 'ws');
  if (!data.workspaces[data.currentWorkspaceId]) {
    data.currentWorkspaceId = Object.keys(data.workspaces)[0] ?? '';
  }
  return data;
}

export function defaultData(): DarknotesData {
  const wsId = 'ws_1';
  return {
    workspaces: {
      [wsId]: {
        id: wsId,
        name: 'My Workspace',
        notes: {},
        groups: {},
        connections: {},
        boardOffsetX: 0,
        boardOffsetY: 0,
        boardZoom: 1,
        nextNoteId: 1,
        nextGroupId: 1,
        nextConnectionId: 1,
      },
    },
    currentWorkspaceId: wsId,
    nextWorkspaceId: 2,
  };
}

/**
 * Missing file -> fresh defaults (not written until the first writeData).
 * Unreadable/invalid file -> CorruptDataError; the file is never overwritten here.
 */
export function readData(): DarknotesData {
  const { file } = getDataPaths();
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return defaultData();
    throw err;
  }
  try {
    return normalizeData(JSON.parse(raw) as DarknotesData);
  } catch (err) {
    const preservedAt = `${file}.corrupt-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    fs.copyFileSync(file, preservedAt);
    throw new CorruptDataError(file, preservedAt, err);
  }
}

export function writeData(data: DarknotesData): void {
  const { dir, file, backup } = getDataPaths();
  fs.mkdirSync(dir, { recursive: true });
  normalizeData(data);
  const json = JSON.stringify(data, null, 2);

  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    const fd = fs.openSync(tmp, 'w');
    try {
      fs.writeSync(fd, json);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    if (fs.existsSync(file)) fs.copyFileSync(file, backup);
    fs.renameSync(tmp, file);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw err;
  }
}

export function getWorkspace(data: DarknotesData, wsId?: string): Workspace | null {
  return data.workspaces[wsId || data.currentWorkspaceId] ?? null;
}

export function nextId(prefix: string, counter: number): string {
  return `${prefix}_${counter}`;
}
