'use client';

import { useEffect, useRef, useState } from 'react';
import { useUi } from '@/lib/ui-store';
import { boardStore } from '@/lib/use-board';

/** The server accepts bodies up to 10 MB; stop early with a clear message instead of a confusing failure. */
const MAX_CHARS = 9_500_000;

/** Import a workspace from an export file (choose a file or paste its contents). Always creates a new workspace. */
export function ImportDialog() {
  const open = useUi((s) => s.importOpen);
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const close = () => useUi.setState({ importOpen: false });

  useEffect(() => {
    if (!open) return;
    setText('');
    setFileName(null);
    setError(null);
    setBusy(false);
    areaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (!text.trim() || busy) return;
    if (text.length > MAX_CHARS) {
      setError('That file is too large to import (the limit is about 9 MB).');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await boardStore.getState().importWorkspace(text);
    setBusy(false);
    if (result.ok) close();
    else setError(result.error);
  };

  return (
    <div
      className="fixed inset-0 z-[9500] grid place-items-center bg-ink/40 p-4"
      onPointerDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        className="flex w-full max-w-lg flex-col gap-3 rounded-2xl border-[1.5px] border-border bg-white p-5 shadow-2xl"
      >
        <h2 id="import-title" className="font-display text-xl font-semibold">
          Import a workspace
        </h2>
        <p className="text-sm text-ink-muted">
          Choose a file exported from DarkNotes (the original app's files work too), or paste its contents. It becomes a{' '}
          <strong className="text-ink">new workspace</strong>; your existing boards are not changed.
        </p>

        <div className="flex items-center gap-3">
          <label className="cursor-pointer rounded-lg border border-border bg-bg px-3 py-1.5 text-sm font-medium hover:bg-accent-light">
            Choose file…
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = ''; // allow choosing the same file again
                if (!file) return;
                setError(null);
                try {
                  setText(await file.text());
                  setFileName(file.name);
                } catch {
                  setError('Could not read that file.');
                }
              }}
            />
          </label>
          <span className="min-w-0 truncate text-sm text-ink-muted">{fileName ?? 'or paste below'}</span>
        </div>

        <textarea
          ref={areaRef}
          value={text}
          spellCheck={false}
          aria-label="Export file contents"
          placeholder='{ "app": "darknotes", "name": "My workspace", "notes": [ … ] }'
          className="h-40 w-full resize-y rounded-lg border-[1.5px] border-border bg-surface p-3 font-mono text-xs outline-none focus:border-accent"
          onChange={(e) => {
            setText(e.target.value);
            setFileName(null);
            setError(null);
          }}
        />

        {error && (
          <p role="alert" className="rounded-lg bg-[#fdecea] px-3 py-2 text-sm text-[#b3261e]">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium" onClick={close}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!text.trim() || busy}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            onClick={() => void submit()}
          >
            {busy ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
