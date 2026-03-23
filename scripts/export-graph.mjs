#!/usr/bin/env node
/**
 * Export graph to JSON (nodes + edges). Delegates to CLI so long-lived worker is used when configured.
 * Usage: node scripts/export-graph.mjs [output.json]
 * Default: graph-export.json in cwd. Storage: SYSMEDGRAPH_STORAGE_ROOT or ~/.sysmledgraph
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const outPath = process.argv[2] || 'graph-export.json';
const root = dirname(fileURLToPath(import.meta.url));
const cli = join(root, '..', 'dist', 'bin', 'cli.js');

const child = spawn(process.execPath, [cli, 'graph', 'export', outPath], {
  stdio: 'inherit',
  env: { ...process.env },
  cwd: process.cwd(),
});
const code = await new Promise((res) => child.on('close', res));
process.exit(code ?? 1);
