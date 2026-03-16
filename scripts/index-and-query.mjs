#!/usr/bin/env node
/**
 * Index one path then run a count query in the same process (same DB).
 * Usage: set SYSMLLSP_SERVER_PATH then run:
 *   node scripts/index-and-query.mjs "c:\Projects\SystemDesign\sysml-v2-models\projects\sysmledgraph"
 */
import { homedir } from 'os';
import { join } from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const pathToIndex = process.argv[2];
if (!pathToIndex) {
  console.error('Usage: node scripts/index-and-query.mjs <path>');
  process.exit(1);
}

const storageRoot = join(homedir(), '.sysmledgraph');
const sanitized = pathToIndex.replace(/[:\\/]/g, '_').replace(/_+/g, '_') || 'root';
const dbPath = join(storageRoot, 'db', sanitized + '.kuzu');

// Use compiled indexer and graph
const { openGraphStore } = await import('../dist/src/graph/graph-store.js');
const { runIndexer } = await import('../dist/src/indexer/indexer.js');

try {
  const store = await openGraphStore(dbPath);
  const result = await runIndexer(store, { roots: [pathToIndex] });
  console.log('Index result:', result);

  const conn = store.getConnection();
  const q = await conn.query('MATCH (n) RETURN count(n) AS count');
  const rows = await q.getAll();
  console.log('Count:', rows);
  process.exit(result.ok ? 0 : 1);
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
