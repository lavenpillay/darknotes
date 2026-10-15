/** Pure constants and helpers for workspace export files. Safe to import from browser code via `@darknotes/core/export-format`. */

export const EXPORT_APP = 'darknotes';
export const EXPORT_VERSION = 1;

/** `darknotes-<workspace-name>-<yyyy-mm-dd>.json`, with the name reduced to lower-case letters, digits and underscores. */
export function exportFilename(name: string, date: Date = new Date()): string {
  const safe = (name || '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'workspace';
  return `darknotes-${safe}-${date.toISOString().slice(0, 10)}.json`;
}
