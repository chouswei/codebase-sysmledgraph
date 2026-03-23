/**
 * Optional MCP getReferences pass: add REFERENCES edges across files when both endpoints exist.
 * Opt-in: SYSMLEGRAPH_INDEX_REFERENCES=1. Spawns sysml-v2-lsp MCP (same as setup-lsp / node_modules).
 */

import { readFile } from 'fs/promises';
import { pathToFileURL } from 'url';
import type { GraphStore } from '../graph/graph-store.js';
import type { NormalizedSymbol } from '../types.js';
import { createSysmlMcpClient, getMcpServerPath } from '../parser/sysml-mcp-client.js';
import type { IndexedFileBatch } from './batch.js';

function symbolNodeId(s: NormalizedSymbol): string {
  return (s.props.qualifiedName as string) ?? `${s.props.path}:${s.props.name}`;
}

function buildNodeIdSet(batches: IndexedFileBatch[]): Set<string> {
  const ids = new Set<string>();
  for (const b of batches) {
    ids.add(b.filePath);
    for (const s of b.symbols) {
      ids.add(symbolNodeId(s));
    }
  }
  return ids;
}

/** Simple name for MCP getReferences (tool expects element name, not always FQN). */
function referenceLookupName(s: NormalizedSymbol): string {
  const qn = s.props.qualifiedName as string | undefined;
  if (qn?.includes('::')) {
    return qn.slice(qn.lastIndexOf('::') + 2);
  }
  return s.props.name;
}

/**
 * For each symbol in each batch, call MCP getReferences and add REFERENCES edges
 * (referrer)-[:REFERENCES]->(target) when both node ids exist in the graph.
 */
export async function runMcpReferencesPass(store: GraphStore, batches: IndexedFileBatch[]): Promise<void> {
  if (batches.length === 0) return;
  const serverPath = getMcpServerPath();
  if (!serverPath) return;

  let client: Awaited<ReturnType<typeof createSysmlMcpClient>> | null = null;
  try {
    client = await createSysmlMcpClient({ serverPath, initTimeout: 60000 });
  } catch {
    return;
  }

  const nodeIds = buildNodeIdSet(batches);
  const edgeKey = new Set<string>();

  try {
    for (const batch of batches) {
      let content: string;
      try {
        content = await readFile(batch.filePath, 'utf-8');
      } catch {
        continue;
      }
      const uri = pathToFileURL(batch.filePath).href;
      const seenName = new Set<string>();

      for (const sym of batch.symbols) {
        const targetId = symbolNodeId(sym);
        const lookup = referenceLookupName(sym);
        if (seenName.has(`${lookup}\0${targetId}`)) continue;
        seenName.add(`${lookup}\0${targetId}`);

        let refResult: { references?: Array<{ qualifiedName?: string }> };
        try {
          refResult = await client.getReferences(lookup, content, uri);
        } catch {
          continue;
        }
        const refs = refResult.references ?? [];
        for (const ref of refs) {
          const fromId = ref.qualifiedName?.trim();
          if (!fromId || fromId === targetId) continue;
          if (!nodeIds.has(fromId) || !nodeIds.has(targetId)) continue;
          const k = `${fromId}\0${targetId}`;
          if (edgeKey.has(k)) continue;
          edgeKey.add(k);
          await store.addEdge(fromId, targetId, 'REFERENCES');
        }
      }
    }
  } finally {
    client.close();
  }
}
