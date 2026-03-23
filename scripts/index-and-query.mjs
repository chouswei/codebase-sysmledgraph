#!/usr/bin/env node
/**
 * Index one path then run a node count via the graph gateway (merged graph.kuzu under storage root).
 * Uses SYSMEDGRAPH_STORAGE_ROOT like the CLI/MCP (default ~/.sysmledgraph).
 *
 * Usage (from repo root after npm run build):
 *   node scripts/index-and-query.mjs <path>
 *
 * LSP: same defaults as index-and-map — set SYSMLLSP_SERVER_PATH if needed.
 */
import { homedir } from 'os';
import { join, resolve } from 'path';
import { existsSync } from 'fs';

const pathToIndex = process.argv[2];
if (!pathToIndex) {
  console.error('Usage: node scripts/index-and-query.mjs <path>');
  process.exit(1);
}

if (!process.env.SYSMLLSP_SERVER_PATH) {
  const lspServer = resolve(process.cwd(), 'lsp/node_modules/sysml-v2-lsp/dist/server/server.js');
  const rootServer = resolve(process.cwd(), 'node_modules/sysml-v2-lsp/dist/server/server.js');
  if (existsSync(lspServer)) process.env.SYSMLLSP_SERVER_PATH = lspServer;
  else if (existsSync(rootServer)) process.env.SYSMLLSP_SERVER_PATH = rootServer;
}

const storageRoot = process.env.SYSMEDGRAPH_STORAGE_ROOT?.trim() || join(homedir(), '.sysmledgraph');
const absPath = resolve(process.cwd(), pathToIndex);

const { setStorageRoot } = await import('../dist/src/storage/location.js');
const { index, cypher, closeGraphClient } = await import('../dist/src/worker/gateway.js');
const { NODE_TABLE } = await import('../dist/src/graph/schema.js');

setStorageRoot(storageRoot);

try {
  const ir = await index({ paths: [absPath] });
  console.log('Index result:', ir);
  if (!ir.ok) {
    closeGraphClient();
    process.exit(1);
  }

  const cr = await cypher({ query: `MATCH (n:${NODE_TABLE}) RETURN count(n) AS count` });
  console.log('Cypher result:', cr);
  closeGraphClient();
  process.exit(cr.ok ? 0 : 1);
} catch (err) {
  console.error('Error:', err);
  closeGraphClient();
  process.exit(1);
}
