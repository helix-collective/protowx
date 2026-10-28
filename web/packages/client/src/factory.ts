// Where the page chooses which engine answers it. The two modes differ
// in a Transport and nothing else: the typed client, the protocol and
// every component above them are the same in both.
// docs/features/001-calculator/prd.md section 4.

import { type Engine, type Transport, TypedEngine } from './engine';
import { HttpTransport } from './http';
import type { RequestLog } from './log';
import { createWorkerTransport } from './workerEngine';

/**
 * offline: the Go engine as wasm in a Web Worker, over the memory
 * store. Slower to start, a large binary to fetch and instantiate, and
 * the only mode that works with no server.
 *
 * connected: the same Go engine as a native binary behind an HTTP API,
 * over bff's file store.
 */
export type EngineMode = 'offline' | 'connected';

export interface EngineConfig {
  mode: EngineMode;
  /** connected only: where the API is. */
  url?: string;
}

export const DEFAULT_API_URL = '/api/calc';

/**
 * The engine for a config. The page holds the result, and nothing
 * below it knows which mode it is in.
 *
 * The worker is built only on the offline path, so connected mode never
 * fetches the wasm binary. That is the one difference a reader sees in
 * the browser's network pane.
 *
 * A `log` records every message the transport carries, in either mode.
 * It wraps the transport, so the mode still shows through in nothing
 * above it.
 */
export function createEngine(cfg: EngineConfig, log?: RequestLog): Engine {
  const transport: Transport =
    cfg.mode === 'connected' ? new HttpTransport(cfg.url ?? DEFAULT_API_URL) : createWorkerTransport();
  return new TypedEngine(log ? log.wrap(transport) : transport);
}
