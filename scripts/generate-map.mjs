#!/usr/bin/env node
/**
 * Generate graph-map.md via CLI (respects long-lived worker when worker.port / URL is set).
 * Usage: node scripts/generate-map.mjs [output.md]
 * Default: graph-map.md in cwd.
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const outPath = process.argv[2] || 'graph-map.md';
const root = dirname(fileURLToPath(import.meta.url));
const cli = join(root, '..', 'dist', 'bin', 'cli.js');

const child = spawn(process.execPath, [cli, 'graph', 'map', outPath], {
  stdio: 'inherit',
  env: { ...process.env },
  cwd: process.cwd(),
});
const code = await new Promise((res) => child.on('close', res));
process.exit(code ?? 1);
