'use client';

import { useStore } from 'zustand';
import { createPaletteStore, type PaletteState } from './palette-store';

function browserStorage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export const paletteStore = createPaletteStore(browserStorage());

export function usePalette<T>(selector: (s: PaletteState) => T): T {
  return useStore(paletteStore, selector);
}
