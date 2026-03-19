/**
 * Index pipeline: discovering → loadOrdering → parsing → mapping → writing.
 * Aligns with behaviour model SysmledgraphBehaviour::IndexPipelineStates.
 * Phase 2 step 8. R8: on failure report and leave graph unchanged.
 */

import { findSysmlFiles } from '../discovery/find-sysml.js';
import { applyLoadOrder } from '../discovery/load-order.js';
import { getSymbolsForFile, closeLspClient } from '../parser/symbols.js';
import type { GraphStore } from '../graph/graph-store.js';

export interface IndexerOptions {
  roots: string[];
}

export interface IndexResult {
  ok: boolean;
  filesProcessed: number;
  error?: string;
}

/**
 * Index path(s): run pipeline (discovering → loadOrdering → parsing → mapping → writing).
 * Uses a single GraphStore (caller opens it). On failure returns ok: false and does not commit partial state.
 */
export async function runIndexer(store: GraphStore, options: IndexerOptions): Promise<IndexResult> {
  const { roots } = options;
  let filesProcessed = 0;

  try {
    // ——— Phase: discovering ———
    const allFiles = await findSysmlFiles({ roots, includeKerml: true });
    if (allFiles.length === 0) {
      return { ok: true, filesProcessed: 0 };
    }

    const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase();
    for (const root of roots) {
      // ——— Phase: loadOrdering ———
      const rootNorm = norm(root);
      const underRoot = allFiles.filter((f) => norm(f).startsWith(rootNorm));
      const ordered = await applyLoadOrder(root, underRoot);
      const indexedAt = new Date().toISOString();

      for (const filePath of ordered) {
        await store.addDocument(filePath, indexedAt);
        // ——— Phases: parsing + mapping (getSymbolsForFile: LSP documentSymbol → NormalizedSymbol) ———
        const symbols = await getSymbolsForFile(filePath);
        // ——— Phase: writing ———
        for (const s of symbols) {
          await store.addSymbol(s.label, s.props);
          for (const rel of s.relations) {
            await store.addEdge(rel.from, rel.to, rel.type);
          }
        }
        filesProcessed++;
      }
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
