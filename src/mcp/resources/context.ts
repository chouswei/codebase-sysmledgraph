/**
 * Resource: sysmledgraph://context – index stats and alignment hint.
 */

import { listIndexedPaths } from '../../storage/list.js';
import { checkAlignment } from '../../storage/alignment.js';

export async function getContextContent(): Promise<string> {
  const paths = await listIndexedPaths();
  const alignment = await checkAlignment();
  const lines = [
    '# sysmledgraph index context',
    '',
    '## Indexed paths',
    paths.length === 0 ? '(none)' : paths.map((p) => `- ${p}`).join('\n'),
    '',
    `Total: ${paths.length} path(s)`,
    '',
    '## Alignment',
    alignment.aligned
      ? 'Models and index are aligned.'
      : `**Models may be out of date.** ${alignment.message} See resource \`sysmledgraph://alignment\` for details.`,
  ];
  return lines.join('\n');
}
