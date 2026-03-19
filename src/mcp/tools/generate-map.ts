/**
 * MCP tool: generate_map – produce Markdown from graph (interconnection view).
 * Iteration 2, Phase 5 step 18. Uses first indexed path. R8: no indexed path or empty graph → error.
 */

import { listIndexedPaths } from '../../storage/list.js';
import { getDbPathForIndexedPath } from '../../storage/location.js';
import { getCachedOrOpenGraphStore } from '../../graph/graph-store.js';
import { NODE_TABLE, EDGE_TYPES } from '../../graph/schema.js';

export interface GenerateMapArgs {
  output_path?: string;
}

function rowValues(row: unknown): unknown[] {
  const r = row as unknown;
  return Array.isArray(r) ? r : Object.values(r as object);
}

export async function handleGenerateMap(
  _args: GenerateMapArgs
): Promise<{ ok: boolean; markdown?: string; error?: string }> {
  const paths = await listIndexedPaths();
  if (paths.length === 0) {
    return { ok: false, error: 'No indexed paths; run indexDbGraph first' };
  }
  const dbPath = getDbPathForIndexedPath(paths[0]);
  const store = await getCachedOrOpenGraphStore(dbPath);
  const conn = store.getConnection();

  try {
    // Documents (path, id)
    const docResult = await conn.query(
      `MATCH (n:${NODE_TABLE}) WHERE n.label = 'Document' RETURN n.id, n.path ORDER BY n.path LIMIT 1000`
    );
    const docRows = await docResult.getAll();

    // All nodes (for "Nodes by label")
    const nodeResult = await conn.query(
      `MATCH (n:${NODE_TABLE}) RETURN n.label, n.id, n.name, n.path ORDER BY n.label, n.name LIMIT 10000`
    );
    const nodeRows = await nodeResult.getAll();

    if (docRows.length === 0 && nodeRows.length === 0) {
      return { ok: false, error: 'Graph is empty; index a path first' };
    }

    const lines: string[] = ['# Graph map (interconnection view)', ''];

    // ## Documents
    lines.push('## Documents');
    lines.push('| id | path |');
    lines.push('|----|------|');
    for (const row of docRows as unknown[]) {
      const v = rowValues(row);
      const id = String(v[0] ?? '');
      const path = String(v[1] ?? '');
      lines.push(`| ${id} | ${path} |`);
    }
    lines.push('');

    // ## Nodes by label
    const byLabel = new Map<string, Array<{ id: string; name: string; path: string }>>();
    for (const row of nodeRows as unknown[]) {
      const v = rowValues(row);
      const label = String(v[0] ?? '');
      const id = String(v[1] ?? '');
      const name = String(v[2] ?? '');
      const path = String(v[3] ?? '');
      if (!byLabel.has(label)) byLabel.set(label, []);
      byLabel.get(label)!.push({ id, name, path });
    }
    lines.push('## Nodes by label');
    for (const [label, nodes] of Array.from(byLabel.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      lines.push(`### ${label}`);
      lines.push('| name | path | id |');
      lines.push('|------|------|-----|');
      for (const n of nodes) {
        lines.push(`| ${n.name} | ${n.path} | ${n.id} |`);
      }
      lines.push('');
    }

    // ## Edges (from, type, to)
    lines.push('## Edges');
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
        for (const row of relRows as unknown[]) {
          const v = rowValues(row);
          lines.push(`| ${String(v[0])} | ${relType} | ${String(v[1])} |`);
          edgeCount++;
        }
      } catch {
        // rel table may not exist
      }
    }
    if (edgeCount === 0) {
      lines.push('| (none) | | |');
    }
    lines.push('');

    const markdown = lines.join('\n');
    return { ok: true, markdown };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
