/**
 * sysml-v2-lsp integration: stdio LSP client.
 * Spawns the LSP server (dist/server/server.js). Uses LSP message framing (Content-Length).
 * Server path: SYSMLLSP_SERVER_PATH, or existing repo (walk up from cwd) first, then sysmledgraph's node_modules.
 */

import { spawn } from 'child_process';
import { pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const LSP_REL_PATH = join('sysml-v2-lsp', 'dist', 'server', 'server.js');

function findLspInNodeModules(startDir: string): string | null {
  let dir = startDir;
  for (;;) {
    const candidate = join(dir, 'node_modules', LSP_REL_PATH);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export interface DocumentSymbolLsp {
  name: string;
  detail?: string;
  kind: number;
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
  selectionRange?: { start: { line: number; character: number }; end: { line: number; character: number } };
  children?: DocumentSymbolLsp[];
}

async function resolveServerPath(): Promise<string | null> {
  if (process.env.SYSMLLSP_SERVER_PATH) {
    return process.env.SYSMLLSP_SERVER_PATH;
  }
  const fromRepo = findLspInNodeModules(process.cwd());
  if (fromRepo) return fromRepo;
  const packageRoot = join(__dirname, '..', '..', '..');
  const local = join(packageRoot, 'node_modules', LSP_REL_PATH);
  if (existsSync(local)) return local;
  return null;
}

function sendLspMessage(proc: ReturnType<typeof spawn>, body: string): void {
  const buf = Buffer.from(body, 'utf8');
  proc.stdin?.write(`Content-Length: ${buf.length}\r\n\r\n`, 'utf8');
  proc.stdin?.write(buf, 'utf8');
}

/** Create a reader that yields one LSP message at a time from stdout. */
function createMessageReader(proc: ReturnType<typeof spawn>): () => Promise<string> {
  let buffer = '';
  let contentLength: number | null = null;
  let waiting: { resolve: (s: string) => void; reject: (e: Error) => void } | null = null;

  proc.stdout?.setEncoding('utf8');
  proc.stdout?.on('data', (chunk: string) => {
    buffer += chunk;
    for (;;) {
      if (contentLength === null) {
        const idx = buffer.indexOf('\r\n\r\n');
        if (idx === -1) break;
        const header = buffer.slice(0, idx);
        const m = header.match(/Content-Length:\s*(\d+)/i);
        contentLength = m ? parseInt(m[1], 10) : 0;
        buffer = buffer.slice(idx + 4);
      }
      if (contentLength !== null && buffer.length >= contentLength) {
        const body = buffer.slice(0, contentLength);
        buffer = buffer.slice(contentLength);
        contentLength = null;
        if (waiting) {
          waiting.resolve(body);
          waiting = null;
        }
      } else break;
    }
  });

  return () =>
    new Promise<string>((resolve, reject) => {
      if (buffer.length > 0 && contentLength !== null && buffer.length >= contentLength) {
        const body = buffer.slice(0, contentLength);
        buffer = buffer.slice(contentLength);
        contentLength = null;
        resolve(body);
        return;
      }
      waiting = { resolve, reject };
    });
}

function runLspRequest(
  proc: ReturnType<typeof spawn>,
  readNext: () => Promise<string>,
  method: string,
  params: unknown,
  id: number
): Promise<unknown> {
  const body = JSON.stringify({ jsonrpc: '2.0', id, method, params });
  sendLspMessage(proc, body);
  return (async () => {
    for (;;) {
      const raw = await readNext();
      const msg = JSON.parse(raw);
      if (msg.id === id) {
        if (msg.error) throw new Error(msg.error.message || JSON.stringify(msg.error));
        return msg.result;
      }
    }
  })();
}

function sendNotification(proc: ReturnType<typeof spawn>, method: string, params: unknown): void {
  sendLspMessage(proc, JSON.stringify({ jsonrpc: '2.0', method, params }));
}

let requestId = 1;
function nextId(): number {
  return requestId++;
}

export async function createLspClient(): Promise<{
  getDocumentSymbols: (uri: string, content: string) => Promise<DocumentSymbolLsp[]>;
  close: () => void;
}> {
  const path = await resolveServerPath();
  if (!path) {
    throw new Error(
      'sysml-v2-lsp not found. Set SYSMLLSP_SERVER_PATH or: npm install github:daltskin/sysml-v2-lsp && cd node_modules/sysml-v2-lsp && npm run build'
    );
  }

  const proc = spawn(process.execPath, [path], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: dirname(path),
  });

  proc.stderr?.on('data', () => {});

  const readNext = createMessageReader(proc);

  await runLspRequest(proc, readNext, 'initialize', {
    processId: process.pid,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null,
  }, nextId());

  sendNotification(proc, 'initialized', {});
  await new Promise((r) => setTimeout(r, 200));

  async function getDocumentSymbols(uri: string, content: string): Promise<DocumentSymbolLsp[]> {
    const docUri = uri.startsWith('file:') ? uri : pathToFileURL(uri).href;
    sendNotification(proc, 'textDocument/didOpen', {
      textDocument: { uri: docUri, languageId: 'sysml', version: 1, text: content },
    });
    await new Promise((r) => setTimeout(r, 150));
    const result = await runLspRequest(
      proc,
      readNext,
      'textDocument/documentSymbol',
      { textDocument: { uri: docUri } },
      nextId()
    );
    return (result as DocumentSymbolLsp[]) ?? [];
  }

  function close() {
    proc.kill('SIGTERM');
  }

  return { getDocumentSymbols, close };
}

let sharedClient: Awaited<ReturnType<typeof createLspClient>> | null = null;

/** Requires sysml-v2-lsp to be installed and built (see README). Throws if LSP is unavailable. */
export async function getDocumentSymbolsFromLsp(filePath: string, content: string): Promise<DocumentSymbolLsp[]> {
  if (!sharedClient) {
    sharedClient = await createLspClient();
  }
  const uri = pathToFileURL(filePath).href;
  return await sharedClient.getDocumentSymbols(uri, content);
}

export function closeLspClient(): void {
  if (sharedClient) {
    sharedClient.close();
    sharedClient = null;
  }
}
