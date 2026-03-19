/**
 * Worker protocol: NDJSON over stdio.
 * Request: { id, method, params? }
 * Response: { id, result? } | { id, error? }
 */

export interface WorkerRequest {
  id?: number;
  method: string;
  params?: Record<string, unknown>;
}

export interface WorkerResponseOk {
  id: number;
  result: unknown;
}

export interface WorkerResponseErr {
  id: number;
  error: string;
}

export type WorkerResponse = WorkerResponseOk | WorkerResponseErr;

export function isWorkerResponseErr(r: WorkerResponse): r is WorkerResponseErr {
  return 'error' in r && typeof (r as WorkerResponseErr).error === 'string';
}
