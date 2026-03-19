#!/usr/bin/env node
/**
 * Run one Cypher query against the first indexed DB (for manual testing).
 * Use label Node for our schema, e.g. MATCH (n:Node) RETURN count(n) AS count
 * Usage: node scripts/query-one.mjs "MATCH (n:Node) RETURN count(n) AS count"
 */
import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const kuzu = require('kuzu');

const storageRoot = join(homedir(), '.sysmledgraph');
const registryPath = join(storageRoot, 'registry.json');
const query = process.argv[2] || 'MATCH (n:Node) RETURN count(n) AS count';

const raw = await readFile(registryPath, 'utf-8');
const { paths } = JSON.parse(raw);
if (!paths?.length) {
  console.error('No indexed paths in registry');
  process.exit(1);
}
const indexedPath = paths[0];
const sanitized = indexedPath.replace(/[:\\/]/g, '_').replace(/_+/g, '_') || 'root';
const dbPath = join(storageRoot, 'db', sanitized + '.kuzu');

const db = new kuzu.Database(dbPath);
const conn = new kuzu.Connection(db);
const result = await conn.query(query);
const rows = await result.getAll();
console.log(JSON.stringify(rows, null, 2));
conn.close();
db.close();
