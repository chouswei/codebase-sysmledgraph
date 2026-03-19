#!/usr/bin/env node
/**
 * Test LSP: get document symbols for each modelbase-development .sysml file.
 * Run from repo root: node scripts/test-lsp.mjs
 * Requires SYSMLLSP_SERVER_PATH → path to sysml-v2-lsp dist/server/server.js.
 */
import { readFile } from 'fs/promises';
import { resolve } from 'path';

const root = resolve(process.cwd(), 'modelbase-development', 'models');
const allFiles = [
  'requirements-modelbase-development.sysml',
  'deploy-modelbase-development.sysml',
  'behaviour-modelbase-development.sysml',
  'project-modelbase-development.sysml',
];
// Run only first N files when SYSMLEDGRAPH_LSP_FILES=N
const fileLimit = Number(process.env.SYSMLEDGRAPH_LSP_FILES) || allFiles.length;
const files = allFiles.slice(0, fileLimit);

async function main() {
  const { closeLspClient } = await import('../dist/src/parser/lsp-client.js');
  const { getSymbolsForFile } = await import('../dist/src/parser/symbols.js');

  console.log('Testing LSP (client created on first getSymbolsForFile)...\n');

  const timeoutMs = Math.min(10000, Math.max(1000, Number(process.env.SYSMLEDGRAPH_LSP_TIMEOUT_MS) || 10000));
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = resolve(root, file);
    console.log(`[${i + 1}/${files.length}] ${file}`);
    const t0 = Date.now();
    try {
      const content = await readFile(filePath, 'utf-8');
      const symbols = await Promise.race([
        getSymbolsForFile(filePath, content),
        new Promise((_, rej) => setTimeout(() => rej(new Error(`getSymbolsForFile timeout ${timeoutMs}ms`)), timeoutMs)),
      ]);
      const elapsed = Date.now() - t0;
      console.log(`  -> ${symbols.length} symbols in ${elapsed}ms`);
      const labels = [...new Set(symbols.map((s) => s.label))];
      if (labels.length) console.log(`  -> labels: ${labels.join(', ')}`);
    } catch (err) {
      console.error(`  -> ERROR (${Date.now() - t0}ms):`, err instanceof Error ? err.message : err);
    }
  }

  closeLspClient();
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
