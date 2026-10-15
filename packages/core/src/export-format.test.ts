import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXPORT_APP, EXPORT_VERSION, exportFilename } from './export-format';

test('exportFilename: darknotes-<safe name>-<date>.json', () => {
  const d = new Date('2026-10-15T20:00:00Z');
  assert.equal(exportFilename('My Workspace', d), 'darknotes-my_workspace-2026-10-15.json');
  assert.equal(exportFilename('Finland/Tuska 2026', d), 'darknotes-finland_tuska_2026-2026-10-15.json');
  assert.equal(exportFilename('  --Odd!!  ', d), 'darknotes-odd-2026-10-15.json');
});

test('exportFilename falls back for empty or non-latin names', () => {
  const d = new Date('2026-01-02T00:00:00Z');
  assert.equal(exportFilename('', d), 'darknotes-workspace-2026-01-02.json');
  assert.equal(exportFilename('日本語', d), 'darknotes-workspace-2026-01-02.json');
});

test('format constants', () => {
  assert.deepEqual([EXPORT_APP, EXPORT_VERSION], ['darknotes', 1]);
});
