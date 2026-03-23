import type { NormalizedSymbol } from '../types.js';

/** One file’s symbols after parsing; used for two-phase write and optional reference pass. */
export type IndexedFileBatch = { filePath: string; symbols: NormalizedSymbol[] };
