#!/usr/bin/env node
/**
 * Smoke test: spawn sysmledgraph MCP (stdio), list tools, call list_indexed.
 * Run from repo root after npm run build: node scripts/smoke-sysmledgraph-mcp.mjs
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';

const root = fileURLToPath(new URL('..', import.meta.url));
const entry = resolve(root, 'dist/mcp/index.js');

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [entry],
  cwd: root,
  env: {
    ...process.env,
    SYSMEDGRAPH_STORAGE_ROOT: process.env.SYSMEDGRAPH_STORAGE_ROOT || join(root, '.smoke-sysmledgraph-storage'),
  },
});

const client = new Client({ name: 'smoke-sysmledgraph', version: '1.0.0' }, { capabilities: {} });

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  console.log('OK — connected. Tools (%d): %s', names.length, names.join(', '));

  const res = await client.callTool({ name: 'list_indexed', arguments: {} });
  const text = res.content?.find((c) => c.type === 'text')?.text ?? JSON.stringify(res);
  console.log('OK — list_indexed:', text.slice(0, 500) + (text.length > 500 ? '…' : ''));
} finally {
  try {
    await transport.close();
  } catch {
    /* ignore */
  }
}
