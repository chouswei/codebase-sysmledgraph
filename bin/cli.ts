#!/usr/bin/env node
/**
 * CLI entrypoint: analyze, list, clean, worker, graph.
 */

import { resolve } from 'path';
import { program } from 'commander';
import {
  configureStorageRoot,
  cmdAnalyze,
  cmdList,
  cmdClean,
} from '../src/cli/commands.js';
import { cmdWorkerStart, cmdWorkerStop, cmdWorkerStatus } from '../src/cli/worker-commands.js';
import { runExportGraphJson, runGenerateGraphMap } from '../src/cli/graph-artifacts.js';

function applyGlobalStorage(): void {
  const opts = typeof program.optsWithGlobals === 'function' ? program.optsWithGlobals() : program.opts();
  configureStorageRoot((opts as { storage?: string }).storage);
}

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

const workerCmd = program.command('worker').description('Long-lived graph worker (TCP; single Kuzu process)');

workerCmd
  .command('start')
  .description('Start worker (foreground). Use --detach to run in background.')
  .option('--detach', 'Run daemon detached')
  .action(async (opts: { detach?: boolean }) => {
    applyGlobalStorage();
    const r = await cmdWorkerStart(opts.detach === true);
    if (!r.ok) {
      process.stderr.write((r.error ?? 'Failed') + '\n');
      process.exit(r.exitCode ?? 1);
    }
    if (opts.detach) {
      process.stderr.write('Worker started in background.\n');
    }
  });

workerCmd
  .command('stop')
  .description('Stop worker (graceful shutdown + remove worker.port)')
  .action(async () => {
    applyGlobalStorage();
    const r = await cmdWorkerStop();
    if (!r.ok) {
      process.stderr.write((r.error ?? 'Failed') + '\n');
      process.exit(r.exitCode ?? 1);
    }
    process.stderr.write('Worker stopped.\n');
  });

workerCmd
  .command('status')
  .description('Print whether worker.port responds on TCP')
  .action(async () => {
    applyGlobalStorage();
    const r = await cmdWorkerStatus();
    if (!r.ok) {
      process.stderr.write((r.error ?? 'Failed') + '\n');
      process.exit(1);
    }
    if (r.running) {
      console.log(`running 127.0.0.1:${r.port}`);
      process.exit(0);
    }
    if (r.stalePortFile) {
      process.stderr.write(
        `not running (stale worker.port: TCP closed on port ${r.port ?? '?'}; run worker stop or delete worker.port)\n`
      );
    } else {
      process.stderr.write('not running\n');
    }
    process.exit(1);
  });

const graphCmd = program.command('graph').description('Export / map graph (uses long-lived worker when configured)');

graphCmd
  .command('export [file]')
  .description('Export nodes and edges to JSON (default: graph-export.json)')
  .action(async (file?: string) => {
    applyGlobalStorage();
    const out = resolve(process.cwd(), file || 'graph-export.json');
    const r = await runExportGraphJson(out);
    if (!r.ok) {
      process.stderr.write((r.error ?? 'Export failed') + '\n');
      process.exit(1);
    }
    process.stderr.write(
      `Wrote ${r.nodesCount ?? 0} nodes, ${r.edgeCount ?? 0} edges to ${out}\nOpen viewer/view.html in a browser to view.\n`
    );
  });

graphCmd
  .command('map [file]')
  .description('Write Markdown interconnection map (default: graph-map.md)')
  .action(async (file?: string) => {
    applyGlobalStorage();
    const out = resolve(process.cwd(), file || 'graph-map.md');
    const r = await runGenerateGraphMap(out);
    if (!r.ok) {
      process.stderr.write((r.error ?? 'Map failed') + '\n');
      process.exit(1);
    }
    process.stderr.write(`Wrote ${out}\n`);
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
