/**
 * DarkNotes Data Store
 * Reads and writes ~/.darknotes/data.json
 * All data lives in a single JSON file structured as:
 * {
 *   workspaces: { [id]: { id, name, notes: {}, groups: {}, connections: {}, boardOffsetX, boardOffsetY, boardZoom } },
 *   currentWorkspaceId: string,
 *   nextIds: { workspace, note, group, connection }
 * }
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const DATA_DIR  = path.join(os.homedir(), '.darknotes');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function readData() {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) return defaultData();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return defaultData();
  }
}

export function writeData(data) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

export function defaultData() {
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
      }
    },
    currentWorkspaceId: wsId,
    nextWorkspaceId: 2,
  };
}

export function getWorkspace(data, wsId) {
  const id = wsId || data.currentWorkspaceId;
  return data.workspaces[id] || null;
}

export function nextId(prefix, counter) {
  return `${prefix}_${counter}`;
}
