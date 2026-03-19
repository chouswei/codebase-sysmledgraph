#!/usr/bin/env node
/**
 * Test sysml-v2-lsp MCP tools using SysML from SystemDesign models.
 * Run from repo root: node scripts/test-mcp-tools.mjs
 * Uses: c:\Projects\SystemDesign\sysml-v2-models\projects\modelbase-development\models\
 */
import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(process.cwd());
const MCP_PATH = resolve(PROJECT_ROOT, 'node_modules/sysml-v2-lsp/dist/server/mcpServer.js');
const MODELS_DIR = 'c:\\Projects\\SystemDesign\\sysml-v2-models\\projects\\modelbase-development\\models';
const SAMPLE_FILE = resolve(MODELS_DIR, 'requirements-modelbase-development.sysml');

const TOOLS = [
  'parse',
  'validate',
  'getDiagnostics',
  'diagnostics',
  'validateFile',
  'getSymbols',
  'getDefinition',
  'getReferences',
  'getHierarchy',
  'getModelSummary',
  'getComplexity',
  'preview',
];

// Minimal args per tool (code from sample file)
function toolArgs(toolName, code, uri) {
  const u = uri || 'test.sysml';
  switch (toolName) {
    case 'parse':
    case 'validate':
    case 'validateFile':
      return { code, uri: u };
    case 'getDiagnostics':
    case 'diagnostics':
    case 'getSymbols':
    case 'getModelSummary':
    case 'getComplexity':
    case 'preview':
      return { code, uri: u };
    case 'getDefinition':
    case 'getReferences':
    case 'getHierarchy':
      return { name: 'ReqFourDomains', code, uri: u };
    default:
      return { code, uri: u };
  }
}

const MINIMAL_SYSML = `package test {
  requirement ReqOne {
    doc /* minimal */ "req"
  }
}`;

async function main() {
  let code;
  try {
    code = await readFile(SAMPLE_FILE, 'utf-8');
  } catch (e) {
    console.warn('Could not read', SAMPLE_FILE, '- using minimal SysML');
    code = MINIMAL_SYSML;
  }

  const child = spawn('node', [MCP_PATH], {
    cwd: PROJECT_ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const rawBuffer = [];
  let rawLength = 0;
  const pending = new Map();
  let id = 0;

  // MCP uses LSP-style framing: "Content-Length: N\r\n\r\n" + body
  function send(method, params = {}) {
    const reqId = ++id;
    const body = JSON.stringify({ jsonrpc: '2.0', id: reqId, method, params });
    const bytes = Buffer.from(body, 'utf-8');
    const header = `Content-Length: ${bytes.length}\r\n\r\n`;
    child.stdin.write(header + body, 'utf-8');
    return new Promise((res, rej) => {
      pending.set(reqId, { resolve: res, reject: rej });
    });
  }

  function writeNotification(method) {
    const body = JSON.stringify({ jsonrpc: '2.0', method });
    const bytes = Buffer.from(body, 'utf-8');
    const header = `Content-Length: ${bytes.length}\r\n\r\n`;
    child.stdin.write(header + body, 'utf-8');
  }

  child.stdout.on('data', (chunk) => {
    rawBuffer.push(chunk);
    rawLength += chunk.length;
    for (;;) {
      const full = Buffer.concat(rawBuffer, rawLength);
      const i = full.indexOf('\r\n\r\n');
      if (i < 0) break;
      const headerSection = full.subarray(0, i).toString('ascii');
      const match = /Content-Length:\s*(\d+)/i.exec(headerSection);
      if (!match) {
        rawBuffer.length = 0;
        rawLength = 0;
        break;
      }
      const len = parseInt(match[1], 10);
      const start = i + 4;
      if (full.length < start + len) break;
      const body = full.subarray(start, start + len).toString('utf-8');
      rawBuffer.length = 0;
      rawBuffer.push(full.subarray(start + len));
      rawLength = full.length - start - len;
      try {
        const msg = JSON.parse(body);
        if (msg.id !== undefined && pending.has(msg.id)) {
          const { resolve } = pending.get(msg.id);
          pending.delete(msg.id);
          resolve(msg);
        }
      } catch (_) {}
    }
  });

  child.stderr.on('data', (d) => process.stderr.write(d));
  child.on('error', (err) => {
    console.error('Spawn error:', err.message);
    process.exit(1);
  });

  // Initialize (with timeout)
  const initTimeout = 20000;
  const initRes = await Promise.race([
    send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-mcp-tools', version: '0.1.0' },
    }),
    new Promise((_, rej) => setTimeout(() => rej(new Error('initialize timeout')), initTimeout)),
  ]).catch((e) => {
    console.error('Initialize failed:', e.message);
    process.exit(1);
  });
  if (initRes.error) {
    console.error('Initialize error:', initRes.error);
    process.exit(1);
  }
  writeNotification('notifications/initialized');
  await new Promise((r) => setTimeout(r, 300));

  const uri = code === MINIMAL_SYSML ? 'file:///test.sysml' : 'file:///' + SAMPLE_FILE.replace(/\\/g, '/');
  const results = [];

  for (const tool of TOOLS) {
    const args = toolArgs(tool, code, uri);
    try {
      const res = await Promise.race([
        send('tools/call', { name: tool, arguments: args }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000)),
      ]);
      const ok = res.result && !res.result.isError && res.result.content?.length;
      results.push({ tool, ok: !!ok, error: res.error?.message });
      console.log(ok ? `  ✅ ${tool}` : `  ❌ ${tool} ${res.error?.message || (res.result?.isError ? 'tool error' : 'no content')}`);
    } catch (e) {
      results.push({ tool, ok: false, error: e.message });
      console.log(`  ❌ ${tool} ${e.message}`);
    }
  }

  child.kill();
  const passed = results.filter((r) => r.ok).length;
  console.log('\n' + passed + '/' + TOOLS.length + ' tools passed.');
  process.exit(passed === TOOLS.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
