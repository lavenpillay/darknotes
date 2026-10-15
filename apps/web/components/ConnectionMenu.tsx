'use client';

import { useEffect } from 'react';
import type { Arrows } from '@darknotes/core/types';
import { useUi } from '@/lib/ui-store';
import { boardStore, useBoard } from '@/lib/use-board';

const OPTIONS: Array<{ value: Arrows; label: string }> = [
  { value: 'none', label: 'No arrowheads' },
  { value: 'end', label: 'Arrow at end' },
  { value: 'start', label: 'Arrow at start' },
  { value: 'both', label: 'Arrows at both ends' },
];

export function ConnectionMenu() {
  const menu = useUi((s) => s.menu);
  const current = useBoard((s) => (menu ? (s.ws?.connections[menu.connId]?.arrows ?? 'none') : null));

  useEffect(() => {
    if (!menu) return;
    const close = () => useUi.setState({ menu: null });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('[data-conn-menu]')) close();
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

  if (!menu) return null;
  return (
    <div
      data-conn-menu
      role="menu"
      className="fixed z-[9999] min-w-44 rounded-xl border border-border bg-white py-1.5 shadow-xl"
      style={{ left: menu.x, top: menu.y }}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          role="menuitemradio"
          aria-checked={current === o.value}
          className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-bg ${current === o.value ? 'font-semibold text-accent' : ''}`}
          onClick={() => {
            boardStore.getState().setConnectionArrows(menu.connId, o.value);
            useUi.setState({ menu: null });
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
