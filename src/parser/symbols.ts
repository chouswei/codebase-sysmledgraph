/**
 * Normalized symbol/relation shape for the graph.
 * Uses sysml-v2-lsp (stdio) when available; maps LSP DocumentSymbol to NormalizedSymbol.
 */

import { readFile } from 'fs/promises';
import type { NormalizedSymbol, NodeLabel, SymbolProps, SymbolRelation } from '../types.js';
import { symbolKindToNodeLabel } from '../symbol-to-graph/mapping.js';
import type { DocumentSymbolLsp } from './lsp-client.js';
import { getDocumentSymbolsFromLsp } from './lsp-client.js';

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
  const label = symbolKindToNodeLabel(item.sym.detail ?? '');
  if (!label) return null;
  const props: SymbolProps = {
    name: item.sym.name,
    qualifiedName: item.qualifiedName,
    path: documentPath,
  };
  const relations: SymbolRelation[] = [];
  relations.push({ from: item.qualifiedName, to: documentPath, type: 'IN_DOCUMENT' });
  if (parentQualifiedName) {
    relations.push({ from: item.qualifiedName, to: parentQualifiedName, type: 'IN_PACKAGE' });
  }
  return { label, props, relations };
}

/**
 * Get symbols and relations for a single file. Uses sysml-v2-lsp when available (SYSMLLSP_SERVER_PATH or node_modules).
 * Otherwise returns [] (graceful fallback).
 */
export async function getSymbolsForFile(filePath: string, content?: string): Promise<NormalizedSymbol[]> {
  const text = content ?? await readFile(filePath, 'utf-8').catch(() => '');
  const lspSymbols = await getDocumentSymbolsFromLsp(filePath, text);
  if (lspSymbols.length === 0) return [];

  const flat = flattenSymbols(lspSymbols, null);
  const normalized: NormalizedSymbol[] = [];
  for (const item of flat) {
    const parentQ = item.qualifiedName.includes('::') ? item.qualifiedName.slice(0, item.qualifiedName.lastIndexOf('::')) : null;
    const n = documentSymbolToNormalized(item, filePath, parentQ);
    if (n) normalized.push(n);
  }
  return normalized;
}

/**
 * Call after indexing to close the shared LSP client and free the process.
 */
export { closeLspClient } from './lsp-client.js';
