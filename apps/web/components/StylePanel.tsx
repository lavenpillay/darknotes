'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_NOTE_STYLE } from '@darknotes/core/defaults';
import { contrastLevel, contrastRatio, sameColor } from '@/lib/color';
import {
  BODY_FONT_SIZES,
  HEADING_SIZE_MAX,
  HEADING_SIZE_MIN,
  NOTE_COLOR_PRESETS,
  TEXT_COLOR_PRESETS,
  stepBodySize,
} from '@/lib/color-presets';
import { FONT_CATEGORIES, FONT_OPTIONS, fontCategory, fontFamily, isFontInstalled } from '@/lib/fonts';
import { type PaletteKind } from '@/lib/palette-store';
import { useUi } from '@/lib/ui-store';
import { boardStore, useBoard } from '@/lib/use-board';
import { paletteStore, usePalette } from '@/lib/use-palette';
import { ColorPicker } from './ColorPicker';

const PANEL_W = 360;

const swatch = 'size-[26px] shrink-0 rounded-full border-[1.5px] border-black/15';
const ring = { outline: '2px solid #1a1612', outlineOffset: 2 } as const;

function ColorSection({
  label,
  kind,
  value,
  presets,
  onPick,
}: {
  label: string;
  kind: PaletteKind;
  value: string;
  presets: string[];
  onPick: (color: string) => void;
}) {
  const custom = usePalette((s) => s[kind]);
  const [picking, setPicking] = useState(false);

  return (
    <section aria-label={label} className="flex flex-col">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-muted">{label}</h3>
      <div className="flex flex-wrap gap-2">
        {presets.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            aria-label={`${c}${sameColor(c, value) ? ' (selected)' : ''}`}
            aria-pressed={sameColor(c, value)}
            className={swatch}
            style={{ background: c, ...(sameColor(c, value) ? ring : null) }}
            onClick={() => {
              setPicking(false);
              onPick(c);
            }}
          />
        ))}
        {custom.map((c) => (
          <span key={c} className="group/sw relative">
            <button
              type="button"
              title={`${c} (yours)`}
              aria-label={`${c} (your colour)${sameColor(c, value) ? ' (selected)' : ''}`}
              aria-pressed={sameColor(c, value)}
              className={`checker ${swatch} overflow-hidden`}
              style={sameColor(c, value) ? ring : undefined}
              onClick={() => {
                setPicking(false);
                onPick(c);
              }}
            >
              <span className="block size-full" style={{ background: c }} />
            </button>
            <button
              type="button"
              aria-label={`Remove ${c} from your palette`}
              title="Remove from your palette"
              className="absolute -right-1 -top-1 hidden size-4 place-items-center rounded-full bg-ink text-[11px] leading-none text-white group-focus-within/sw:grid group-hover/sw:grid"
              onClick={() => paletteStore.getState().remove(kind, c)}
            >
              ×
            </button>
          </span>
        ))}
        <button
          type="button"
          aria-label={`Add a custom ${label.toLowerCase()}`}
          aria-expanded={picking}
          title="Add your own colour"
          className={`${swatch} grid place-items-center border-dashed !border-ink-muted text-base leading-none text-ink-muted hover:bg-bg`}
          onClick={() => setPicking((p) => !p)}
        >
          +
        </button>
      </div>
      {picking && (
        <ColorPicker
          value={value}
          onChange={onPick}
          onSave={(c) => paletteStore.getState().add(kind, c)}
          saved={custom.some((c) => sameColor(c, value))}
          onClose={() => setPicking(false)}
        />
      )}
    </section>
  );
}

