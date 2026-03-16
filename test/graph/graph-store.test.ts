import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { openGraphStore } from '../../src/graph/graph-store.js';

describe('GraphStore (Kuzu)', () => {
  it('creates schema, adds document, and returns it via Cypher', async () => {
    const dbPath = join(tmpdir(), `sysmledgraph-test-${randomBytes(6).toString('hex')}`);
    const store = await openGraphStore(dbPath);
    await store.addDocument('/fake/path/doc.sysml', '2025-01-01T00:00:00Z');
    const conn = store.getConnection();
    const result = await conn.query('MATCH (n:Node) WHERE n.label = \'Document\' RETURN n.id, n.path');
    const rows = await result.getAll();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const first = rows[0];
    const vals = Array.isArray(first) ? first : Object.values(first as object);
    expect(vals.some((v) => String(v) === '/fake/path/doc.sysml')).toBe(true);
  });
});
