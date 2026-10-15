import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema, isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { CorruptDataError, DomainError } from '@darknotes/core';
import { TOOLS, handleTool } from './tools';

export function createMcpServer(): Server {
  const server = new Server({ name: 'darknotes', version: '1.0.0' }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      const result = await handleTool(name, (args ?? {}) as Record<string, unknown>);
      return {
        content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const message =
        err instanceof DomainError || err instanceof CorruptDataError || err instanceof Error
          ? err.message
          : String(err);
      return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
    }
  });

  return server;
}

export async function startMcpStdio(): Promise<void> {
  await createMcpServer().connect(new StdioServerTransport());
  console.error('DarkNotes MCP server running (stdio)');
}

// ─── Streamable HTTP sessions ─────────────────────────────────

const SESSION_IDLE_MS = 30 * 60 * 1000;

interface Session {
  transport: StreamableHTTPServerTransport;
  lastSeen: number;
}

/** Stateful /mcp endpoint: one Server + transport per session, idle sessions are swept. */
export function createMcpHttpHandler(idleMs = SESSION_IDLE_MS) {
  const sessions = new Map<string, Session>();

  const sweep = setInterval(() => {
    const cutoff = Date.now() - idleMs;
    for (const [id, s] of sessions) {
      if (s.lastSeen < cutoff) {
        sessions.delete(id);
        void s.transport.close().catch(() => {});
        console.error(`MCP session expired: ${id}`);
      }
    }
  }, 60_000);
  sweep.unref();

  const rpcError = (res: Response, status: number, code: number, message: string) =>
    res.status(status).json({ jsonrpc: '2.0', error: { code, message }, id: null });

  const handler = async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'];
    let session: Session | undefined;

    if (typeof sessionId === 'string') {
      session = sessions.get(sessionId);
      if (!session) return rpcError(res, 404, -32001, 'Session not found');
    } else if (req.method === 'POST' && isInitializeRequest(req.body)) {
      const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          sessions.set(id, { transport, lastSeen: Date.now() });
          console.error(`MCP session initialized: ${id}`);
        },
      });
      transport.onclose = () => {
        if (transport.sessionId && sessions.delete(transport.sessionId)) {
          console.error(`MCP session closed: ${transport.sessionId}`);
        }
      };
      await createMcpServer().connect(transport);
      session = { transport, lastSeen: Date.now() };
    } else {
      return rpcError(res, 400, -32000, 'Bad Request: missing mcp-session-id or not an initialize request');
    }

    session.lastSeen = Date.now();
    try {
      await session.transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error('Error handling MCP request:', err);
      if (!res.headersSent) rpcError(res, 500, -32603, 'Internal error');
    }
  };

  return { handler, sessionCount: () => sessions.size, close: () => clearInterval(sweep) };
}
