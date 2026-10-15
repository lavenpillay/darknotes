import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express, { type Express } from 'express';
import type { ServerConfig } from './config';
import { createMcpHttpHandler } from './mcp';
import { createApiRouter } from './rest';
import { hostGuard, originGuard, tokenGuard } from './security';

/** True when the web app has been built (`npm run build`) into the configured directory. */
export function webAppBuilt(config: ServerConfig): boolean {
  return fs.existsSync(path.join(config.webDir, 'index.html'));
}

/**
 * Serves the web app: the static export of apps/web (pages, /documentation and the hashed assets under /_next).
 * Falls back to the original single-file app when the web app has not been built (removed in the cleanup).
 */
function mountWebApp(app: Express, config: ServerConfig) {
  if (webAppBuilt(config)) {
    const webRoot = path.resolve(config.webDir);
    // Next's export writes both documentation.html and a documentation/ folder (for its data files), and the static
    // middleware would redirect /documentation to that folder. Map extension-less page URLs to their .html file first.
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      let page: string;
      try {
        page = decodeURIComponent(req.path).replace(/\/+$/, '');
      } catch {
        return next(); // malformed escape: let the static middleware reject it
      }
      if (!page || path.extname(page)) return next();
      const file = path.join(webRoot, `${page}.html`);
      if (!file.startsWith(webRoot + path.sep) || !fs.existsSync(file)) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(file);
    });
    app.use(
      express.static(config.webDir, {
        extensions: ['html'],
        setHeaders(res, file) {
          if (file.includes(`${path.sep}_next${path.sep}static${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // content-hashed file names
          } else if (file.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache'); // always pick up a new build
          }
        },
      }),
    );
    const notFound = path.join(config.webDir, '404.html');
    app.use((req, res, next) => {
      if ((req.method !== 'GET' && req.method !== 'HEAD') || !fs.existsSync(notFound)) return next();
      res.status(404).sendFile(notFound);
    });
    return;
  }

  const ui = (file: string) => path.join(config.legacyUiDir, file);
  if (fs.existsSync(ui('darknotes-app.html'))) {
    app.use('/css', express.static(ui('css')));
    app.get('/documentation', (_req, res) => res.sendFile(ui('documentation.html')));
    app.get('/', (_req, res) => res.sendFile(ui('darknotes-app.html')));
  }
}

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
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' })); // never fall through to the web app's 404 page

  const mcp = createMcpHttpHandler();
  app.all('/mcp', tokenGuard(config), mcp.handler);

  mountWebApp(app, config);

  // Express' default error handler would leak stack traces and HTML; keep everything JSON.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = (err as { status?: number })?.status ?? 500;
    if (status >= 500) console.error('Unhandled error:', err);
    res.status(status).json({ error: status >= 500 ? 'Internal server error' : String((err as Error).message) });
  });

  return { app, close: mcp.close };
}
