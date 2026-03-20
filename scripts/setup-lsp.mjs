#!/usr/bin/env node
/**
 * Install the LSP server in lsp/ (sysml-v2-lsp). Used by sysmledgraph for indexing.
 * Run: npm run setup-lsp  or  node scripts/setup-lsp.mjs
 * Exit 0 if lsp/node_modules/sysml-v2-lsp/dist/server/server.js already exists or install succeeds.
 */
import { existsSync } from 'fs';
import { resolve } from 'path';
import { spawn } from 'child_process';

const cwd = resolve(process.cwd(), 'lsp');
const serverPath = resolve(cwd, 'node_modules/sysml-v2-lsp/dist/server/server.js');

if (existsSync(serverPath)) {
  console.log('LSP already installed at', serverPath);
  process.exit(0);
}

console.log('Installing LSP in lsp/...');
const proc = spawn('npm', ['install', '--ignore-scripts'], { cwd, stdio: 'inherit' });
proc.on('close', (code) => {
  if (code !== 0) {
    console.error('npm install in lsp/ failed with code', code);
    process.exit(code ?? 1);
  }
  if (!existsSync(serverPath)) {
    console.error('LSP server not found at', serverPath, '- install may be incomplete.');
    process.exit(1);
  }
  console.log('LSP installed. Run index-and-map or analyze without SYSMLLSP_SERVER_PATH.');
  process.exit(0);
});
proc.on('error', (err) => {
  console.error('Failed to run npm:', err.message);
  process.exit(1);
});
