import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CorruptDataError,
  collectionToMap,
  defaultData,
  getDataPaths,
  readData,
  writeData,
} from './store';
import type { DarknotesData } from './types';

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dn-core-'));
  process.env.DARKNOTES_DATA_DIR = tmp;
});
afterEach(() => {
  delete process.env.DARKNOTES_DATA_DIR;
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('missing file yields defaults without creating anything', () => {
  const d = readData();
  assert.equal(d.currentWorkspaceId, 'ws_1');
  assert.equal(d.nextWorkspaceId, 2);
  assert.equal(fs.readdirSync(tmp).length, 0);
});

test('write/read round trip', () => {
  const d = defaultData();
  d.workspaces.ws_1!.name = 'Renamed';
  writeData(d);
  assert.equal(readData().workspaces.ws_1!.name, 'Renamed');
});

test('writes are atomic: no temp files left, previous version kept as .bak', () => {
  const d = defaultData();
  writeData(d);
  assert.equal(fs.existsSync(getDataPaths().backup), false); // nothing to back up yet
  d.workspaces.ws_1!.name = 'v2';
  writeData(d);
  assert.deepEqual(fs.readdirSync(tmp).sort(), ['data.json', 'data.json.bak']);
  assert.equal(JSON.parse(fs.readFileSync(getDataPaths().backup, 'utf8')).workspaces.ws_1.name, 'My Workspace');
});

test('a failed write leaves the existing file intact and no temp file behind', () => {
  writeData(defaultData());
  const before = fs.readFileSync(getDataPaths().file, 'utf8');
  const circular: any = defaultData();
  circular.self = circular; // JSON.stringify throws
  assert.throws(() => writeData(circular));
  assert.equal(fs.readFileSync(getDataPaths().file, 'utf8'), before);
  assert.deepEqual(fs.readdirSync(tmp).filter((f) => f.endsWith('.tmp')), []);
});

test('corrupt file is never reset: throws, keeps the original, saves a copy', () => {
  const { file } = getDataPaths();
  fs.writeFileSync(file, '{ not json');
  assert.throws(() => readData(), CorruptDataError);
  assert.equal(fs.readFileSync(file, 'utf8'), '{ not json');
  const copies = fs.readdirSync(tmp).filter((f) => f.startsWith('data.json.corrupt-'));
  assert.equal(copies.length, 1);
  assert.equal(fs.readFileSync(path.join(tmp, copies[0]!), 'utf8'), '{ not json');
});

test('legacy array collections are normalised to id-keyed maps', () => {
  assert.deepEqual(Object.keys(collectionToMap([{ id: 'a' }, { id: 'b' }, {} as any])), ['a', 'b']);
  assert.deepEqual(collectionToMap(null), {});
  const d: any = defaultData();
  d.workspaces.ws_1.notes = [{ id: 'n_1' }];
  writeData(d);
  assert.deepEqual(Object.keys(readData().workspaces.ws_1!.notes), ['n_1']);
});

test('missing counters are derived from existing ids', () => {
  const raw: any = {
    workspaces: {
      ws_1: { id: 'ws_1', name: 'a', notes: { n_4: { id: 'n_4' } }, groups: { g_2: { id: 'g_2' } }, connections: {} },
      ws_7: { id: 'ws_7', name: 'b', notes: {}, groups: {}, connections: {} },
    },
    currentWorkspaceId: 'ws_1',
  };
  fs.writeFileSync(getDataPaths().file, JSON.stringify(raw));
  const d = readData();
  assert.equal(d.nextWorkspaceId, 8);
  assert.equal(d.workspaces.ws_1!.nextNoteId, 5);
  assert.equal(d.workspaces.ws_1!.nextGroupId, 3);
  assert.equal(d.workspaces.ws_1!.nextConnectionId, 1);
});

test('a counter lower than the highest existing id is raised (no id reuse)', () => {
  const d: DarknotesData = defaultData();
  d.workspaces.ws_1!.notes = { n_3: { id: 'n_3' } as any };
  d.workspaces.ws_1!.nextNoteId = 1; // stale client PUT /board
  writeData(d);
  assert.equal(readData().workspaces.ws_1!.nextNoteId, 4);
});

test('a counter higher than needed is left alone', () => {
  const d = defaultData();
  d.workspaces.ws_1!.nextNoteId = 50;
  writeData(d);
  assert.equal(readData().workspaces.ws_1!.nextNoteId, 50);
});

test('dangling currentWorkspaceId falls back to the first workspace', () => {
  const d = defaultData();
  d.currentWorkspaceId = 'ws_99';
  writeData(d);
  assert.equal(readData().currentWorkspaceId, 'ws_1');
});
