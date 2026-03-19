/**
 * Resource: sysmledgraph://schema – node/edge schema.
 * Optional per-path: pass path for a header "for path X" (plan step 13).
 */

import { NODE_LABELS, EDGE_TYPES, NODE_TABLE } from '../../graph/schema.js';

export function getSchemaContent(path?: string): string {
  const lines = ['# sysmledgraph graph schema', ''];
  if (path !== undefined && path !== '') {
    lines.push(`*(for path: ${path})*`, '');
  }
  lines.push(
    '## Node table',
    `- **${NODE_TABLE}**: id (STRING PK), name, path, label`,
    '',
    '## Node labels (label property)',
    ...NODE_LABELS.map((l) => `- ${l}`),
    '',
    '## Edge types (rel tables, Node→Node)',
    ...EDGE_TYPES.map((e) => `- ${e}`)
  );
  return lines.join('\n');
}
