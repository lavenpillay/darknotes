/** Typed client for the DarkNotes REST API (apps/server). Same-origin: Next proxies /api in dev and prod. */

import type { Change, Workspace } from '@darknotes/core/types';

export interface WorkspaceSummary {
  id: string;
  name: string;
  noteCount: number;
  groupCount: number;
}

export interface ChangesResult {
  applied: number;
  skipped: Array<{ index: number; op: string; reason: string }>;
  /** The workspace after the changes, including anything other clients changed. */
  workspace: Workspace;
}

export interface ImportResult {
  workspace: Workspace;
  imported: { notes: number; groups: number; connections: number };
  skipped: { connections: number };
}

export interface Api {
  listWorkspaces(): Promise<{ workspaces: WorkspaceSummary[]; currentWorkspaceId: string }>;
  getWorkspace(id: string): Promise<Workspace>;
  createWorkspace(name: string): Promise<Workspace>;
  renameWorkspace(id: string, name: string): Promise<Workspace>;
  deleteWorkspace(id: string): Promise<void>;
  activateWorkspace(id: string): Promise<void>;
  /** The workspace as an export file (JSON text). */
  exportWorkspace(id: string): Promise<string>;
  /** Create a new workspace from an export file's contents. */
  importWorkspace(payload: unknown): Promise<ImportResult>;
  /** Send only what changed. Safe alongside other writers (MCP, other tabs). */
  applyChanges(id: string, changes: Change[]): Promise<ChangesResult>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function createApi(base = '/api', fetchFn: typeof fetch = (...a) => fetch(...a)): Api {
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const res = await fetchFn(base + path, {
      method,
      headers: payload === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: payload,
      // Lets a save started as the tab closes or reloads still reach the server (browsers cap this at 64KB).
      keepalive: (method === 'PUT' || method === 'POST') && payload !== undefined && payload.length < 60_000,
    });
    const text = await res.text();
    const json = text ? (JSON.parse(text) as unknown) : undefined;
    if (!res.ok) {
      const message = (json as { error?: string } | undefined)?.error ?? `HTTP ${res.status}`;
      throw new ApiError(res.status, message);
    }
    return json as T;
  }

  const ws = (id: string) => `/workspaces/${encodeURIComponent(id)}`;
  return {
    listWorkspaces: () => call('GET', '/workspaces'),
    getWorkspace: (id) => call('GET', ws(id)),
    createWorkspace: (name) => call('POST', '/workspaces', { name }),
    renameWorkspace: (id, name) => call('PATCH', ws(id), { name }),
    deleteWorkspace: async (id) => void (await call('DELETE', ws(id))),
    activateWorkspace: async (id) => void (await call('POST', `${ws(id)}/activate`)),
    exportWorkspace: async (id) => {
      const res = await fetchFn(`${base}${ws(id)}/export`);
      const text = await res.text();
      if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
          message = (JSON.parse(text) as { error?: string }).error ?? message;
        } catch {
          /* not JSON: keep the status */
        }
        throw new ApiError(res.status, message);
      }
      return text;
    },
    importWorkspace: (payload) => call('POST', '/workspaces/import', payload),
    applyChanges: (id, changes) => call('POST', `${ws(id)}/changes`, { changes }),
  };
}
