#!/usr/bin/env node
/**
 * Deploy Agent Skills for Cursor.
 *
 * Default: sync GitNexus skills from .claude/skills/gitnexus/ → .cursor/skills/
 *   (source of truth for those skills lives under .claude for Claude Code parity)
 *
 * --user: copy the same GitNexus skills to ~/.cursor/skills/ (all projects)
 */

import { cpSync, readdirSync, statSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, '.claude', 'skills', 'gitnexus');
const userMode = process.argv.includes('--user');
const dstRoot = userMode ? join(os.homedir(), '.cursor', 'skills') : join(root, '.cursor', 'skills');

if (!existsSync(srcDir)) {
  console.error('Missing source:', srcDir);
  process.exit(1);
}

mkdirSync(dstRoot, { recursive: true });

let count = 0;
for (const name of readdirSync(srcDir)) {
  const p = join(srcDir, name);
  if (!statSync(p).isDirectory()) continue;
  const dest = join(dstRoot, name);
  cpSync(p, dest, { recursive: true });
  console.log(dest);
  count++;
}

console.log(
  `\nDeployed ${count} GitNexus skill(s) to ${userMode ? join(os.homedir(), '.cursor', 'skills') : '.cursor/skills/'}`
);
if (!userMode) {
  console.log('Tip: npm run deploy-skills -- --user  → copy to personal ~/.cursor/skills/');
}
