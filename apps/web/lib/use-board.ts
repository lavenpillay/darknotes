'use client';

import { useStore } from 'zustand';
import { createApi } from './api';
import { createBoardStore, type BoardState, type StorageLike } from './board-store';

function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null; // blocked (private mode, disabled site data)
  }
}

/** One store per page load. It does nothing until `init()` is called from an effect. */
export const boardStore = createBoardStore({ api: createApi(), storage: browserStorage() });

export function useBoard<T>(selector: (s: BoardState) => T): T {
  return useStore(boardStore, selector);
}
