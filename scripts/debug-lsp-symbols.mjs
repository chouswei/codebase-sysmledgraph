#!/usr/bin/env node
/**
 * Debug: what does the LSP return for documentSymbol, and what do we normalize?
 * Run from repo root after build: node scripts/debug-lsp-symbols.mjs [file]
 * Uses SYSMLLSP_SERVER_PATH or default node_modules path.
 */
import { readFile } from 'fs/promises';
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

async function main() {
  const content = await readFile(absPath, 'utf-8');
  console.log('File:', absPath);
  console.log('Content length:', content.length, 'bytes\n');

  const { getDocumentSymbolsFromLsp, closeLspClient } = await import('../dist/src/parser/lsp-client.js');
  const { getSymbolsForFile } = await import('../dist/src/parser/symbols.js');

  try {
    console.log('Calling LSP getDocumentSymbols...');
    const raw = await getDocumentSymbolsFromLsp(absPath, content);
    console.log('--- Raw LSP documentSymbol result ---');
    const rawArr = Array.isArray(raw) ? raw : (raw != null && typeof raw === 'object' ? [raw] : []);
    try {
      console.log(JSON.stringify(rawArr, null, 2));
    } catch (e) {
      console.log('(stringify failed)', String(e));
    }
    console.log('Count:', rawArr.length);
    if (rawArr.length > 0 && rawArr[0]) {
      const first = rawArr[0];
      console.log('First symbol keys:', Object.keys(first));
      console.log('First symbol detail:', first.detail, 'name:', first.name);
    }

    console.log('Calling getSymbolsForFile...');
    const normalized = await getSymbolsForFile(absPath, content);
    console.log('\n--- Normalized symbols (fed to graph) ---');
    console.log(JSON.stringify(normalized, null, 2));
    console.log('Count:', normalized?.length ?? 0);
  } catch (err) {
    console.error('Error:', err);
    throw err;
  } finally {
    closeLspClient();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