function HeadingFontPicker({ current, onPick }: { current: string; onPick: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [mesloInstalled, setMesloInstalled] = useState<boolean | null>(null);
  useEffect(() => setMesloInstalled(isFontInstalled()), []);
  const category = fontCategory(current);

  return (
    <div>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center rounded-lg border-[1.5px] border-border bg-white px-3 py-2 text-left text-base"
        style={{ fontFamily: fontFamily(current) }}
        onClick={() => setOpen((o) => !o)}
      >
        {current === 'MesloLG' ? 'MesloLG' : current}
        <span className="ml-auto font-sans text-[11px] text-ink-muted">
          {category === 'Default' ? 'Default' : (category ?? 'Custom')} {open ? '▴' : '▾'}
        </span>
      </button>
      {open && (
        <div role="listbox" aria-label="Heading font" className="mt-1.5 max-h-60 overflow-y-auto rounded-lg border-[1.5px] border-border bg-white py-1">
          {FONT_CATEGORIES.map((cat) => (
            <div key={cat}>
              <div className="px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{cat}</div>
              {FONT_OPTIONS.filter((f) => f.category === cat).map((f) => (
                <button
                  key={f.name}
                  type="button"
                  role="option"
                  aria-selected={f.name === current}
                  className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-[15px] hover:bg-bg ${f.name === current ? 'bg-accent-light text-accent' : ''}`}
                  style={{ fontFamily: fontFamily(f.name) }}
                  onClick={() => {
                    onPick(f.name);
                    setOpen(false);
                  }}
                >
                  {f.name}
                  {f.name === 'MesloLG' && mesloInstalled !== null && (
                    <span className="ml-auto font-sans text-[11px] text-ink-muted">
                      {mesloInstalled ? 'installed' : 'not installed, uses DM Sans'}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const CONTRAST_TEXT = {
  good: { cls: 'text-[#1a6b46]', msg: 'easy to read', icon: '✓' },
  ok: { cls: 'text-[#8a5a00]', msg: 'readable', icon: '✓' },
  low: { cls: 'text-[#b3261e]', msg: 'low contrast, hard to read', icon: '!' },
} as const;

/** The one panel for a note's colours, text size and heading font. Edits apply to the note live. */
export function StylePanel() {
  const panel = useUi((s) => s.stylePanel);
  const note = useBoard((s) => (panel ? s.ws?.notes[panel.noteId] : undefined));
  const ref = useRef<HTMLDivElement>(null);

  const close = () => useUi.setState({ stylePanel: null });

  useEffect(() => {
    if (!panel) return;
    paletteStore.getState().hydrate();
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('[data-style-panel], [data-style-trigger]')) close();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [panel?.noteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const ratio = useMemo(() => (note ? contrastRatio(note.fontColor, note.bgColor) : null), [note?.fontColor, note?.bgColor]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!panel || !note) return null;
  const update = (patch: Parameters<ReturnType<typeof boardStore.getState>['updateNote']>[1]) =>
    boardStore.getState().updateNote(note.id, patch);

  const vw = typeof window === 'undefined' ? 1440 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 900 : window.innerHeight;
  const left = vw - panel.anchor.right >= PANEL_W + 24 ? panel.anchor.right + 12 : Math.max(8, panel.anchor.left - PANEL_W - 12);
  const top = Math.max(8, Math.min(panel.anchor.top - 120, vh - 640));
  const level = ratio === null ? null : contrastLevel(ratio);

  return (
    <div
      ref={ref}
      data-style-panel
      role="dialog"
      aria-label="Note style"
      tabIndex={-1}
      className="fixed z-[9000] flex flex-col gap-4 overflow-y-auto rounded-[14px] border-[1.5px] border-border bg-white p-4 shadow-[0_8px_28px_rgba(0,0,0,0.14)] outline-none"
      style={{ left, top, width: PANEL_W, maxHeight: vh - top - 8 }}
    >
      <div className="flex items-center">
        <span className="font-display text-[17px] font-semibold">Style</span>
        <button
          type="button"
          className="ml-auto px-1 py-0.5 text-xs text-ink-muted underline hover:text-ink"
          onClick={() => update({ ...DEFAULT_NOTE_STYLE })}
        >
          Reset to default
        </button>
      </div>

      <ColorSection label="Note colour" kind="bg" value={note.bgColor} presets={NOTE_COLOR_PRESETS} onPick={(c) => update({ bgColor: c })} />

      <div>
        <ColorSection label="Text colour" kind="text" value={note.fontColor} presets={TEXT_COLOR_PRESETS} onPick={(c) => update({ fontColor: c })} />
        {ratio !== null && level && (
          <p role="status" className={`mt-2 flex items-center gap-1.5 text-xs ${CONTRAST_TEXT[level].cls}`}>
            <span aria-hidden className="font-bold">{CONTRAST_TEXT[level].icon}</span>
            Contrast {ratio.toFixed(1)} : 1, {CONTRAST_TEXT[level].msg}
          </p>
        )}
      </div>

      <hr className="border-border" />

      <div className="flex items-center gap-3">
        <span className="w-[92px] text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-muted">Body text</span>
        <div className="flex items-center overflow-hidden rounded-lg border-[1.5px] border-border">
          <button
            type="button"
            aria-label="Smaller text"
            className="h-[30px] w-8 bg-surface text-base disabled:opacity-40"
            disabled={note.fontSize <= BODY_FONT_SIZES[0]!}
            onClick={() => update({ fontSize: stepBodySize(note.fontSize, -1) })}
          >
            −
          </button>
          <span className="w-14 text-center font-mono text-[13px]" aria-live="polite">{note.fontSize} px</span>
          <button
            type="button"
            aria-label="Larger text"
            className="h-[30px] w-8 bg-surface text-base disabled:opacity-40"
            disabled={note.fontSize >= BODY_FONT_SIZES.at(-1)!}
            onClick={() => update({ fontSize: stepBodySize(note.fontSize, 1) })}
          >
            +
          </button>
        </div>
      </div>

      <section aria-label="Heading" className="flex flex-col gap-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-muted">Heading</h3>
        <HeadingFontPicker current={note.headingFont} onPick={(name) => update({ headingFont: name })} />
        <label className="flex items-center gap-2.5">
          <span className="sr-only">Heading size</span>
          <input
            type="range"
            min={HEADING_SIZE_MIN}
            max={HEADING_SIZE_MAX}
            step={1}
            value={note.headingSize}
            className="h-1 flex-1 accent-accent"
            onChange={(e) => update({ headingSize: +e.target.value })}
          />
          <span className="w-10 text-right font-mono text-xs">{note.headingSize} px</span>
        </label>
      </section>
    </div>
  );
}
