'use client';

import { useRef, useState } from 'react';
import { formatColor, hsvToRgb, parseColor, rgbToHsv } from '@/lib/color';

interface Props {
  /** The colour to start from (a CSS colour). The picker owns its own state while it is open. */
  value: string;
  /** Called on every change, so the note updates live as you drag. */
  onChange: (css: string) => void;
  /** Save the current colour to the user's palette. */
  onSave: (css: string) => void;
  /** True if the current colour is already in the palette. */
  saved: boolean;
  onClose: () => void;
}

/** Saturation/value square, hue and alpha sliders, and a hex field. */
export function ColorPicker({ value, onChange, onSave, saved, onClose }: Props) {
  const start = parseColor(value) ?? { r: 255, g: 249, b: 196, a: 1 };
  const [hsv, setHsv] = useState<[number, number, number]>(() => rgbToHsv(start.r, start.g, start.b));
  const [alpha, setAlpha] = useState(start.a);
  const [hex, setHex] = useState(() => formatColor({ ...start, a: 1 }));
  const [hexOk, setHexOk] = useState(true);
  const square = useRef<HTMLDivElement>(null);

  const [r, g, b] = hsvToRgb(...hsv);
  const css = formatColor({ r, g, b, a: alpha });

  const apply = (next: [number, number, number], a: number, syncHex = true) => {
    setHsv(next);
    setAlpha(a);
    const [nr, ng, nb] = hsvToRgb(...next);
    if (syncHex) {
      setHex(formatColor({ r: nr, g: ng, b: nb, a: 1 }));
      setHexOk(true);
    }
    onChange(formatColor({ r: nr, g: ng, b: nb, a }));
  };

  const pickFromSquare = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = square.current!.getBoundingClientRect();
    const s = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const v = Math.min(100, Math.max(0, (1 - (e.clientY - rect.top) / rect.height) * 100));
    apply([hsv[0], s, v], alpha);
  };

  const hueColor = `hsl(${hsv[0]},100%,50%)`;

  return (
    <div className="mt-2 flex flex-col gap-2.5 rounded-xl border border-border bg-bg p-2.5" data-testid="color-picker">
      <div
        ref={square}
        role="slider"
        tabIndex={0}
        aria-label="Saturation and brightness"
        aria-valuetext={`saturation ${Math.round(hsv[1])}%, brightness ${Math.round(hsv[2])}%`}
        className="relative h-32 w-full touch-none cursor-crosshair rounded-lg"
        style={{ backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0), #000), linear-gradient(to right, #fff, ${hueColor})` }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pickFromSquare(e);
        }}
        onPointerMove={(e) => e.buttons === 1 && pickFromSquare(e)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 10 : 2;
          const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
          const move = d[e.key];
          if (!move) return;
          e.preventDefault();
          apply([hsv[0], Math.min(100, Math.max(0, hsv[1] + move[0])), Math.min(100, Math.max(0, hsv[2] + move[1]))], alpha);
        }}
      >
        <span
          className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
          style={{ left: `${hsv[1]}%`, top: `${100 - hsv[2]}%` }}
        />
      </div>

      <input
        type="range"
        min={0}
        max={360}
        value={Math.round(hsv[0])}
        aria-label="Hue"
        className="picker-range"
        style={{ ['--track' as string]: 'linear-gradient(to right,hsl(0,100%,50%),hsl(60,100%,50%),hsl(120,100%,50%),hsl(180,100%,50%),hsl(240,100%,50%),hsl(300,100%,50%),hsl(360,100%,50%))' }}
        onChange={(e) => apply([+e.target.value, hsv[1], hsv[2]], alpha)}
      />
      <div className="checker rounded-[5px]">
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(alpha * 100)}
          aria-label="Opacity"
          className="picker-range block w-full"
          style={{ ['--track' as string]: `linear-gradient(to right, rgba(${r},${g},${b},0), rgb(${r},${g},${b}))` }}
          onChange={(e) => apply(hsv, +e.target.value / 100)}
        />
      </div>

      <div className="flex items-end gap-2">
        <span className="checker size-9 shrink-0 overflow-hidden rounded-lg border-[1.5px] border-black/15" aria-hidden>
          <span className="block size-full" style={{ background: css }} />
        </span>
        <label className="flex flex-1 flex-col gap-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
          Hex
          <input
            value={hex}
            spellCheck={false}
            aria-invalid={!hexOk}
            className={`w-full rounded-md border-[1.5px] bg-white px-2 py-1.5 font-mono text-[13px] normal-case text-ink outline-none ${hexOk ? 'border-border' : 'border-red-500'}`}
            onChange={(e) => {
              const text = e.target.value;
              setHex(text);
              const c = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(text.trim()) ? parseColor(text.trim().startsWith('#') ? text.trim() : `#${text.trim()}`) : null;
              setHexOk(!!c);
              if (c) apply(rgbToHsv(c.r, c.g, c.b), alpha, false);
            }}
          />
        </label>
        <span className="w-12 pb-2 text-right font-mono text-xs text-ink-muted">{Math.round(alpha * 100)}%</span>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={saved}
          className="flex-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:bg-border disabled:text-ink-muted"
          onClick={() => onSave(css)}
        >
          {saved ? 'In your palette' : 'Save to palette'}
        </button>
        <button type="button" className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
