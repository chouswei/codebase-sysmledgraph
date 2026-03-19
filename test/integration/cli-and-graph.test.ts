/**
 * Integration test: index a path, list, query graph, clean.
 * Uses temp storage and test/fixtures/sysml. Mocks parser so LSP is not required in CI.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { setStorageRoot, getDbPathForIndexedPath } from '../../src/storage/location.js';
import { addToRegistry } from '../../src/storage/registry.js';
import { listIndexedPaths } from '../../src/storage/list.js';
import { cleanIndex } from '../../src/storage/clean.js';
import { getCachedOrOpenGraphStore } from '../../src/graph/graph-store.js';
import { runIndexer } from '../../src/indexer/indexer.js';
import { handleListIndexed } from '../../src/mcp/tools/list-indexed.js';

vi.mock('../../src/parser/symbols.js', () => ({
  getSymbolsForFile: vi.fn().mockResolvedValue([]),
  closeLspClient: vi.fn(),
}));

const TEST_ROOT = join(tmpdir(), `sysmledgraph-it-${randomBytes(8).toString('hex')}`);
const FIXTURE_PATH = join(process.cwd(), 'test', 'fixtures', 'sysml');

describe('Integration: CLI and graph', () => {
  beforeAll(() => {
    setStorageRoot(TEST_ROOT);
  });

  afterAll(async () => {
    await cleanIndex();
  });

  it('indexes fixture path, list shows it, cypher returns documents', async () => {
    const dbPath = getDbPathForIndexedPath(FIXTURE_PATH);
    const store = await getCachedOrOpenGraphStore(dbPath);
    const result = await runIndexer(store, { roots: [FIXTURE_PATH] });
    expect(result.ok).toBe(true);
    expect(result.filesProcessed).toBeGreaterThanOrEqual(1);

    await addToRegistry(FIXTURE_PATH);
    const paths = await listIndexedPaths();
    expect(paths).toContain(FIXTURE_PATH);

    const listResult = await handleListIndexed();
    expect(listResult.ok).toBe(true);
    expect(listResult.paths).toContain(FIXTURE_PATH);

    const conn = store.getConnection();
    const cypherResult = await conn.query('MATCH (n:Node) RETURN n.id, n.label LIMIT 10');
    const rows = await cypherResult.getAll();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it('clean_index removes path from registry', async () => {
    const cleanResult = await cleanIndex(FIXTURE_PATH);
    expect(cleanResult.ok).toBe(true);
    expect(cleanResult.removed).toContain(FIXTURE_PATH);
    const paths = await listIndexedPaths();
    expect(paths).not.toContain(FIXTURE_PATH);
  });
});
