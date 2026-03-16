/**
 * Resource: sysmledgraph://schema – node/edge schema.
 */

import { NODE_LABELS, EDGE_TYPES, NODE_TABLE } from '../../graph/schema.js';

export function getSchemaContent(): string {
  const lines = [
    '# sysmledgraph graph schema',
    '',
    '## Node table',
    `- **${NODE_TABLE}**: id (STRING PK), name, path, label`,
    '',
    '## Node labels (label property)',
    ...NODE_LABELS.map((l) => `- ${l}`),
    '',
    '## Edge types (rel tables, Node→Node)',
    ...EDGE_TYPES.map((e) => `- ${e}`),
  ];
  return lines.join('\n');
}
