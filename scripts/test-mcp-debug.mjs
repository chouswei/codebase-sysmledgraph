#!/usr/bin/env node
/** Quick debug: spawn MCP server, send initialize, log all stdout/stderr. */
import { spawn } from 'child_process';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(process.cwd());
const MCP_PATH = resolve(PROJECT_ROOT, 'node_modules/sysml-v2-lsp/dist/server/mcpServer.js');

const child = spawn('node', [MCP_PATH], { cwd: PROJECT_ROOT, stdio: ['pipe', 'pipe', 'pipe'] });

child.stdout.on('data', (chunk) => {
  console.log('[stdout]', chunk.length, 'bytes:', chunk.toString('utf-8').slice(0, 200));
});
child.stderr.on('data', (chunk) => {
  process.stderr.write('[stderr] ' + chunk.toString('utf-8'));
});

// Send initialize with Content-Length framing
const body = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'debug', version: '0.1.0' } },
});
const bytes = Buffer.from(body, 'utf-8');
child.stdin.write(`Content-Length: ${bytes.length}\r\n\r\n` + body);

setTimeout(() => {
  console.log('\n[timeout - killing]');
  child.kill();
  process.exit(0);
}, 25000);
