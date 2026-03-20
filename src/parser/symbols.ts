/**
 * Normalized symbol/relation shape for the graph.
 * Maps LSP DocumentSymbol → NormalizedSymbol. LSP is an external process (SYSMLLSP_SERVER_PATH); not bundled.
 */

import { readFile } from 'fs/promises';
import type { NormalizedSymbol, NodeLabel, SymbolProps, SymbolRelation } from '../types.js';
import { symbolKindToNodeLabel, lspSymbolKindToNodeLabel } from '../symbol-to-graph/mapping.js';
import type { DocumentSymbolLsp } from './lsp-client.js';
import {
  getDocumentSymbolsFromLsp,
  closeLspClient as closeLspClientImpl,
  resolveLspServerPath,
} from './lsp-client.js';

function flattenSymbols(symbols: DocumentSymbolLsp[], parentQualifiedName: string | null): Array<{ sym: DocumentSymbolLsp; qualifiedName: string }> {
  const out: Array<{ sym: DocumentSymbolLsp; qualifiedName: string }> = [];
  for (const sym of symbols) {
    const qualifiedName = parentQualifiedName ? `${parentQualifiedName}::${sym.name}` : sym.name;
    out.push({ sym, qualifiedName });
    if (sym.children && sym.children.length > 0) {
      out.push(...flattenSymbols(sym.children, qualifiedName));
    }
  }
  return out;
}

/**
 * Map LSP DocumentSymbol to NormalizedSymbol (label, props, relations).
 * Uses detail (metaclass name) for label; builds IN_PACKAGE to parent.
 */
function documentSymbolToNormalized(
  item: { sym: DocumentSymbolLsp; qualifiedName: string },
  documentPath: string,
  parentQualifiedName: string | null
): NormalizedSymbol | null {
  const label =
    symbolKindToNodeLabel(item.sym.detail ?? '') ??
    (typeof item.sym.kind === 'number' ? lspSymbolKindToNodeLabel(item.sym.kind) : undefined);
  if (!label) return null;
  const props: SymbolProps = {
    name: item.sym.name,
    qualifiedName: item.qualifiedName,
    path: documentPath,
  };
  const relations: SymbolRelation[] = [];
  relations.push({ from: item.qualifiedName, to: documentPath, type: 'IN_DOCUMENT' });
  const parent = parentQualifiedName ?? item.sym.containerName;
  if (parent) {
    relations.push({ from: item.qualifiedName, to: parent, type: 'IN_PACKAGE' });
  }
  return { label, props, relations };
}

let sharedMcpClient: Awaited<ReturnType<typeof createMcpClient>> | null = null;

async function createMcpClient(): Promise<{
  getSymbols: (content: string, uri: string, filePath: string) => Promise<NormalizedSymbol[]>;
  close: () => void;
} | null> {
  const { createSysmlMcpClient, getMcpServerPath } = await import('./sysml-mcp-client.js');
  const serverPath = getMcpServerPath();
  if (!serverPath) return null;
  const client = await createSysmlMcpClient({ serverPath, initTimeout: 60000 });
  return {
    async getSymbols(content: string, uri: string, filePath: string) {
      const { symbols } = await client.getSymbols(content, uri);
      const normalized: NormalizedSymbol[] = [];
      for (const sym of symbols ?? []) {
        const label = symbolKindToNodeLabel(sym.kind ?? '');
        if (!label) continue;
        const qualifiedName = sym.qualifiedName ?? sym.name;
        const relations: SymbolRelation[] = [{ from: qualifiedName, to: filePath, type: 'IN_DOCUMENT' }];
        if (sym.parent) relations.push({ from: qualifiedName, to: sym.parent, type: 'IN_PACKAGE' });
        normalized.push({
          label,
          props: { name: sym.name, qualifiedName, path: filePath },
          relations,
        });
      }
      return normalized;
    },
    close: () => {
      client.close();
    },
  };
}

const MCP_RETRY_DELAY_MS = 1000;

/** Use shared MCP client for getSymbols (one init per index run). Returns [] if MCP unavailable or fails. Retries once on failure. */
async function getSymbolsFromMcp(filePath: string, content: string): Promise<NormalizedSymbol[]> {
  const attempt = async (): Promise<NormalizedSymbol[]> => {
    if (!sharedMcpClient) sharedMcpClient = await createMcpClient();
    if (!sharedMcpClient) return [];
    const uri = `file:///${filePath.replace(/\\/g, '/')}`;
    return await sharedMcpClient.getSymbols(content, uri, filePath);
  };
  try {
    return await attempt();
  } catch {
    await new Promise((r) => setTimeout(r, MCP_RETRY_DELAY_MS));
    try {
      return await attempt();
    } catch {
      return [];
    }
  }
}

/** When set, log to stderr whether symbols came from LSP or MCP (per file). */
const DEBUG_SYMBOL_SOURCE = process.env.DEBUG_SYSMLEGRAPH_SYMBOLS === '1';

/**
 * Get symbols and relations for a single file. Tries LSP documentSymbol first when SYSMLLSP_SERVER_PATH is set;
 * if LSP returns no symbols (or is unset), uses MCP getSymbols (one shared client per index run).
 */
export async function getSymbolsForFile(filePath: string, content?: string): Promise<NormalizedSymbol[]> {
  const text = content ?? await readFile(filePath, 'utf-8').catch(() => '');
  const LSP_SYMBOL_TIMEOUT_MS = 20000;
  if (resolveLspServerPath()) {
    try {
      const lspSymbols = await Promise.race([
        getDocumentSymbolsFromLsp(filePath, text),
        new Promise<DocumentSymbolLsp[]>((_, rej) =>
          setTimeout(() => rej(new Error('LSP documentSymbol timeout')), LSP_SYMBOL_TIMEOUT_MS)
        ),
      ]);
      if (lspSymbols.length > 0) {
        if (DEBUG_SYMBOL_SOURCE) process.stderr.write(`[sysmledgraph] symbols from LSP: ${filePath}\n`);
        const flat = flattenSymbols(lspSymbols, null);
        const normalized: NormalizedSymbol[] = [];
        for (const item of flat) {
          const qualifiedName = item.sym.containerName
            ? `${item.sym.containerName}::${item.sym.name}`
            : item.qualifiedName;
          const parentQ = qualifiedName.includes('::') ? qualifiedName.slice(0, qualifiedName.lastIndexOf('::')) : null;
          const n = documentSymbolToNormalized({ sym: item.sym, qualifiedName }, filePath, parentQ);
          if (n) normalized.push(n);
        }
        return normalized;
      }
    } catch {
      // LSP failed or unavailable; fall through to MCP
    }
  }
  const mcpSymbols = await getSymbolsFromMcp(filePath, text);
  if (DEBUG_SYMBOL_SOURCE) process.stderr.write(`[sysmledgraph] symbols from MCP: ${filePath} (${mcpSymbols.length})\n`);
  return mcpSymbols;
}

/** Close shared MCP client (used when LSP returned no symbols). */
function closeMcpClient(): void {
  if (sharedMcpClient) {
    sharedMcpClient.close();
    sharedMcpClient = null;
  }
}

/** Call after indexing to close the shared LSP and MCP clients. */
export function closeLspClient(): void {
  closeMcpClient();
  closeLspClientImpl();
}
