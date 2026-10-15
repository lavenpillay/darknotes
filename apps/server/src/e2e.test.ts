// End-to-end MCP: real SDK client against /mcp (Streamable HTTP) and against the stdio entry point.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { startTestServer, useTempDataDir } from './test-utils';

const tmp = useTempDataDir();
let srv: Awaited<ReturnType<typeof startTestServer>>;
before(async () => {
  srv = await startTestServer();
});
after(() => {
  srv.stop();
  tmp.cleanup();
});

const text = (r: any) => JSON.parse(r.content[0].text);

test('MCP over Streamable HTTP: initialize, list tools, call tools, close session', async () => {
  const client = new Client({ name: 'test', version: '0' });
  const transport = new StreamableHTTPClientTransport(new URL(`${srv.url}/mcp`));
  await client.connect(transport);

  assert.equal((await client.listTools()).tools.length, 22);
  const created = text(await client.callTool({ name: 'create_note', arguments: { heading: 'via http', x: 9 } }));
  assert.deepEqual([created.note.id, created.note.x], ['n_1', 9]);

  const bad: any = await client.callTool({ name: 'get_note', arguments: { noteId: 'nope' } });
  assert.equal(bad.isError, true);
  assert.match(bad.content[0].text, /Note not found/);

  await transport.terminateSession(); // DELETE /mcp must work (legacy CORS lacked DELETE)
  await client.close();
});

test('MCP over Streamable HTTP: unknown session id is a 404, non-initialize without session is a 400', async () => {
  const post = (headers: Record<string, string>) =>
    fetch(`${srv.url}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
  assert.equal((await post({ 'Mcp-Session-Id': 'does-not-exist' })).status, 404);
  assert.equal((await post({})).status, 400);
});

test('MCP over stdio: the default mode serves the same tools', async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', path.resolve(import.meta.dirname, 'index.ts')],
    env: { ...process.env, DARKNOTES_DATA_DIR: tmp.dir } as Record<string, string>,
    stderr: 'ignore',
  });
  const client = new Client({ name: 'test-stdio', version: '0' });
  await client.connect(transport);
  assert.equal((await client.listTools()).tools.length, 22);
  const r = text(await client.callTool({ name: 'list_workspaces', arguments: {} }));
  assert.equal(r[0].id, 'ws_1');
  await client.close();
});
