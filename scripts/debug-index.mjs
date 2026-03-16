#!/usr/bin/env node
/**
 * Debug: run discovery + load order for a path and print counts.
 * Usage: node scripts/debug-index.mjs "c:\Projects\SystemDesign\sysml-v2-models\projects\sysmledgraph"
 */
import { findSysmlFiles } from '../dist/src/discovery/find-sysml.js';
import { applyLoadOrder } from '../dist/src/discovery/load-order.js';

const root = process.argv[2] || process.cwd();
const roots = [root];

const allFiles = await findSysmlFiles({ roots, includeKerml: true });
console.log('allFiles.length', allFiles.length);
if (allFiles.length > 0) console.log('first', allFiles[0]);

const norm = (p) => p.replace(/\\/g, '/').toLowerCase();
const rootNorm = norm(root);
const underRoot = allFiles.filter((f) => norm(f).startsWith(rootNorm));
console.log('underRoot.length', underRoot.length);

const ordered = await applyLoadOrder(root, underRoot);
console.log('ordered.length', ordered.length);
if (ordered.length > 0) console.log('first ordered', ordered[0]);
