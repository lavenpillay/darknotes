import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StorageLike } from './board-store';
import { PALETTE_MAX, createPaletteStore } from './palette-store';

const memory = (initial: Record<string, string> = {}): StorageLike & { data: Map<string, string> } => {
  const data = new Map(Object.entries(initial));
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

test('add stores a normalised colour in the right list and persists it', () => {
  const storage = memory();
  const s = createPaletteStore(storage);
  assert.equal(s.getState().add('bg', '#FFAA00'), true);
  assert.equal(s.getState().add('text', 'rgba(10,20,30,0.5)'), true);
  assert.deepEqual([s.getState().bg, s.getState().text], [['#ffaa00'], ['rgba(10,20,30,0.5)']]);
  assert.deepEqual(JSON.parse(storage.data.get('darknotes:v1:palette')!), { bg: ['#ffaa00'], text: ['rgba(10,20,30,0.5)'] });
});

test('add rejects non-colours and duplicates (spelling-insensitive), per list', () => {
  const s = createPaletteStore(memory());
  assert.equal(s.getState().add('bg', 'not a colour'), false);
  assert.equal(s.getState().add('bg', '#abc'), true);
  assert.equal(s.getState().add('bg', '#AABBCC'), false); // same colour as #abc
  assert.equal(s.getState().add('text', '#abc'), true); // the text list is independent
  assert.equal(s.getState().bg.length, 1);
});

test('the oldest colour makes room when a list is full', () => {
  const s = createPaletteStore(memory());
  for (let i = 0; i < PALETTE_MAX + 3; i++) s.getState().add('bg', `#${i.toString(16).padStart(6, '0')}`);
  assert.equal(s.getState().bg.length, PALETTE_MAX);
  assert.equal(s.getState().bg[0], '#000003'); // 0, 1, 2 were dropped
  assert.equal(s.getState().bg.at(-1), `#${(PALETTE_MAX + 2).toString(16).padStart(6, '0')}`);
});

test('remove deletes a colour, persists, and ignores unknown colours', () => {
  const storage = memory();
  const s = createPaletteStore(storage);
  s.getState().add('bg', '#111111');
  s.getState().add('bg', '#222222');
  s.getState().remove('bg', '#111111');
  s.getState().remove('bg', '#999999');
  assert.deepEqual(s.getState().bg, ['#222222']);
  assert.deepEqual(JSON.parse(storage.data.get('darknotes:v1:palette')!).bg, ['#222222']);
});

test('hydrate restores saved colours and drops junk from a damaged value', () => {
  const s = createPaletteStore(memory({ 'darknotes:v1:palette': JSON.stringify({ bg: ['#FF0000', 'zzz', 5, '#ff0000'], text: 'oops' }) }));
  s.getState().hydrate();
  assert.deepEqual([s.getState().bg, s.getState().text], [['#ff0000'], []]);
  const broken = createPaletteStore(memory({ 'darknotes:v1:palette': '{ not json' }));
  broken.getState().hydrate();
  assert.deepEqual(broken.getState().bg, []);
});

test('works with no storage at all (private mode)', () => {
  const s = createPaletteStore(null);
  s.getState().hydrate();
  assert.equal(s.getState().add('bg', '#123456'), true);
  assert.deepEqual(s.getState().bg, ['#123456']);
});
