import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express, { type Express } from 'express';
import type { ServerConfig } from './config';
import { createMcpHttpHandler } from './mcp';
import { createApiRouter } from './rest';
import { hostGuard, originGuard, tokenGuard } from './security';

export function createApp(config: ServerConfig): { app: Express; close: () => void } {
  const app = express();
  app.disable('x-powered-by');

  app.use(hostGuard(config));
  app.use(originGuard(config)); // after this, any Origin that remains is allowed, so cors may reflect it
  app.use(
    cors({
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Mcp-Session-Id', 'Mcp-Protocol-Version', 'Last-Event-ID'],
      exposedHeaders: ['Mcp-Session-Id'],
    }),
  );
  app.use(express.json({ limit: '10mb' }));

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'darknotes-api' }));

  app.use('/api', tokenGuard(config), createApiRouter());

  const mcp = createMcpHttpHandler();
  app.all('/mcp', tokenGuard(config), mcp.handler);

  // Legacy single-file UI, served until the Next.js app replaces it.
  const ui = (file: string) => path.join(config.legacyUiDir, file);
  if (fs.existsSync(ui('darknotes-app.html'))) {
    app.use('/css', express.static(ui('css')));
    app.get('/documentation', (_req, res) => res.sendFile(ui('documentation.html')));
    app.get('/', (_req, res) => res.sendFile(ui('darknotes-app.html')));
  }

  // Express' default error handler would leak stack traces and HTML; keep everything JSON.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = (err as { status?: number })?.status ?? 500;
    if (status >= 500) console.error('Unhandled error:', err);
    res.status(status).json({ error: status >= 500 ? 'Internal server error' : String((err as Error).message) });
  });

  return { app, close: mcp.close };
}
