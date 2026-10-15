'use client';

import { create } from 'zustand';
import type { Side } from '@darknotes/core/types';
import type { Point, Snap } from './connection-geometry';

/** Transient interaction state that is never saved (connect-drag in progress, open menus). */
interface UiState {
  connecting: { fromNote: string; fromSide: Side } | null;
  cursor: Point | null; // board coordinates
  snap: Snap | null;
  menu: { connId: string; x: number; y: number } | null; // viewport coordinates
}

export const useUi = create<UiState>()(() => ({ connecting: null, cursor: null, snap: null, menu: null }));
