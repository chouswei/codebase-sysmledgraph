/**
 * Graph schema: node and rel tables for Kuzu.
 * Phase 2 step 6. One Node table (label as property); Document kept for clarity; rel tables per edge type.
 */

import { NODE_LABELS, EDGE_TYPES } from '../types.js';

export { NODE_LABELS, EDGE_TYPES };

/** Single node table: id (path or qualifiedName), name, path, label (Document|Package|PartDef|...). */
export const NODE_TABLE = 'Node';

/**
 * DDL statements for Kuzu. Node table + one rel table per edge type (Node->Node).
 */
export function getSchemaDdl(): string[] {
  const statements: string[] = [
    `CREATE NODE TABLE ${NODE_TABLE}(id STRING, name STRING, path STRING, label STRING, PRIMARY KEY(id))`,
  ];
  for (const edgeType of EDGE_TYPES) {
    statements.push(`CREATE REL TABLE ${edgeType}(FROM ${NODE_TABLE} TO ${NODE_TABLE})`);
  }
  return statements;
}
