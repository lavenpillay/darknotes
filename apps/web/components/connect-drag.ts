import type { Side } from '@darknotes/core/types';
import { findSnap } from '@/lib/connection-geometry';
import { boardStore } from '@/lib/use-board';
import { useUi } from '@/lib/ui-store';
import { boardPointFromClient } from './Board';

/** Drag from a note's edge dot; releasing near another note's dot creates the connection. */
export function startConnect(fromNote: string, fromSide: Side) {
  useUi.setState({ connecting: { fromNote, fromSide }, cursor: null, snap: null, menu: null });

  const onMove = (e: PointerEvent) => {
    const ws = boardStore.getState().ws;
    if (!ws) return;
    const cursor = boardPointFromClient(e.clientX, e.clientY);
    useUi.setState({ cursor, snap: findSnap(ws.notes, fromNote, cursor) });
  };

  const finish = (commit: boolean) => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    const { snap } = useUi.getState();
    useUi.setState({ connecting: null, cursor: null, snap: null });
    if (commit && snap) {
      boardStore.getState().addConnection({ fromNote, fromSide, toNote: snap.noteId, toSide: snap.side });
    }
  };
  const onUp = () => finish(true);
  const onCancel = () => finish(false);

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
}
