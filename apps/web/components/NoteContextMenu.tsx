'use client';

import { useEffect } from 'react';
import { useUi } from '@/lib/ui-store';
import { boardStore, useBoard } from '@/lib/use-board';

/** Right-click menu for a note: duplicate, group membership, delete. */
export function NoteContextMenu() {
  const menu = useUi((s) => s.noteMenu);
  const note = useBoard((s) => (menu ? s.ws?.notes[menu.noteId] : undefined));
  const groups = useBoard((s) => s.ws?.groups);

  useEffect(() => {
    if (!menu) return;
    const close = () => useUi.setState({ noteMenu: null });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('[data-note-menu]')) close();
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', close);
    };
  }, [menu]);

  if (!menu || !note) return null;
  const store = boardStore.getState();
  const done = (fn: () => void) => () => {
    fn();
    useUi.setState({ noteMenu: null });
  };
  const inGroup = note.groupId && groups?.[note.groupId];
  const groupList = Object.values(groups ?? {});
  const item = 'flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-bg';

  return (
    <div
      data-note-menu
      role="menu"
      className="fixed z-[9999] min-w-48 rounded-xl border border-border bg-white py-1.5 shadow-xl"
      style={{ left: menu.x, top: menu.y }}
    >
      <button role="menuitem" className={item} onClick={done(() => store.duplicateNote(note.id))}>
        Duplicate
      </button>
      {(inGroup || groupList.length > 0) && <div className="my-1 border-t border-border" />}
      {inGroup ? (
        <button role="menuitem" className={item} onClick={done(() => store.setNoteGroup(note.id, null))}>
          Remove from “{inGroup.name || 'Group'}”
        </button>
      ) : (
        groupList.length > 0 && (
          <>
            <div className="px-4 pb-1 pt-1 text-xs uppercase tracking-wide text-ink-muted">Add to group</div>
            {groupList.map((g) => (
              <button key={g.id} role="menuitem" className={item} onClick={done(() => store.setNoteGroup(note.id, g.id))}>
                <span className="size-3 rounded-full border border-black/20" style={{ background: g.color }} />
                {g.name || 'Group'}
              </button>
            ))}
          </>
        )
      )}
      <div className="my-1 border-t border-border" />
      <button role="menuitem" className={`${item} text-[#c0392b]`} onClick={done(() => store.deleteNote(note.id))}>
        Delete note
      </button>
    </div>
  );
}
