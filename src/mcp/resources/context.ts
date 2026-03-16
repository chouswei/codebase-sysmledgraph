/**
 * Resource: sysmledgraph://context – index stats, staleness.
 */

import { listIndexedPaths } from '../../storage/list.js';

export async function getContextContent(): Promise<string> {
  const paths = await listIndexedPaths();
  const lines = [
    '# sysmledgraph index context',
    '',
    '## Indexed paths',
    paths.length === 0 ? '(none)' : paths.map((p) => `- ${p}`).join('\n'),
    '',
    `Total: ${paths.length} path(s)`,
  ];
  return lines.join('\n');
}
