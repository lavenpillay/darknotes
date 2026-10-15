/** Heading fonts: the options in the Style panel, and how a stored font *name* becomes a CSS font stack. */

import { DEFAULT_NOTE_STYLE } from '@darknotes/core/defaults';

export type FontCategory = 'Default' | 'Serif' | 'Sans' | 'Mono' | 'Display' | 'Script';

export interface FontOption {
  name: string;
  category: FontCategory;
}

/** The default font name stored on new notes. */
export const DEFAULT_HEADING_FONT = DEFAULT_NOTE_STYLE.headingFont;

/**
 * Names MesloLG goes by once installed: Nerd Font builds, Powerlevel10k's "MesloLGS NF", the plain Meslo LG family,
 * and the "for Powerline" builds many terminal setups install (that is how macOS lists them).
 */
export const MESLO_FAMILIES = [
  'MesloLGS NF',
  'MesloLGM Nerd Font',
  'MesloLGS Nerd Font',
  'MesloLGL Nerd Font',
  'MesloLG Nerd Font',
  'Meslo LG S',
  'Meslo LG M',
  'Meslo LG L',
  'Meslo LG S for Powerline',
  'Meslo LG M for Powerline',
  'Meslo LG L for Powerline',
  'Meslo LG S DZ for Powerline',
  'Meslo LG M DZ for Powerline',
  'Meslo LG L DZ for Powerline',
  'MesloLG',
];

const quote = (name: string) => `'${name.replace(/['"\\]/g, '')}'`;

/** MesloLG if the user has it installed, otherwise DM Sans (loaded with the app), otherwise any system sans-serif. */
const MESLO_STACK = [...MESLO_FAMILIES.map(quote), "'DM Sans'", 'system-ui', 'sans-serif'].join(', ');

export const FONT_OPTIONS: FontOption[] = [
  { name: 'MesloLG', category: 'Default' },
  { name: 'Playfair Display', category: 'Serif' },
  { name: 'Lora', category: 'Serif' },
  { name: 'Merriweather', category: 'Serif' },
  { name: 'Libre Baskerville', category: 'Serif' },
  { name: 'Cormorant Garamond', category: 'Serif' },
  { name: 'EB Garamond', category: 'Serif' },
  { name: 'Crimson Text', category: 'Serif' },
  { name: 'Raleway', category: 'Sans' },
  { name: 'Montserrat', category: 'Sans' },
  { name: 'DM Sans', category: 'Sans' },
  { name: 'Josefin Sans', category: 'Sans' },
  { name: 'Space Mono', category: 'Mono' },
  { name: 'Inconsolata', category: 'Mono' },
  { name: 'DM Mono', category: 'Mono' },
  { name: 'Abril Fatface', category: 'Display' },
  { name: 'Pacifico', category: 'Display' },
  { name: 'Dancing Script', category: 'Script' },
  { name: 'Satisfy', category: 'Script' },
  { name: 'Caveat', category: 'Script' },
];

const GENERIC: Record<FontCategory, string> = {
  Default: 'sans-serif',
  Serif: 'serif',
  Sans: 'sans-serif',
  Mono: 'monospace',
  Display: 'serif',
  Script: 'cursive',
};

export const FONT_CATEGORIES: FontCategory[] = ['Default', 'Serif', 'Sans', 'Mono', 'Display', 'Script'];

export function fontCategory(name: string): FontCategory | null {
  return FONT_OPTIONS.find((f) => f.name === name)?.category ?? null;
}

/** CSS `font-family` for a stored heading font name. Unknown names (e.g. from an old data file) fall back to sans-serif. */
export function fontFamily(name: string): string {
  if (name === DEFAULT_HEADING_FONT) return MESLO_STACK;
  const category = fontCategory(name);
  return `${quote(name || 'DM Sans')}, ${category ? GENERIC[category] : 'sans-serif'}`;
}

/** True if the browser can render at least one of these families itself (installed locally, not a webfont). Browser only. */
export function isFontInstalled(families: string[] = MESLO_FAMILIES): boolean {
  if (typeof document === 'undefined') return false;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return false;
  const sample = 'mmmmmmmmmmlli WwQq0O';
  const width = (family: string) => {
    ctx.font = `64px ${family}`;
    return ctx.measureText(sample).width;
  };
  // A font is present if swapping it in changes the width against both of two very different fallbacks.
  const baseMono = width('monospace');
  const baseSerif = width('serif');
  return families.some((f) => width(`${quote(f)}, monospace`) !== baseMono || width(`${quote(f)}, serif`) !== baseSerif);
}
