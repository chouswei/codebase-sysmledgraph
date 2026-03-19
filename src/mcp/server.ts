/**
 * MCP server: sysmledgraph. Stdio transport; tools and resources.
 * Phase 3 steps 11–13.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { handleIndexDbGraph } from './tools/index-db-graph.js';
import { handleListIndexed } from './tools/list-indexed.js';
import { handleCleanIndex } from './tools/clean-index.js';
import { handleCypher } from './tools/cypher.js';
import { handleQuery } from './tools/query.js';
import { handleContext } from './tools/context.js';
import { handleImpact } from './tools/impact.js';
import { handleRename } from './tools/rename.js';
import { handleGenerateMap } from './tools/generate-map.js';
import { getContextContent } from './resources/context.js';
import { getSchemaContent } from './resources/schema.js';
import { listIndexedPaths } from '../storage/list.js';

const SERVER_NAME = 'sysmledgraph';
const SERVER_VERSION = '0.1.0';

function toolResult(content: string, isError = false): { content: Array<{ type: 'text'; text: string }>; isError?: boolean } {
  const out: { content: Array<{ type: 'text'; text: string }>; isError?: boolean } = {
    content: [{ type: 'text', text: content }],
  };
  if (isError) out.isError = true;
  return out;
}

function sanitizeResourceName(p: string): string {
  return p.replace(/[:\\/]/g, '_').replace(/_+/g, '_') || 'root';
}

export async function createMcpServer(): Promise<McpServer> {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {}, resources: {} } }
  );

  server.registerTool('indexDbGraph', {
    description: 'Build the knowledge graph from path(s). Input: path (string) or paths (string[]).',
    inputSchema: z.object({
      path: z.string().optional().describe('Single path to index'),
      paths: z.array(z.string()).optional().describe('Multiple paths to index'),
    }),
  }, async (args) => {
    const result = await handleIndexDbGraph(args as { path?: string; paths?: string[] });
    const text = result.ok
      ? JSON.stringify({ ok: true, filesProcessed: result.filesProcessed }, null, 2)
      : JSON.stringify({ ok: false, error: result.error }, null, 2);
    return toolResult(text, !result.ok);
  });

  server.registerTool('list_indexed', {
    description: 'List indexed path(s).',
    inputSchema: z.object({}),
  }, async () => {
    const result = await handleListIndexed();
    const text = result.ok
      ? JSON.stringify({ ok: true, paths: result.paths }, null, 2)
      : JSON.stringify({ ok: false, error: result.error }, null, 2);
    return toolResult(text, !result.ok);
  });

  server.registerTool('clean_index', {
    description: 'Remove index for path or all. Params: optional path.',
    inputSchema: z.object({
      path: z.string().optional().describe('Path to clean, or omit to clean all'),
    }),
  }, async (args) => {
    const result = await handleCleanIndex(args as { path?: string });
    const text = result.ok
      ? JSON.stringify({ ok: true, removed: result.removed }, null, 2)
      : JSON.stringify({ ok: false, error: result.error }, null, 2);
    return toolResult(text, !result.ok);
  });

  server.registerTool('cypher', {
    description: 'Run a Cypher query on the graph. Uses first indexed path.',
    inputSchema: z.object({
      query: z.string().describe('Cypher query string'),
    }),
  }, async (args) => {
    const result = await handleCypher(args as { query: string });
    const text = result.ok
      ? JSON.stringify({ ok: true, rows: result.rows }, null, 2)
      : JSON.stringify({ ok: false, error: result.error }, null, 2);
    return toolResult(text, !result.ok);
  });

  server.registerTool('query', {
    description: 'Concept search over symbols. Params: query (string), optional kind (node label).',
    inputSchema: z.object({
      query: z.string().describe('Search string'),
      kind: z.string().optional().describe('Filter by node label'),
    }),
  }, async (args) => {
    const result = await handleQuery(args as { query: string; kind?: string });
    const text = result.ok
      ? JSON.stringify({ ok: true, nodes: result.nodes }, null, 2)
      : JSON.stringify({ ok: false, error: result.error }, null, 2);
    return toolResult(text, !result.ok);
  });

  server.registerTool('context', {
    description: '360° view for one symbol: node and edges. Params: name (symbol name).',
    inputSchema: z.object({
      name: z.string().describe('Symbol name or id'),
    }),
  }, async (args) => {
    const result = await handleContext(args as { name: string });
    const text = result.ok
      ? JSON.stringify({ ok: true, node: result.node, edges: result.edges }, null, 2)
      : JSON.stringify({ ok: false, error: result.error }, null, 2);
    return toolResult(text, !result.ok);
  });

  server.registerTool('impact', {
    description: 'Blast radius: what uses this element or what it uses. Params: target (name), direction (upstream/downstream).',
    inputSchema: z.object({
      target: z.string().describe('Symbol name or id'),
      direction: z.enum(['upstream', 'downstream']).optional().describe('upstream = what references this; downstream = what this references'),
    }),
  }, async (args) => {
    const result = await handleImpact(args as { target: string; direction?: 'upstream' | 'downstream' });
    const text = result.ok
      ? JSON.stringify({ ok: true, nodes: result.nodes }, null, 2)
      : JSON.stringify({ ok: false, error: result.error }, null, 2);
    return toolResult(text, !result.ok);
  });

  server.registerTool('rename', {
    description: 'Multi-file rename preview. Params: symbol, newName, dry_run (default true).',
    inputSchema: z.object({
      symbol: z.string().describe('Symbol to rename'),
      newName: z.string().describe('New name'),
      dry_run: z.boolean().optional().describe('If true, only return preview (default true)'),
    }),
  }, async (args) => {
    const result = await handleRename(args as { symbol: string; newName: string; dry_run?: boolean });
    const text = result.ok
      ? JSON.stringify({ ok: true, preview: result.preview, message: result.message }, null, 2)
      : JSON.stringify({ ok: false, error: result.error }, null, 2);
    return toolResult(text, !result.ok);
  });

  server.registerTool('generate_map', {
    description: 'Generate Markdown from the graph (interconnection view: documents, nodes by label, edges). Uses first indexed path. Returns { ok, markdown } or { ok: false, error }.',
    inputSchema: z.object({
      output_path: z.string().optional().describe('Optional path to write .md (if server can write)'),
    }),
  }, async (args) => {
    const result = await handleGenerateMap(args as { output_path?: string });
    const text = result.ok
      ? JSON.stringify({ ok: true, markdown: result.markdown }, null, 2)
      : JSON.stringify({ ok: false, error: result.error }, null, 2);
    return toolResult(text, !result.ok);
  });

  server.registerResource('context', 'sysmledgraph://context', { description: 'Index stats and indexed paths' }, async (_uri, _extra) => {
    const text = await getContextContent();
    return { contents: [{ uri: 'sysmledgraph://context', mimeType: 'text/markdown', text }] };
  });

  server.registerResource('schema', 'sysmledgraph://schema', { description: 'Graph node/edge schema' }, async (_uri, _extra) => {
    const text = getSchemaContent();
    return { contents: [{ uri: 'sysmledgraph://schema', mimeType: 'text/markdown', text }] };
  });

  // Per-path resources (plan step 13 optional)
  const paths = await listIndexedPaths();
  for (const p of paths) {
    const uriContext = `sysmledgraph://context/${encodeURIComponent(p)}`;
    const uriSchema = `sysmledgraph://schema/${encodeURIComponent(p)}`;
    server.registerResource(
      `context-${sanitizeResourceName(p)}`,
      uriContext,
      { description: `Context (stats) for path: ${p}` },
      async () => {
        const text = await getContextContent(p);
        return { contents: [{ uri: uriContext, mimeType: 'text/markdown', text }] };
      }
    );
    server.registerResource(
      `schema-${sanitizeResourceName(p)}`,
      uriSchema,
      { description: `Schema for path: ${p}` },
      async () => {
        const text = getSchemaContent(p);
        return { contents: [{ uri: uriSchema, mimeType: 'text/markdown', text }] };
      }
    );
  }

  return server;
}

export async function runStdio(): Promise<void> {
  const server = await createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
