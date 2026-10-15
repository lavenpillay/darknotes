import path from 'node:path';

export interface ServerConfig {
  /** Interface to bind. Loopback by default; the Docker image sets DARKNOTES_HOST=0.0.0.0. */
  host: string;
  port: number;
  /** Optional shared secret. When set, /api and /mcp require `Authorization: Bearer <token>`. */
  token?: string;
  /** Hostnames accepted in the Host header (and in Origin). `*` disables the check. */
  allowedHosts: Set<string>;
  /** Extra full origins accepted, e.g. https://notes.example.com */
  allowedOrigins: Set<string>;
  /** Directory holding the built web app (the static export of apps/web). Served at `/` when it exists. */
  webDir: string;
}

const list = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    host: env.DARKNOTES_HOST || '127.0.0.1',
    port: Number(env.DARKNOTES_PORT) || 3737,
    token: env.DARKNOTES_TOKEN || undefined,
    allowedHosts: new Set(['localhost', '127.0.0.1', '[::1]', ...list(env.DARKNOTES_ALLOWED_HOSTS)]),
    allowedOrigins: new Set(list(env.DARKNOTES_ALLOWED_ORIGINS)),
    // Same relative path from src/ and from the bundled dist/: <repo>/apps/server/{src,dist} -> <repo>/apps/web/out
    webDir: env.DARKNOTES_WEB_DIR || path.resolve(import.meta.dirname, '../../web/out'),
  };
}
