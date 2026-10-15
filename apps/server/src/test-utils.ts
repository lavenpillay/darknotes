import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApp } from './app';
import { loadConfig, type ServerConfig } from './config';

export function useTempDataDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dn-server-'));
  process.env.DARKNOTES_DATA_DIR = dir;
  return {
    dir,
    reset: () => fs.rmSync(dir, { recursive: true, force: true }),
    cleanup: () => {
      delete process.env.DARKNOTES_DATA_DIR;
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

export async function startTestServer(overrides: Partial<ServerConfig> = {}) {
  const config = { ...loadConfig({}), webDir: path.join(os.tmpdir(), 'dn-no-web-app'), port: 0, ...overrides };
  const { app, close } = createApp(config);
  const server = await new Promise<import('node:http').Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = (server.address() as AddressInfo).port;
  return {
    port,
    url: `http://127.0.0.1:${port}`,
    stop: () => {
      close();
      server.closeAllConnections();
      server.close();
    },
  };
}
