#!/usr/bin/env node
/**
 * Check installed sysml-v2-lsp version and MCP server path.
 * Run from repo root: node scripts/check-sysml-v2-lsp-version.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = resolve(root, 'package.json');
const mcpPath = resolve(root, 'node_modules/sysml-v2-lsp/dist/server/mcpServer.js');

let version = null;
try {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const dep = pkg.devDependencies?.['sysml-v2-lsp'] ?? pkg.dependencies?.['sysml-v2-lsp'];
  if (dep) version = dep;
} catch (e) {
  console.error('Could not read package.json:', e.message);
  process.exit(1);
}

const mcpExists = existsSync(mcpPath);

console.log('sysml-v2-lsp:');
console.log('  version (package.json):', version ?? '(not in dependencies)');
console.log('  MCP server path exists:', mcpExists ? 'yes' : 'no');
console.log('  path:', mcpPath);

if (!version) {
  console.error('\nAdd "sysml-v2-lsp" to devDependencies in package.json.');
  process.exit(1);
}
if (!mcpExists) {
  console.error('\nRun: npm install');
  process.exit(1);
}
console.log('\nOK — sysml-v2-lsp is installed and MCP server path is present.');
