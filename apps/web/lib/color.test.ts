import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrastLevel, contrastRatio, formatColor, hsvToRgb, normalizeColor, parseColor, rgbToHsv, sameColor } from './color';

const near = (a: number, b: number, eps = 0.02) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test('parseColor: hex (3/6/8 digits) and rgb()/rgba()', () => {
  assert.deepEqual(parseColor('#FFF9C4'), { r: 255, g: 249, b: 196, a: 1 });
  assert.deepEqual(parseColor('#fc0'), { r: 255, g: 204, b: 0, a: 1 });
  const withAlpha = parseColor('#00000080')!;
  near(withAlpha.a, 0.5, 0.01);
  assert.deepEqual(parseColor('rgb(1, 2, 3)'), { r: 1, g: 2, b: 3, a: 1 });
  assert.deepEqual(parseColor('rgba(10,20,30,0.55)'), { r: 10, g: 20, b: 30, a: 0.55 });
  assert.deepEqual(parseColor('rgba(10,20,30,.5)'), { r: 10, g: 20, b: 30, a: 0.5 });
});

test('parseColor rejects things that are not colours (and clamps out-of-range channels)', () => {
  for (const bad of ['', 'red', '#12', '#12345', '#gggggg', 'rgb(1,2)', 'javascript:alert(1)']) assert.equal(parseColor(bad), null, bad);
  assert.deepEqual(parseColor('rgb(300,0,0)'), { r: 255, g: 0, b: 0, a: 1 });
});

test('formatColor: opaque -> lowercase hex, translucent -> rgba with 2 decimals', () => {
  assert.equal(formatColor({ r: 255, g: 249, b: 196, a: 1 }), '#fff9c4');
  assert.equal(formatColor({ r: 10, g: 20, b: 30, a: 0.555 }), 'rgba(10,20,30,0.56)');
  assert.equal(formatColor({ r: 0, g: 0, b: 0, a: 1 }), '#000000');
});

test('normalizeColor / sameColor compare colours, not spellings', () => {
  assert.equal(normalizeColor('#FFF'), '#ffffff');
  assert.equal(normalizeColor('rgb(255,255,255)'), '#ffffff');
  assert.equal(normalizeColor('nope'), null);
  assert.equal(sameColor('#FFF9C4', '#fff9c4'), true);
  assert.equal(sameColor('#fff', 'rgba(255,255,255,1)'), true);
  assert.equal(sameColor('#fff', '#fffffe'), false);
  assert.equal(sameColor('nope', 'nope'), false);
});

test('hsv <-> rgb round trip', () => {
  assert.deepEqual(hsvToRgb(0, 100, 100), [255, 0, 0]);
  assert.deepEqual(hsvToRgb(120, 100, 100), [0, 255, 0]);
  assert.deepEqual(hsvToRgb(0, 0, 100), [255, 255, 255]);
  for (const [r, g, b] of [[255, 249, 196], [44, 62, 80], [192, 57, 43], [0, 0, 0]] as const) {
    const [h, s, v] = rgbToHsv(r, g, b);
    const [r2, g2, b2] = hsvToRgb(h, s, v);
    assert.ok(Math.abs(r - r2) <= 1 && Math.abs(g - g2) <= 1 && Math.abs(b - b2) <= 1, `${r},${g},${b}`);
  }
});

test('contrastRatio: known WCAG values', () => {
  near(contrastRatio('#000000', '#ffffff')!, 21, 0.01);
  near(contrastRatio('#ffffff', '#ffffff')!, 1, 0.001);
  near(contrastRatio('#767676', '#ffffff')!, 4.54, 0.02); // the classic AA threshold grey
  near(contrastRatio('#2c3e50', '#E3F2FD')!, 9.6, 0.1); // the colours in the mockup
  assert.equal(contrastRatio('#fff', '#fff'), contrastRatio('#ffffff', '#ffffff'));
});

test('contrastRatio blends translucent colours (note over the board, text over the note)', () => {
  // a fully transparent note shows the board colour, so black text there is just black on #f5f0e8
  near(contrastRatio('#000000', 'rgba(255,0,0,0)')!, contrastRatio('#000000', '#f5f0e8')!, 0.001);
  // half-transparent black text on white is mid grey (#808080), well below black on white
  const r = contrastRatio('rgba(0,0,0,0.5)', '#ffffff', '#ffffff')!;
  assert.ok(r > 3 && r < 5, String(r));
  assert.equal(contrastRatio('nope', '#fff'), null);
});

test('contrastLevel thresholds are 7 and 4.5', () => {
  assert.deepEqual([contrastLevel(7), contrastLevel(6.99), contrastLevel(4.5), contrastLevel(4.49)], ['good', 'ok', 'ok', 'low']);
});

import { BODY_FONT_SIZES, NOTE_COLOR_PRESETS, TEXT_COLOR_PRESETS, stepBodySize } from './color-presets';

test('presets: 20 note colours and 10 text colours, all valid and unique', () => {
  assert.equal(NOTE_COLOR_PRESETS.length, 20);
  assert.equal(TEXT_COLOR_PRESETS.length, 10);
  for (const list of [NOTE_COLOR_PRESETS, TEXT_COLOR_PRESETS]) {
    assert.equal(new Set(list.map((c) => normalizeColor(c))).size, list.length);
    for (const c of list) assert.ok(parseColor(c), c);
  }
});

test('stepBodySize walks the size list and stops at the ends', () => {
  assert.equal(stepBodySize(14, 1), 15);
  assert.equal(stepBodySize(14, -1), 13);
  assert.equal(stepBodySize(16, 1), 18);
  assert.equal(stepBodySize(24, 1), 24);
  assert.equal(stepBodySize(11, -1), 11);
  assert.equal(stepBodySize(17, 1), 18); // off-list: the neighbour on that side
  assert.equal(stepBodySize(17, -1), 16);
  assert.equal(stepBodySize(100, -1), 24);
  assert.deepEqual(BODY_FONT_SIZES.length, 9);
});
