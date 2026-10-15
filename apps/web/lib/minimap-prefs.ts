/** The minimap's size and collapsed state, remembered per browser. */

import { createStore } from 'zustand/vanilla';
import type { StorageLike } from './board-store';
import { MAP_DEFAULT_W, clampMapWidth } from './minimap-geometry';

const KEY = 'darknotes:v1:minimap';

export interface MinimapPrefs {
  width: number;
  /** Mini-mode: a small thumbnail instead of the full, resizable map. */
  collapsed: boolean;
  hydrate(): void;
  setWidth(width: number): void;
  setCollapsed(collapsed: boolean): void;
}

export function createMinimapPrefs(storage: StorageLike | null = null) {
  const save = (s: Pick<MinimapPrefs, 'width' | 'collapsed'>) => {
    try {
      storage?.setItem(KEY, JSON.stringify({ width: s.width, collapsed: s.collapsed }));
    } catch {
      /* blocked or full: the preference just lasts for this session */
    }
  };
  return createStore<MinimapPrefs>()((set, get) => ({
    width: MAP_DEFAULT_W,
    collapsed: false,
    hydrate() {
      try {
        const raw = storage?.getItem(KEY);
        if (!raw) return;
        const p = JSON.parse(raw) as { width?: unknown; collapsed?: unknown };
        set({
          width: typeof p.width === 'number' ? clampMapWidth(p.width) : MAP_DEFAULT_W,
          collapsed: p.collapsed === true,
        });
      } catch {
        /* unreadable: keep the defaults */
      }
    },
    setWidth(width) {
      set({ width: clampMapWidth(width) });
      save(get());
    },
    setCollapsed(collapsed) {
      set({ collapsed });
      save(get());
    },
  }));
}
