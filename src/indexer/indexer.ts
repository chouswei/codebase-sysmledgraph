/**
 * Index pipeline: discovery → parse → symbol-to-graph → GraphStore.
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
 * Index path(s): discover .sysml, apply load order, parse, write to store.
 * Uses a single GraphStore (caller opens it). On failure returns ok: false and does not commit partial state.
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

      for (const filePath of ordered) {
        await store.addDocument(filePath, indexedAt);
        const symbols = await getSymbolsForFile(filePath);
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
