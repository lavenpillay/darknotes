#!/usr/bin/env node
/**
 * DarkNotes Server
 * ─────────────
 * Runs two services:
 *   1. MCP stdio server  — Claude / MCP clients connect via stdin/stdout
 *   2. REST API + web app  — http://localhost:3737 (app + /api)
 *
 * Usage:
 *   node server.js            # MCP mode (stdio) — used by Claude Desktop / Claude Code
 *   node server.js --api      # API + browser app
 *   node server.js --both     # Run both simultaneously
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { createApiRouter } from './api.js';
import { TOOLS, handleTool } from './tools.js';

const args = process.argv.slice(2);
const mode = args.includes('--both') ? 'both'
           : args.includes('--api')  ? 'api'
           : 'mcp';   // default: MCP stdio (for Claude Desktop / claude config)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_PORT = process.env.DARKNOTES_PORT || 3737;

// ─── REST API Server ──────────────────────────────────────────────────────────

async function startApiServer() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.use('/api', createApiRouter());

  app.get('/health', (req, res) => res.json({ ok: true, service: 'darknotes-api' }));

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'darknotes-app.html'));
  });

  app.listen(API_PORT, () => {
    console.error(`DarkNotes app running at http://localhost:${API_PORT}`);
    console.error(`REST API: http://localhost:${API_PORT}/api`);
    console.error(`Health check: http://localhost:${API_PORT}/health`);
  });
}

// ─── MCP Stdio Server ─────────────────────────────────────────────────────────

async function startMcpServer() {
  const server = new Server(
    { name: 'darknotes', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      const result = await handleTool(name, args || {});
      return {
        content: [{
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('DarkNotes MCP server running (stdio)');
}

// ─── Entry point ──────────────────────────────────────────────────────────────

if (mode === 'mcp') {
  startMcpServer();
} else if (mode === 'api') {
  startApiServer();
} else {
  // --both: run API server + MCP server together
  startApiServer();
  startMcpServer();
}
