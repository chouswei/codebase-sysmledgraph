#!/usr/bin/env node
/** Remove build/output artifacts (dist/, etc.). */
import { rmSync, existsSync } from 'fs';
import { join } from 'path';
import { cwd } from 'process';

const dirs = ['dist'];
for (const d of dirs) {
  const full = join(cwd(), d);
  if (existsSync(full)) {
    rmSync(full, { recursive: true });
    console.log('Removed', full);
  }
}
