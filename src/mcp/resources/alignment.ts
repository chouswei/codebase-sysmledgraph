/**
 * Resource: sysmledgraph://alignment – model–codebase alignment status.
 * Prompts the user when the index is stale.
 */

import { checkAlignment } from '../../storage/alignment.js';

export async function getAlignmentContent(): Promise<string> {
  const result = await checkAlignment();
  const lines = [
    '# Model–codebase alignment',
    '',
    result.aligned ? '**Aligned.** No file changes since last index.' : '**Not aligned.** Some paths have changes since last index.',
    '',
    result.message,
    '',
  ];
  if (result.stalePaths && result.stalePaths.length > 0) {
    lines.push('## Stale paths (re-run analyze or indexDbGraph)', '');
    lines.push(...result.stalePaths.map((p) => `- ${p}`));
    lines.push('');
  }
  if (result.details) {
    lines.push('## Details', '');
    lines.push('```');
    lines.push(result.details);
    lines.push('```');
  }
  return lines.join('\n');
}
