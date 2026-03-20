#!/usr/bin/env node
/**
 * Compare MCP getSymbols vs LSP documentSymbol for the same file.
 * Writes results to compare-mcp-symbols.json and compare-lsp-symbols.json.
 * Run from repo root after build: node scripts/compare-mcp-vs-lsp-symbols.mjs [file]
 */
import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { existsSync } from 'fs';

const pathArg = process.argv[2] || 'test/fixtures/sysml/sample.sysml';
const absPath = resolve(process.cwd(), pathArg);
if (!existsSync(absPath)) {
  console.error('File not found:', absPath);
  process.exit(1);
}

if (!process.env.SYSMLLSP_SERVER_PATH) {
  const def = resolve(process.cwd(), 'node_modules/sysml-v2-lsp/dist/server/server.js');
  if (existsSync(def)) process.env.SYSMLLSP_SERVER_PATH = def;
}

const content = await readFile(absPath, 'utf-8');
const uri = `file:///${absPath.replace(/\\/g, '/')}`;

const out = { file: absPath, uri, contentLength: content.length, mcp: null, lsp: null, error: null };

// 1) MCP getSymbols
console.log('Calling MCP getSymbols...');
try {
  const { createSysmlMcpClient, getMcpServerPath } = await import('../dist/src/parser/sysml-mcp-client.js');
  const serverPath = getMcpServerPath();
  if (serverPath) {
    const client = await createSysmlMcpClient({ serverPath, initTimeout: 60000 });
    try {
      const result = await client.getSymbols(content, uri);
      out.mcp = { count: result?.count ?? 0, symbols: result?.symbols ?? [], raw: result };
      console.log('MCP symbols count:', out.mcp.count);
    } finally {
      client.close();
    }
  } else {
    out.mcp = { error: 'getMcpServerPath() returned null' };
  }
} catch (e) {
  out.mcp = { error: String(e.message ?? e) };
  console.log('MCP error:', out.mcp.error);
}

// 2) LSP documentSymbol (raw request/response)
console.log('Calling LSP documentSymbol...');
try {
  const { getDocumentSymbolsFromLsp, closeLspClient } = await import('../dist/src/parser/lsp-client.js');
  const raw = await Promise.race([
    getDocumentSymbolsFromLsp(absPath, content),
    new Promise((_, rej) => setTimeout(() => rej(new Error('LSP timeout 25s')), 25000)),
  ]);
  closeLspClient();
  const arr = Array.isArray(raw) ? raw : (raw != null ? [raw] : []);
  out.lsp = { count: arr.length, symbols: arr, rawType: raw === null ? 'null' : Array.isArray(raw) ? 'array' : typeof raw };
  console.log('LSP symbols count:', out.lsp.count);
  if (arr.length > 0 && arr[0]) {
    console.log('LSP first symbol keys:', Object.keys(arr[0]));
    console.log('LSP first detail:', arr[0].detail, 'kind:', arr[0].kind);
  }
} catch (e) {
  out.lsp = { error: String(e.message ?? e) };
  console.log('LSP error:', out.lsp.error);
}

await writeFile('compare-mcp-symbols.json', JSON.stringify(out.mcp, null, 2), 'utf-8');
await writeFile('compare-lsp-symbols.json', JSON.stringify(out.lsp, null, 2), 'utf-8');
console.log('\nWrote compare-mcp-symbols.json and compare-lsp-symbols.json');
console.log('Summary: MCP count =', out.mcp?.count ?? out.mcp?.error, ', LSP count =', out.lsp?.count ?? out.lsp?.error);
