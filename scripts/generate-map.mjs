#!/usr/bin/env node
/**
 * Generate a markdown map from the graph (interconnection view, packages, documents).
 * Plan After v1 / Gap #6. Usage: node scripts/generate-map.mjs [output.md]
 * Default output: graph-map.md in current directory.
 * Uses the same merged DB as export-graph (storage db/graph.kuzu).
 */
import { writeFile, readdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const kuzu = require('kuzu');
const { NODE_TABLE, EDGE_TYPES } = await import('../dist/src/graph/schema.js');

const storageRoot = process.env.SYSMEDGRAPH_STORAGE_ROOT || join(homedir(), '.sysmledgraph');
const dbDir = join(storageRoot, 'db');
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
  console.error('No graph DB found. Run: npx sysmledgraph analyze <path>');
  process.exit(1);
}

const outPath = process.argv[2] || 'graph-map.md';
const db = new kuzu.Database(dbPath);
const conn = new kuzu.Connection(db);

const lines = ['# Graph map (interconnection view)', ''];

// Documents
const docResult = await conn.query(
  `MATCH (n:${NODE_TABLE}) WHERE n.label = 'Document' RETURN n.id, n.path ORDER BY n.path LIMIT 500`
);
const docRows = await docResult.getAll();
lines.push('## Documents');
if (docRows.length === 0) lines.push('(none)');
else docRows.forEach((r) => { const v = Array.isArray(r) ? r : Object.values(r); lines.push(`- ${String(v[1] ?? v[0])}`); });
lines.push('');

// Nodes by label (Package, PartDef, RequirementDef, etc.)
const nodeResult = await conn.query(
  `MATCH (n:${NODE_TABLE}) RETURN n.label, n.id, n.name, n.path ORDER BY n.label, n.name LIMIT 10000`
);
const nodeRows = await nodeResult.getAll();
const byLabel = new Map();
for (const r of nodeRows) {
  const v = Array.isArray(r) ? r : Object.values(r);
  const label = String(v[0] ?? '');
  const id = String(v[1] ?? '');
  const name = String(v[2] ?? '');
  const path = String(v[3] ?? '');
  if (!byLabel.has(label)) byLabel.set(label, []);
  byLabel.get(label).push({ id, name, path });
}
lines.push('## Nodes by label');
for (const [label, nodes] of [...byLabel.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  lines.push(`### ${label}`);
  lines.push('| name | path | id |');
  lines.push('|------|------|-----|');
  for (const n of nodes) {
    lines.push(`| ${n.name} | ${n.path} | ${n.id} |`);
  }
  lines.push('');
}

// Edges (Interconnection)
lines.push('## Interconnection (edges)');
lines.push('| from | type | to |');
lines.push('|------|------|-----|');
let edgeCount = 0;
const edgeLimit = 500;
for (const relType of EDGE_TYPES) {
  try {
    const relResult = await conn.query(
      `MATCH (a:${NODE_TABLE})-[:${relType}]->(b:${NODE_TABLE}) RETURN a.id, b.id LIMIT ${Math.ceil(edgeLimit / EDGE_TYPES.length)}`
    );
    const relRows = await relResult.getAll();
    for (const row of relRows) {
      const v = Array.isArray(row) ? row : Object.values(row);
      lines.push(`| ${String(v[0])} | ${relType} | ${String(v[1])} |`);
      edgeCount++;
    }
  } catch {
    // rel table may not exist
  }
}
if (edgeCount === 0) lines.push('| (none) | | |');
lines.push('');

conn.close();
db.close();

await writeFile(outPath, lines.join('\n'), 'utf-8');
console.log(`Wrote ${outPath}`);
