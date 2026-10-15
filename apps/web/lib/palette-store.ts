/** The user's own colours for the Style panel, kept per browser in localStorage (one list for notes, one for text). */

import { createStore } from 'zustand/vanilla';
import { normalizeColor, sameColor } from './color';
import type { StorageLike } from './board-store';

export type PaletteKind = 'bg' | 'text';
export const PALETTE_MAX = 24;
const KEY = 'darknotes:v1:palette';

export interface PaletteState {
  bg: string[];
  text: string[];
  /** Load saved colours (call once on the client). */
  hydrate(): void;
  /** Returns false if it is not a colour or is already saved. When full, the oldest colour makes room. */
  add(kind: PaletteKind, color: string): boolean;
  remove(kind: PaletteKind, color: string): void;
}

export function createPaletteStore(storage: StorageLike | null = null) {
  const save = (s: Pick<PaletteState, 'bg' | 'text'>) => {
    try {
      storage?.setItem(KEY, JSON.stringify({ bg: s.bg, text: s.text }));
    } catch {
      /* blocked or full: the palette still works for this session */
    }
  };
  const clean = (list: unknown): string[] =>
    Array.isArray(list)
      ? [...new Set(list.map((c) => (typeof c === 'string' ? normalizeColor(c) : null)).filter((c): c is string => !!c))].slice(-PALETTE_MAX)
      : [];

  return createStore<PaletteState>()((set, get) => ({
    bg: [],
    text: [],

    hydrate() {
      try {
        const raw = storage?.getItem(KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as { bg?: unknown; text?: unknown };
        set({ bg: clean(parsed.bg), text: clean(parsed.text) });
      } catch {
        /* unreadable: start empty */
      }
    },

    add(kind, color) {
      const normalized = normalizeColor(color);
      if (!normalized || get()[kind].some((c) => sameColor(c, normalized))) return false;
      const next = [...get()[kind], normalized].slice(-PALETTE_MAX);
      set({ [kind]: next } as Pick<PaletteState, PaletteKind>);
      save(get());
      return true;
    },

    remove(kind, color) {
      const next = get()[kind].filter((c) => !sameColor(c, color));
      if (next.length === get()[kind].length) return;
      set({ [kind]: next } as Pick<PaletteState, PaletteKind>);
      save(get());
    },
  }));
}
