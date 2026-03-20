#!/usr/bin/env node
/**
 * Access sysml-v2-lsp MCP server from code (Content-Length client).
 * Run from repo root after: npm run build
 *
 *   node scripts/access-sysml-mcp.mjs
 *   node scripts/access-sysml-mcp.mjs --debug   # log stdout/stderr
 *
 * See docs/MCP_INTERACTION_GUIDE.md for lifecycle and framing.
 */
import { createSysmlMcpClient } from '../dist/src/parser/sysml-mcp-client.js';

const debug = process.argv.includes('--debug');
const code = `package TestPkg {
  requirement ReqOne {
    doc /* req */ "Requirement one.";
  }
}`;
const uri = 'file:///access-test.sysml';

async function main() {
  const client = await createSysmlMcpClient({
    initTimeout: 30000,
    debug,
  });
  try {
    const parseResult = await client.parse(code, uri);
    console.log('parse:', JSON.stringify(parseResult, null, 2));

    const validateResult = await client.validate(code, uri);
    console.log('validate:', JSON.stringify(validateResult, null, 2));

    const symbolsResult = await client.getSymbols(code, uri);
    console.log('getSymbols count:', symbolsResult?.count ?? symbolsResult);

    console.log('\nOK — sysml-v2-lsp MCP accessed from code.');
  } finally {
    client.close();
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
