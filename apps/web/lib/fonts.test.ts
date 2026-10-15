import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_NOTE_STYLE } from '@darknotes/core/defaults';
import { DEFAULT_HEADING_FONT, FONT_CATEGORIES, FONT_OPTIONS, MESLO_FAMILIES, fontCategory, fontFamily, isFontInstalled } from './fonts';

test('the default heading font is MesloLG, shared with core', () => {
  assert.equal(DEFAULT_HEADING_FONT, 'MesloLG');
  assert.equal(DEFAULT_HEADING_FONT, DEFAULT_NOTE_STYLE.headingFont);
  assert.equal(FONT_OPTIONS[0]!.name, 'MesloLG');
});

test('MesloLG maps to its installed spellings, then DM Sans, then a generic sans-serif', () => {
  const stack = fontFamily('MesloLG');
  const parts = stack.split(', ');
  assert.equal(parts[0], "'MesloLGS NF'");
  for (const f of MESLO_FAMILIES) assert.ok(stack.includes(`'${f}'`), f);
  assert.deepEqual(parts.slice(-3), ["'DM Sans'", 'system-ui', 'sans-serif']);
  assert.ok(stack.indexOf("'MesloLG'") < stack.indexOf("'DM Sans'")); // Meslo wins when present
});

test('MesloLG also matches the "for Powerline" family names that macOS lists', () => {
  const stack = fontFamily('MesloLG');
  assert.ok(stack.includes("'Meslo LG S for Powerline'"));
  assert.ok(stack.includes("'Meslo LG M for Powerline'"));
  assert.ok(stack.indexOf("'Meslo LG S for Powerline'") < stack.indexOf("'DM Sans'"));
});

test('other fonts get a generic fallback that matches their category', () => {
  assert.equal(fontFamily('Playfair Display'), "'Playfair Display', serif");
  assert.equal(fontFamily('Raleway'), "'Raleway', sans-serif");
  assert.equal(fontFamily('Space Mono'), "'Space Mono', monospace");
  assert.equal(fontFamily('Caveat'), "'Caveat', cursive");
});

test('unknown or empty names fall back to sans-serif, and cannot break out of the quotes', () => {
  assert.equal(fontFamily('Some Old Font'), "'Some Old Font', sans-serif");
  assert.equal(fontFamily(''), "'DM Sans', sans-serif");
  assert.equal(fontFamily("x'; color: red; font-family: 'y"), "'x; color: red; font-family: y', sans-serif");
});

test('options: unique names, all categories used, lookups work', () => {
  assert.equal(new Set(FONT_OPTIONS.map((f) => f.name)).size, FONT_OPTIONS.length);
  assert.equal(FONT_OPTIONS.length, 20); // MesloLG + the 19 fonts of the original app
  for (const c of FONT_CATEGORIES) assert.ok(FONT_OPTIONS.some((f) => f.category === c), c);
  assert.equal(fontCategory('Lora'), 'Serif');
  assert.equal(fontCategory('Nope'), null);
});

test('isFontInstalled is false outside a browser instead of throwing', () => {
  assert.equal(isFontInstalled(), false);
});
