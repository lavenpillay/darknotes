'use client';

import { useStore } from 'zustand';
import { createMinimapPrefs, type MinimapPrefs } from './minimap-prefs';

function browserStorage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export const minimapPrefs = createMinimapPrefs(browserStorage());

export function useMinimapPrefs<T>(selector: (s: MinimapPrefs) => T): T {
  return useStore(minimapPrefs, selector);
}
