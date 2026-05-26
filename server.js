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
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  isInitializeRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';

import { createApiRouter } from './api.js';
import { TOOLS, handleTool } from './tools.js';

const args = process.argv.slice(2);
const mode = args.includes('--both') ? 'both'
           : args.includes('--api')  ? 'api'
           : 'mcp';   // default: MCP stdio (for Claude Desktop / claude config)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_PORT = process.env.DARKNOTES_PORT || 3737;

// ─── MCP Server Logic ─────────────────────────────────────────────────────────

function createMcpServer() {
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

  return server;
}

// ─── REST API + MCP HTTP Server ───────────────────────────────────────────────

async function startApiServer() {
  const app = express();

  // Fully permissive CORS for local models and MCP clients
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['*']
  }));

  console.error('Authentication: Disabled (No authentication required)');

  app.use(express.json({ limit: '10mb' }));

  // REST API
  app.use('/api', createApiRouter());

  // MCP Streamable HTTP Transport
  const mcpTransports = new Map();

  app.all('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    let transport;

    if (sessionId) {
      transport = mcpTransports.get(sessionId);
      if (!transport) {
        return res.status(404).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Session not found' },
          id: null,
        });
      }
    } else if (isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          mcpTransports.set(id, transport);
          console.error(`MCP Session initialized: ${id}`);
        },
        enableDnsRebindingProtection: false,
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          mcpTransports.delete(transport.sessionId);
          console.error(`MCP Session closed: ${transport.sessionId}`);
        }
      };

      const mcpServer = createMcpServer();
      await mcpServer.connect(transport);
    } else {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32700, message: 'Parse error: Expected initialize request' },
        id: null,
      });
    }

    try {
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error('Error handling MCP request:', err);
      res.status(500).send(err.message);
    }
  });

  app.get('/health', (req, res) => res.json({ ok: true, service: 'darknotes-api' }));

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'darknotes-app.html'));
  });

  app.listen(API_PORT, () => {
    console.error(`DarkNotes app running at http://localhost:${API_PORT}`);
    console.error(`REST API: http://localhost:${API_PORT}/api`);
    console.error(`MCP HTTP: http://localhost:${API_PORT}/mcp`);
    console.error(`Health check: http://localhost:${API_PORT}/health`);
  });
}

// ─── MCP Stdio Server ─────────────────────────────────────────────────────────

async function startMcpStdioServer() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('DarkNotes MCP server running (stdio)');
}

// ─── Entry point ──────────────────────────────────────────────────────────────

if (mode === 'mcp') {
  startMcpStdioServer();
} else if (mode === 'api') {
  startApiServer();
} else {
  // --both: run API/HTTP server + separate Stdio server
  startApiServer();
  startMcpStdioServer();
}
