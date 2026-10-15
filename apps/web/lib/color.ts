/** Colour parsing, conversion and contrast. Pure, no DOM. Colours are CSS strings: #rgb, #rrggbb, #rrggbbaa, rgb(), rgba(). */

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const hex2 = (v: number) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');

export function parseColor(input: string): Rgba | null {
  const s = input.trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) {
    const [r, g, b] = m[1]!.split('').map((c) => parseInt(c + c, 16));
    return { r: r!, g: g!, b: b!, a: 1 };
  }
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(s);
  if (m) {
    const n = parseInt(m[1]!, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
  }
  m = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(\d*\.?\d+)\s*)?\)$/.exec(s);
  if (m) {
    return { r: clamp(+m[1]!, 0, 255), g: clamp(+m[2]!, 0, 255), b: clamp(+m[3]!, 0, 255), a: m[4] !== undefined ? clamp(+m[4], 0, 1) : 1 };
  }
  return null;
}

/** Opaque colours become `#rrggbb`; translucent ones `rgba(r,g,b,a)` (alpha to 2 decimals). */
export function formatColor({ r, g, b, a }: Rgba): string {
  if (a >= 1) return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${Math.round(clamp(a, 0, 1) * 100) / 100})`;
}

/** Canonical form for comparing and de-duplicating colours; null if it is not a colour. */
export function normalizeColor(input: string): string | null {
  const c = parseColor(input);
  return c ? formatColor(c) : null;
}

export function sameColor(a: string, b: string): boolean {
  const x = normalizeColor(a);
  return x !== null && x === normalizeColor(b);
}

/** h 0-360, s and v 0-100 -> r, g, b 0-255. */
export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const sat = s / 100;
  const val = v / 100;
  const k = (n: number) => (n + h / 60) % 6;
  const f = (n: number) => val - val * sat * Math.max(0, Math.min(k(n), 4 - k(n), 1));
  return [Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255)];
}

export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const d = max - Math.min(rn, gn, bn);
  let h = 0;
  if (d) {
    if (max === rn) h = ((gn - bn) / d + 6) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }
  return [h, max ? (d / max) * 100 : 0, max * 100];
}

const linear = (c: number) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
export const luminance = ({ r, g, b }: Rgba) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

/** Blend a possibly translucent colour over an opaque one. */
export function compositeOver(fg: Rgba, bg: Rgba): Rgba {
  return {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  };
}

/**
 * WCAG contrast ratio (1 to 21) of text on a note. A translucent note colour is blended over `backdrop`
 * (the board), and translucent text over the note. Null if either colour cannot be parsed.
 */
export function contrastRatio(textColor: string, noteColor: string, backdrop = '#f5f0e8'): number | null {
  const text = parseColor(textColor);
  const note = parseColor(noteColor);
  const back = parseColor(backdrop);
  if (!text || !note || !back) return null;
  const noteOpaque = compositeOver(note, { ...back, a: 1 });
  const textOpaque = compositeOver(text, noteOpaque);
  const a = luminance(textOpaque);
  const b = luminance(noteOpaque);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export type ContrastLevel = 'good' | 'ok' | 'low';
/** AAA body text is 7, AA is 4.5. */
export const contrastLevel = (ratio: number): ContrastLevel => (ratio >= 7 ? 'good' : ratio >= 4.5 ? 'ok' : 'low');
