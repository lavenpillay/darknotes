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
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
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

// ─── REST API + MCP SSE Server ───────────────────────────────────────────────

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

  // MCP SSE Transport
  const sseTransports = new Map();

  app.get('/mcp/sse', async (req, res) => {
    console.error(`New MCP SSE connection attempt from ${req.ip} (${req.get('User-Agent') || 'no-agent'})`);
    
    // Create a dedicated server instance for this session to ensure isolation
    const mcpServer = createMcpServer();
    const transport = new SSEServerTransport('/mcp/messages', res);
    const sessionId = transport.sessionId;
    
    sseTransports.set(sessionId, transport);
    console.error(`MCP SSE session started: ${sessionId}`);

    res.on('close', () => {
      console.error(`MCP SSE session closed: ${sessionId}`);
      sseTransports.delete(sessionId);
    });

    try {
      await mcpServer.connect(transport);
    } catch (err) {
      console.error(`Failed to connect MCP server for session ${sessionId}:`, err);
      res.end();
    }
  });

  app.post('/mcp/messages', async (req, res) => {
    const sessionId = req.query.sessionId;
    const transport = sseTransports.get(sessionId);
    
    if (transport) {
      try {
        await transport.handlePostMessage(req, res);
      } catch (err) {
        console.error(`Error handling MCP message for session ${sessionId}:`, err);
        res.status(500).send(err.message);
      }
    } else {
      console.error(`MCP message received for unknown session: ${sessionId}`);
      res.status(404).send('Session not found');
    }
  });

  app.get('/health', (req, res) => res.json({ ok: true, service: 'darknotes-api' }));

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'darknotes-app.html'));
  });

  app.listen(API_PORT, () => {
    console.error(`DarkNotes app running at http://localhost:${API_PORT}`);
    console.error(`REST API: http://localhost:${API_PORT}/api`);
    console.error(`MCP SSE: http://localhost:${API_PORT}/mcp/sse`);
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
  // --both: run API/SSE server + separate Stdio server
  startApiServer();
  startMcpStdioServer();
}
