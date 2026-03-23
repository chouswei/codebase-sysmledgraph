#!/usr/bin/env node
/**
 * Index a path with SysML files, then generate the graph map.
 * Usage: node scripts/index-and-map.mjs [path]
 * Default path: test/fixtures/sysml
 * Output: graph-map.md in project root (or run npm run generate-map for custom path).
 */
import { spawn } from 'child_process';
import { resolve } from 'path';
import { existsSync } from 'fs';

const pathArg = process.argv[2] || 'test/fixtures/sysml';
const absPath = resolve(process.cwd(), pathArg);

// Default LSP server: prefer lsp/node_modules (dedicated init) then repo node_modules
if (!process.env.SYSMLLSP_SERVER_PATH) {
  const lspServer = resolve(process.cwd(), 'lsp/node_modules/sysml-v2-lsp/dist/server/server.js');
  const rootServer = resolve(process.cwd(), 'node_modules/sysml-v2-lsp/dist/server/server.js');
  if (existsSync(lspServer)) process.env.SYSMLLSP_SERVER_PATH = lspServer;
  else if (existsSync(rootServer)) process.env.SYSMLLSP_SERVER_PATH = rootServer;
}

console.log('Indexing:', absPath);
const analyze = spawn('node', ['dist/bin/cli.js', 'analyze', absPath], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: { ...process.env },
});
const code = await new Promise((res) => analyze.on('close', res));
if (code !== 0) {
  console.error('Analyze failed. Ensure kuzu is built (npm install, no --ignore-scripts).');
  process.exit(code);
}

console.log('\nGenerating map...');
const map = spawn('node', ['dist/bin/cli.js', 'graph', 'map', 'graph-map.md'], {
  cwd: process.cwd(),
  stdio: 'inherit',
});
const mapCode = await new Promise((res) => map.on('close', res));
if (mapCode !== 0) process.exit(mapCode);

console.log('\nMap written to graph-map.md');
