/**
 * Test sysml-v2-lsp MCP: spawn server, send initialize + tools/list, print result.
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const mcpPath = path.join(projectRoot, 'sysml-v2-lsp', 'dist', 'server', 'mcpServer.js');

const child = spawn('node', [mcpPath], {
  cwd: projectRoot,
  stdio: ['pipe', 'pipe', 'pipe'],
});

let buffer = '';
let gotInit = false;
let gotTools = false;

function send(obj) {
  child.stdin.write(JSON.stringify(obj) + '\n');
}

child.stdout.setEncoding('utf8');
child.stdout.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\n').filter(Boolean);
  buffer = lines.pop() ?? '';
  for (const line of lines) {
    try {
      const res = JSON.parse(line);
      if (res.result?.capabilities != null) {
        gotInit = true;
        console.log('✅ initialize OK — server:', res.result.serverInfo?.name ?? 'sysml-v2');
      }
      if (res.result?.tools != null) {
        gotTools = true;
        const tools = res.result.tools;
        console.log('✅ tools/list OK —', tools.length, 'tools');
        console.log('   Sample:', tools.slice(0, 6).map((t) => t.name).join(', '));
        child.kill();
        process.exit(0);
      }
    } catch (_) {}
  }
});

child.stderr.on('data', (d) => process.stderr.write(d));
child.on('error', (err) => {
  console.error('❌ spawn error:', err.message);
  process.exit(1);
});

send({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test-mcp', version: '0.1.0' },
  },
});
// After initialize, client sends initialized notification, then other requests
send({ jsonrpc: '2.0', method: 'notifications/initialized' });
send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });

setTimeout(() => {
  if (!gotTools) {
    console.error('❌ timeout (no tools/list response)');
    child.kill();
  }
  process.exit(gotTools ? 0 : 1);
}, 8000);
