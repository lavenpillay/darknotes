import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ServerConfig } from './config';

const deny = (res: Response, status: number, message: string) => res.status(status).json({ error: message });

/** "localhost:3737" -> "localhost", "[::1]:3737" -> "[::1]" */
export function hostnameOf(hostHeader: string): string {
  const h = hostHeader.trim().toLowerCase();
  if (h.startsWith('[')) return h.slice(0, h.indexOf(']') + 1);
  return h.split(':')[0] ?? '';
}

/** Blocks DNS-rebinding: a page on evil.example resolving to 127.0.0.1 still sends Host: evil.example. */
export function hostGuard(config: ServerConfig): RequestHandler {
  return (req, res, next) => {
    if (config.allowedHosts.has('*')) return next();
    if (!config.allowedHosts.has(hostnameOf(req.headers.host ?? ''))) {
      return deny(res, 403, 'Host not allowed (set DARKNOTES_ALLOWED_HOSTS)');
    }
    next();
  };
}

/** Browsers always send Origin on cross-site requests; non-browser clients (MCP, curl) send none. */
export function originGuard(config: ServerConfig): RequestHandler {
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (!origin) return next();
    if (config.allowedOrigins.has(origin)) return next();
    let hostname: string;
    try {
      hostname = hostnameOf(new URL(origin).host);
    } catch {
      return deny(res, 403, 'Invalid Origin');
    }
    if (config.allowedHosts.has('*') || config.allowedHosts.has(hostname)) return next();
    deny(res, 403, 'Origin not allowed (set DARKNOTES_ALLOWED_ORIGINS)');
  };
}

export function tokenGuard(config: ServerConfig): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!config.token || req.method === 'OPTIONS') return next();
    const given = Buffer.from((req.headers.authorization ?? '').replace(/^Bearer /i, ''));
    const want = Buffer.from(config.token);
    if (given.length !== want.length || !timingSafeEqual(given, want)) {
      return deny(res, 401, 'Missing or invalid token');
    }
    next();
  };
}
