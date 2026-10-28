// Where the time goes: the engine's start, and each message's round trip
// cut into its parts. A bug report records both, so a page that gets
// slower can be read as numbers -- docs/features/001-calculator/prd.md section 6.
//
// Every time here is on the page's clock, `performance.now()` on the
// main thread. The worker has a clock of its own, so it sends absolute
// times, `performance.timeOrigin + performance.now()`, and the
// main-thread transport converts them with `onPageClock`.

/** One message's round trip, in parts. Absent means the transport cannot see it. */
export interface MessageTiming {
  /** The page writing the request as JSON. */
  encodeMs: number;
  /**
   * Waiting for the engine before it began: behind earlier requests, or
   * behind the engine's start, in a worker; for the server's lock, over
   * HTTP.
   */
  queuedMs?: number;
  /** The engine answering, from the request text to the response text. */
  engineMs?: number;
  /**
   * The reply waiting for the page's main thread, in a worker: grows when
   * the page is busy drawing, not when the engine is slow.
   */
  returnMs?: number;
  /** The page reading the response JSON. */
  decodeMs: number;
  requestChars: number;
  responseChars: number;
  /** The wasm engine's linear memory after the request, in bytes. */
  wasmMemory?: number;
}

/** The engine's start, on the page's clock. Connected mode has none. */
export interface EngineBoot {
  /** The page constructed the worker. */
  created: number;
  /** The worker's script began to run. */
  workerStart?: number;
  /** The worker asked for the wasm binary. */
  fetchStart?: number;
  /** The response's headers arrived. */
  fetchHeaders?: number;
  /** The last byte arrived, from the worker's resource timing. */
  downloadEnd?: number;
  /** Bytes on the wire, and the binary's size once decoded. */
  transferBytes?: number;
  wasmBytes?: number;
  /** Compiled and instantiated: streaming overlaps this with the download. */
  instantiated?: number;
  /** Go published its request function: the first request can be served. */
  ready?: number;
  /** Why it did not start. */
  error?: string;
}

/** An absolute time from another thread, on this thread's clock. */
export function onPageClock(abs: number | undefined): number | undefined {
  return abs === undefined ? undefined : abs - performance.timeOrigin;
}

/** This thread's time, as an absolute time another thread can convert. */
export function absNow(): number {
  return performance.timeOrigin + performance.now();
}

/**
 * Reads a `Server-Timing` header into its named durations:
 * `lock;dur=0.1, engine;dur=4.2` is `{lock: 0.1, engine: 4.2}`.
 */
export function serverTiming(header: string | null): Record<string, number> {
  const out: Record<string, number> = {};
  if (!header) return out;
  for (const part of header.split(',')) {
    const [name, ...params] = part.trim().split(';');
    if (!name) continue;
    for (const p of params) {
      const [k, v] = p.trim().split('=');
      if (k === 'dur' && v !== undefined && Number.isFinite(Number(v))) out[name.trim()] = Number(v);
    }
  }
  return out;
}
