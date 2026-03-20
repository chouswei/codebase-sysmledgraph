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
    if (paths.length > 0) {
      process.stderr.write(`Indexing ${paths.length} path(s)...\n`);
    }
    const result = await cmdAnalyze(paths);
    if (!result.ok) {
      process.stderr.write((result.error ?? 'Unknown error') + '\n');
      if (result.filesProcessed !== undefined && result.filesProcessed > 0) {
        process.stderr.write(`(Indexed ${result.filesProcessed} file(s) before error.)\n`);
      }
      process.exit(1);
    }
    const n = result.filesProcessed ?? 0;
    process.stderr.write(`Indexed ${n} file(s).\n`);
    process.exit(0);
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

program.parseAsync().catch((err: Error) => {
  process.stderr.write(String(err) + '\n');
  process.exit(1);
});
