'use client';

import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Line, Note } from '@darknotes/core/types';
import { boardStore } from '@/lib/use-board';

const update = (id: string, patch: Partial<Omit<Note, 'id'>>) => boardStore.getState().updateNote(id, patch);

/** A textarea that grows with its content so each line wraps inside the note. */
function LineInput({
  value,
  onChange,
  onKeyDown,
  inputRef,
  done,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  inputRef: (el: HTMLTextAreaElement | null) => void;
  done?: boolean;
}) {
  const local = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = local.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={(el) => {
        local.current = el;
        inputRef(el);
      }}
      rows={1}
      value={value}
      spellCheck={false}
      className={`block min-h-[1.6em] w-full resize-none overflow-hidden bg-transparent p-0 leading-[1.6] outline-none placeholder:text-black/30 ${done ? 'line-through opacity-45' : ''}`}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
    />
  );
}

function Lines({ note }: { note: Note }) {
  const refs = useRef<Array<HTMLTextAreaElement | null>>([]);
  const pendingFocus = useRef<number | null>(null);

  useEffect(() => {
    if (pendingFocus.current === null) return;
    const el = refs.current[pendingFocus.current];
    pendingFocus.current = null;
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  });

  const setLines = (lines: Line[]) => update(note.id, { lines });
  const replace = (i: number, line: Line) => setLines(note.lines.map((l, j) => (j === i ? line : l)));

  const onKeyDown = (i: number) => (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const line = note.lines[i];
    if (!line) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const next: Line = line.type === 'check' ? { type: 'check', text: '', checked: false } : { type: 'text', text: '' };
      pendingFocus.current = i + 1;
      setLines([...note.lines.slice(0, i + 1), next, ...note.lines.slice(i + 1)]);
    } else if (e.key === 'Backspace' && line.text === '' && note.lines.length > 1) {
      e.preventDefault();
      pendingFocus.current = Math.max(0, i - 1);
      setLines(note.lines.filter((_, j) => j !== i));
    } else if (e.key === 'Tab') {
      e.preventDefault();
      replace(i, line.type === 'check' ? { type: 'text', text: line.text } : { type: 'check', text: line.text, checked: false });
    }
  };

  return (
    <div className="flex flex-col gap-0.5">
      {note.lines.map((line, i) => (
        <div key={i} className="flex items-start gap-2">
          {line.type === 'check' && (
            <input
              type="checkbox"
              aria-label="Done"
              className="mt-1 size-3.5 shrink-0 cursor-pointer accent-accent"
              checked={!!line.checked}
              onChange={(e) => replace(i, { ...line, checked: e.target.checked })}
            />
          )}
          <LineInput
            value={line.text}
            done={line.type === 'check' && !!line.checked}
            inputRef={(el) => void (refs.current[i] = el)}
            onChange={(text) => replace(i, { ...line, text })}
            onKeyDown={onKeyDown(i)}
          />
        </div>
      ))}
    </div>
  );
}

function Labels({ note }: { note: Note }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const label = draft.trim().replace(/^#/, '').replace(/\s+/g, '_');
    setDraft('');
    if (label && !note.labels.includes(label)) update(note.id, { labels: [...note.labels, label] });
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-black/10 bg-black/[0.04] px-2.5 py-1.5">
      {note.labels.map((l) => (
        <span key={l} className="inline-flex items-center gap-1 rounded-full bg-black/10 px-2 py-0.5 font-mono text-[11px]">
          #{l}
          <button
            aria-label={`Remove label ${l}`}
            className="opacity-50 hover:opacity-100"
            onClick={() => update(note.id, { labels: note.labels.filter((x) => x !== l) })}
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        placeholder="+ label"
        aria-label="Add label"
        className="min-w-16 flex-1 bg-transparent font-mono text-[11px] outline-none placeholder:text-black/35"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
      />
    </div>
  );
}

export const NoteCard = memo(function NoteCard({ note }: { note: Note }) {
  return (
    <article
      data-note={note.id}
      className="group absolute flex flex-col rounded-[14px] shadow-[4px_6px_24px_rgba(26,22,18,0.12),0_1px_3px_rgba(0,0,0,0.08)] transition-shadow hover:shadow-[6px_10px_36px_rgba(26,22,18,0.18),0_2px_6px_rgba(0,0,0,0.1)]"
      style={{
        left: note.x,
        top: note.y,
        width: note.w,
        height: note.h,
        zIndex: note.zIndex,
        background: note.bgColor,
        color: note.fontColor,
        fontSize: note.fontSize,
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px]">
        <header className="relative px-3.5 pt-2.5">
          <input
            value={note.heading}
            aria-label="Heading"
            placeholder="Untitled"
            className="w-full bg-transparent pr-6 font-semibold outline-none placeholder:text-black/30"
            style={{ fontFamily: `'${note.headingFont}', serif`, fontSize: note.headingSize }}
            onChange={(e) => update(note.id, { heading: e.target.value })}
          />
          <button
            aria-label="Delete note"
            title="Delete note"
            className="absolute right-2 top-2 hidden size-6 place-items-center rounded-full text-base opacity-50 hover:bg-black/10 hover:opacity-100 group-hover:grid"
            onClick={() => boardStore.getState().deleteNote(note.id)}
          >
            ×
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-2 pt-1.5">
          <Lines note={note} />
        </div>
        <Labels note={note} />
      </div>
    </article>
  );
});
