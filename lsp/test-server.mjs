#!/usr/bin/env node
/**
 * Minimal test: spawn the LSP server in this folder and send initialize + documentSymbol.
 * Run from lsp/: node test-server.mjs
 */
import { spawn } from 'child_process';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

const serverPath = resolve(process.cwd(), 'node_modules/sysml-v2-lsp/dist/server/server.js');
const cwd = process.cwd();

function send(proc, body) {
  const buf = Buffer.from(body, 'utf8');
  proc.stdin?.write(`Content-Length: ${buf.length}\r\n\r\n`, 'utf8');
  proc.stdin?.write(buf, 'utf8');
}

function createReader(proc) {
  let buffer = '';
  let contentLength = null;
  let pending = null;
  proc.stdout?.setEncoding('utf8');
  proc.stdout?.on('data', (chunk) => {
    buffer += chunk;
    for (;;) {
      if (contentLength === null) {
        const idx = buffer.indexOf('\r\n\r\n');
        if (idx === -1) break;
        const m = buffer.slice(0, idx).match(/Content-Length:\s*(\d+)/i);
        contentLength = m ? parseInt(m[1], 10) : 0;
        buffer = buffer.slice(idx + 4);
      }
      if (contentLength !== null && buffer.length >= contentLength) {
        const body = buffer.slice(0, contentLength);
        buffer = buffer.slice(contentLength);
        contentLength = null;
        if (pending) {
          pending.resolve(body);
          pending = null;
        }
      } else break;
    }
  });
  return () => new Promise((res, rej) => { pending = { resolve: res, reject: rej }; });
}

async function request(proc, readNext, method, params, id) {
  send(proc, JSON.stringify({ jsonrpc: '2.0', id, method, params }));
  for (;;) {
    const raw = await readNext();
    const msg = JSON.parse(raw);
    if (msg.id === id) {
      if (msg.error) throw new Error(msg.error.message);
      return msg.result;
    }
  }
}

function notify(proc, method, params) {
  send(proc, JSON.stringify({ jsonrpc: '2.0', method, params }));
}

const sample = `package Sample {
  part def Foo {
    doc /* test */
  }
}`;

console.log('Spawning server:', serverPath);
console.log('cwd:', cwd);

const proc = spawn(process.execPath, [serverPath, '--stdio'], {
  cwd,
  stdio: ['pipe', 'pipe', 'pipe'],
});

proc.stderr?.on('data', () => {}); // server logs to stderr; ignore for quiet run

const readNext = createReader(proc);

async function run() {
  try {
    const rootUri = pathToFileURL(resolve(cwd, '.')).href;
    const init = await request(proc, readNext, 'initialize', {
      processId: process.pid,
      rootUri,
      capabilities: { textDocument: { documentSymbol: { hierarchicalDocumentSymbolSupport: true } } },
      workspaceFolders: [{ uri: rootUri, name: 'workspace' }],
    }, 1);
    console.log('Initialize result:', JSON.stringify(init, null, 2).slice(0, 500) + '...');

    notify(proc, 'initialized', {});
    await new Promise((r) => setTimeout(r, 300));

    const uri = pathToFileURL(resolve(cwd, 'sample.sysml')).href;
    notify(proc, 'textDocument/didOpen', {
      textDocument: { uri, languageId: 'sysml', version: 1, text: sample },
    });
    await new Promise((r) => setTimeout(r, 500));

    const symbols = await request(proc, readNext, 'textDocument/documentSymbol', { textDocument: { uri } }, 2);
    console.log('documentSymbol count:', Array.isArray(symbols) ? symbols.length : (symbols ? 1 : 0));
    if (Array.isArray(symbols) && symbols.length > 0) {
      console.log('First symbol:', JSON.stringify(symbols[0], null, 2));
    } else {
      console.log('documentSymbol result:', JSON.stringify(symbols).slice(0, 300));
    }
    console.log('OK — server responded.');
  } catch (e) {
    throw e;
  }
}

run().catch((e) => {
  console.error('Error:', e.message);
  process.exitCode = 1;
}).finally(() => {
  proc.kill('SIGTERM');
});
