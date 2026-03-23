/**
 * Index pipeline: discovering → loadOrdering → parsing → mapping → writing.
 * Writing uses two phases: all documents and symbol nodes first, then all edges (so IN_PACKAGE / cross-file targets exist).
 * Optional: SYSMLEGRAPH_INDEX_REFERENCES=1 runs MCP getReferences after edges (see reference-pass.ts).
 * Aligns with behaviour model SysmledgraphBehaviour::IndexPipelineStates.
 * Phase 2 step 8. R8: on failure report and leave graph unchanged.
 */

import { findSysmlFiles } from '../discovery/find-sysml.js';
import { applyLoadOrder } from '../discovery/load-order.js';
import { getSymbolsForFile, closeLspClient } from '../parser/symbols.js';
import type { GraphStore } from '../graph/graph-store.js';
import type { NormalizedSymbol } from '../types.js';
import { runMcpReferencesPass } from './reference-pass.js';
import type { IndexedFileBatch } from './batch.js';

export type { IndexedFileBatch } from './batch.js';

export interface IndexerOptions {
  roots: string[];
}

export interface IndexResult {
  ok: boolean;
  filesProcessed: number;
  error?: string;
}

/**
 * Write batches: documents → symbols → edges. Exported for tests (ordering / cross-file IN_PACKAGE).
 */
export async function applyIndexedBatches(
  store: GraphStore,
  batches: IndexedFileBatch[],
  indexedAt: string
): Promise<void> {
  for (const b of batches) {
    await store.addDocument(b.filePath, indexedAt);
  }
  for (const b of batches) {
    for (const s of b.symbols) {
      await store.addSymbol(s.label, s.props);
    }
  }
  for (const b of batches) {
    for (const s of b.symbols) {
      for (const rel of s.relations) {
        await store.addEdge(rel.from, rel.to, rel.type);
      }
    }
  }
}

/**
 * Index path(s): discover → order → parse each file → two-phase write → optional MCP REFERENCES.
 */
export async function runIndexer(store: GraphStore, options: IndexerOptions): Promise<IndexResult> {
  const { roots } = options;
  let filesProcessed = 0;

  try {
    const allFiles = await findSysmlFiles({ roots, includeKerml: true });
    if (allFiles.length === 0) {
      return { ok: true, filesProcessed: 0 };
    }

    const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase();
    for (const root of roots) {
      const rootNorm = norm(root);
      const underRoot = allFiles.filter((f) => norm(f).startsWith(rootNorm));
      const ordered = await applyLoadOrder(root, underRoot);
      const indexedAt = new Date().toISOString();

      const batches: IndexedFileBatch[] = [];
      for (const filePath of ordered) {
        const symbols = await getSymbolsForFile(filePath);
        batches.push({ filePath, symbols });
      }

      await applyIndexedBatches(store, batches, indexedAt);

      if (process.env.SYSMLEGRAPH_INDEX_REFERENCES === '1') {
        await runMcpReferencesPass(store, batches);
      }

      filesProcessed += batches.length;
    }

    return { ok: true, filesProcessed };
  } catch (err) {
    return {
      ok: false,
      filesProcessed,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    closeLspClient();
  }
}
