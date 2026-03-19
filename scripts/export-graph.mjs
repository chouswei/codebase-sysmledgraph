#!/usr/bin/env node
/**
 * Export the first indexed graph to JSON (nodes + edges) for viewing.
 * Usage: node scripts/export-graph.mjs [output.json]
 * Default output: graph-export.json in current directory.
 * If the registry is empty, uses the first .kuzu file in storage db/ (e.g. after clean or CLI-only use).
 */
import { readFile, writeFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const kuzu = require('kuzu');
const { EDGE_TYPES, NODE_TABLE } = await import('../dist/src/graph/schema.js');

const NODE_LIMIT = 1000;
const EDGE_LIMIT_PER_TYPE = 500;

const storageRoot = process.env.SYSMEDGRAPH_STORAGE_ROOT || join(homedir(), '.sysmledgraph');
const dbDir = join(storageRoot, 'db');
const registryPath = join(storageRoot, 'registry.json');
const outPath = process.argv[2] || 'graph-export.json';

// One merged graph DB (plan step 8)
const MERGED_DB_FILENAME = 'graph.kuzu';
let dbPath = join(dbDir, MERGED_DB_FILENAME);
if (!existsSync(dbPath)) {
  try {
    const files = await readdir(dbDir);
    const kuzuFile = files.find((f) => f.endsWith('.kuzu') && !f.endsWith('.kuzu.wal'));
    if (kuzuFile) dbPath = join(dbDir, kuzuFile);
    else dbPath = null;
  } catch {
    dbPath = null;
  }
}
if (!dbPath) {
  console.error('No indexed paths and no DB in storage. Run: npx sysmledgraph analyze <path>');
  process.exit(1);
}

const db = new kuzu.Database(dbPath);
const conn = new kuzu.Connection(db);

const nodeResult = await conn.query(
  `MATCH (n:${NODE_TABLE}) RETURN n.id, n.name, n.path, n.label LIMIT ${NODE_LIMIT}`
);
const nodeRows = await nodeResult.getAll();
const nodes = nodeRows.map((r) => {
  const v = Array.isArray(r) ? r : Object.values(r);
  return { id: String(v[0]), name: String(v[1] ?? ''), path: String(v[2] ?? ''), label: String(v[3] ?? '') };
});

const nodeIds = new Set(nodes.map((n) => n.id));
const edges = [];
for (const relType of EDGE_TYPES) {
  try {
    const relResult = await conn.query(
      `MATCH (a:${NODE_TABLE})-[:${relType}]->(b:${NODE_TABLE}) RETURN a.id, b.id LIMIT ${EDGE_LIMIT_PER_TYPE}`
    );
    const relRows = await relResult.getAll();
    for (const row of relRows) {
      const v = Array.isArray(row) ? row : Object.values(row);
      const from = String(v[0]);
      const to = String(v[1]);
      if (nodeIds.has(from) && nodeIds.has(to)) edges.push({ from, to, type: relType });
    }
  } catch {
    // rel table may not exist
  }
}

conn.close();
db.close();

const payload = { nodes, edges, meta: { nodeLimit: NODE_LIMIT, edgeCount: edges.length } };
await writeFile(outPath, JSON.stringify(payload, null, 0), 'utf-8');
console.log(`Wrote ${nodes.length} nodes, ${edges.length} edges to ${outPath}`);
console.log('Open viewer/view.html in a browser and load this file to view the graph.');
