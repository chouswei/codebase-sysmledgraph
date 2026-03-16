#!/usr/bin/env node
/**
 * MCP server entrypoint (stdio). Server name: sysmledgraph.
 * Tools: indexDbGraph, query, context, impact, rename, cypher, list_indexed, clean_index.
 * Resources: sysmledgraph://context, sysmledgraph://schema.
 */

import { runStdio } from '../src/mcp/server.js';

runStdio().catch((err) => {
  process.stderr.write(String(err) + '\n');
  process.exit(1);
});
