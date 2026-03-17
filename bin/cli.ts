#!/usr/bin/env node
/**
 * CLI entrypoint: analyze, list, clean.
 */

import { program } from 'commander';
import {
  configureStorageRoot,
  cmdAnalyze,
  cmdList,
  cmdClean,
  cmdCheck,
} from '../src/cli/commands.js';

program
  .name('sysmledgraph')
  .description('Path-only SysML indexer: knowledge graph, MCP server, CLI')
  .option('--storage <path>', 'Storage root (default: ~/.sysmledgraph)', process.env.SYSMEDGRAPH_STORAGE_ROOT);

program
  .command('analyze <paths...>', { isDefault: true })
  .description('Index path(s): discover .sysml, build graph')
  .action(async (paths: string[]) => {
    const opts = program.opts();
    configureStorageRoot(opts.storage);
    const result = await cmdAnalyze(paths);
    if (!result.ok) {
      process.stderr.write((result.error ?? 'Unknown error') + '\n');
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List indexed path(s)')
  .action(async () => {
    configureStorageRoot(program.opts().storage);
    const result = await cmdList();
    if (!result.ok) {
      process.stderr.write((result.error ?? 'Unknown error') + '\n');
      process.exit(1);
    }
    for (const p of result.paths) {
      console.log(p);
    }
  });

program
  .command('clean [path]')
  .description('Remove index for path or all')
  .action(async (path?: string) => {
    configureStorageRoot(program.opts().storage);
    const result = await cmdClean(path);
    if (!result.ok) {
      process.stderr.write((result.error ?? 'Unknown error') + '\n');
      process.exit(1);
    }
  });

program
  .command('check')
  .description('Check model–codebase alignment; exit non-zero if index is stale')
  .action(async () => {
    configureStorageRoot(program.opts().storage);
    const result = await cmdCheck();
    console.log(result.message);
    if (result.stalePaths.length > 0) {
      process.stderr.write('Stale path(s): ' + result.stalePaths.join(', ') + '\n');
      process.stderr.write('Re-run: sysmledgraph analyze <path> to refresh.\n');
      process.exit(1);
    }
  });

program.parse();
