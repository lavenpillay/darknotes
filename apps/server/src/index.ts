#!/usr/bin/env node
/**
 * DarkNotes server
 *   tsx src/index.ts          MCP over stdio (default; used by Claude Desktop / Claude Code)
 *   tsx src/index.ts --api    REST /api + MCP /mcp + health (+ legacy UI) on http://127.0.0.1:3737
 *   tsx src/index.ts --both   both of the above in one process
 *
 * Environment: DARKNOTES_HOST, DARKNOTES_PORT, DARKNOTES_TOKEN, DARKNOTES_ALLOWED_HOSTS,
 * DARKNOTES_ALLOWED_ORIGINS, DARKNOTES_DATA_DIR. All logging goes to stderr (stdout is the stdio protocol).
 */

import { createApp } from './app';
import { loadConfig } from './config';
import { startMcpStdio } from './mcp';

const args = process.argv.slice(2);
const mode = args.includes('--both') ? 'both' : args.includes('--api') ? 'api' : 'mcp';

function startHttp() {
  const config = loadConfig();
  const { app } = createApp(config);
  app.listen(config.port, config.host, () => {
    const base = `http://${config.host}:${config.port}`;
    console.error(`DarkNotes listening on ${base}`);
    console.error(`  REST ${base}/api   MCP ${base}/mcp   health ${base}/health`);
    console.error(config.token ? '  Auth: bearer token required for /api and /mcp' : '  Auth: none (set DARKNOTES_TOKEN to require a token)');
    if (!['127.0.0.1', 'localhost', '::1'].includes(config.host)) {
      console.error(`  WARNING: bound to ${config.host}; anyone who can reach this port can read and edit your notes. Set DARKNOTES_TOKEN.`);
    }
  });
}

if (mode === 'mcp') void startMcpStdio();
else if (mode === 'api') startHttp();
else {
  startHttp();
  void startMcpStdio();
}
