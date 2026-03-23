/**
 * Graph export (JSON) and map (Markdown) via gateway — uses long-lived worker when configured.
 */

import { writeFile } from 'fs/promises';
import { listIndexedPaths } from '../storage/list.js';
import { NODE_TABLE, EDGE_TYPES } from '../graph/schema.js';
import { cypher, generateMap, closeGraphClient } from '../worker/gateway.js';

function rowVals(row: unknown): unknown[] {
  const r = row as unknown;
  return Array.isArray(r) ? r : Object.values(r as object);
}

const NODE_LIMIT = 1000;
const EDGE_LIMIT_PER_TYPE = 500;

export async function runExportGraphJson(
  outPath: string
): Promise<{ ok: boolean; error?: string; nodesCount?: number; edgeCount?: number }> {
  try {
    const paths = await listIndexedPaths();
    if (paths.length === 0) {
      return { ok: false, error: 'No indexed paths; run sysmledgraph analyze <path> first' };
    }
    const nodeQ = `MATCH (n:${NODE_TABLE}) RETURN n.id, n.name, n.path, n.label LIMIT ${NODE_LIMIT}`;
    const nr = await cypher({ query: nodeQ });
    if (!nr.ok) return { ok: false, error: nr.error };
    const nodeRows = (nr.rows ?? []) as unknown[];
    const nodes = nodeRows.map((r) => {
      const v = rowVals(r);
      return { id: String(v[0]), name: String(v[1] ?? ''), path: String(v[2] ?? ''), label: String(v[3] ?? '') };
    });
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges: { from: string; to: string; type: string }[] = [];
    for (const relType of EDGE_TYPES) {
      const er = await cypher({
        query: `MATCH (a:${NODE_TABLE})-[:${relType}]->(b:${NODE_TABLE}) RETURN a.id, b.id LIMIT ${EDGE_LIMIT_PER_TYPE}`,
      });
      if (!er.ok || !er.rows) continue;
      for (const row of er.rows as unknown[]) {
        const v = rowVals(row);
        const from = String(v[0]);
        const to = String(v[1]);
        if (nodeIds.has(from) && nodeIds.has(to)) edges.push({ from, to, type: relType });
      }
    }
    const payload = { nodes, edges, meta: { nodeLimit: NODE_LIMIT, edgeCount: edges.length } };
    await writeFile(outPath, JSON.stringify(payload, null, 0), 'utf-8');
    return { ok: true, nodesCount: nodes.length, edgeCount: edges.length };
  } finally {
    closeGraphClient();
  }
}

export async function runGenerateGraphMap(outPath: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await generateMap({});
    if (!r.ok) return { ok: false, error: r.error };
    await writeFile(outPath, r.markdown ?? '', 'utf-8');
    return { ok: true };
  } finally {
    closeGraphClient();
  }
}
