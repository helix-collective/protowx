// The main-thread side of the worker: a Transport that posts envelopes
// and matches replies by id, and the factory the app calls.
//
// It times each round trip in parts -- the encode and the decode here,
// the queue and the engine in the worker, and the reply's wait for this
// thread -- and keeps the engine's start, which the worker posts once.
// See timing.ts.

import type { Request, Response } from './adl/api';
import { type Engine, type Timed, type Transport, TypedEngine } from './engine';
import { decodeResponse, encodeRequest } from './protocol';
import { absNow, onPageClock, type EngineBoot } from './timing';
import type { WorkerBoot, WorkerRequest, WorkerResponse } from './worker';

interface Pending {
  resolve(timed: Timed): void;
  reject(err: Error): void;
  /** Absolute time the envelope was posted. */
  sent: number;
  encodeMs: number;
  requestChars: number;
}

export class WorkerTransport implements Transport {
  private next = 1;
  private readonly pending = new Map<number, Pending>();
  private readonly created = performance.now();
  private booted!: (boot: EngineBoot) => void;
  private readonly started = new Promise<EngineBoot>((r) => (this.booted = r));

  constructor(private readonly worker: Worker) {
    worker.onmessage = (ev: MessageEvent<WorkerResponse>) => this.receive(ev.data);
    worker.onerror = (ev: ErrorEvent) => {
      const err = new Error(ev.message || 'worker error');
      this.booted({ created: this.created, error: err.message });
      this.fail(err);
    };
  }

  async request(req: Request): Promise<Response> {
    return (await this.requestTimed(req)).resp;
  }

  requestTimed(req: Request): Promise<Timed> {
    const id = this.next++;
    const t0 = performance.now();
    const request = encodeRequest(req);
    const encodeMs = performance.now() - t0;
    const envelope: WorkerRequest = { id, request };
    return new Promise<Timed>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, sent: absNow(), encodeMs, requestChars: request.length });
      this.worker.postMessage(envelope);
    });
  }

  boot(): Promise<EngineBoot> {
    return this.started;
  }

  dispose(): void {
    this.fail(new Error('engine disposed'));
    this.worker.terminate();
  }

  private receive(msg: WorkerResponse): void {
    if (msg.boot) {
      this.booted(bootOnPage(this.created, msg.boot));
      return;
    }
    const arrived = absNow();
    const p = this.pending.get(msg.id);
    if (!p) return;
    this.pending.delete(msg.id);
    if (msg.error !== undefined || msg.response === undefined) {
      p.reject(new Error(msg.error ?? 'empty reply from the engine worker'));
      return;
    }
    try {
      const t0 = performance.now();
      const resp = decodeResponse(msg.response);
      const decodeMs = performance.now() - t0;
      const w = msg.timing;
      p.resolve({
        resp,
        timing: {
          encodeMs: p.encodeMs,
          queuedMs: w ? Math.max(0, w.start - p.sent) : undefined,
          engineMs: w ? w.end - w.start : undefined,
          returnMs: w ? Math.max(0, arrived - w.end) : undefined,
          decodeMs,
          requestChars: p.requestChars,
          responseChars: msg.response.length,
          wasmMemory: w?.wasmMemory,
        },
      });
    } catch (e) {
      p.reject(e instanceof Error ? e : new Error(String(e)));
    }
  }

  private fail(err: Error): void {
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
  }
}

/** The worker's absolute times, on the page's clock. */
function bootOnPage(created: number, b: WorkerBoot): EngineBoot {
  return {
    created,
    workerStart: onPageClock(b.workerStart),
    fetchStart: onPageClock(b.fetchStart),
    fetchHeaders: onPageClock(b.fetchHeaders),
    downloadEnd: onPageClock(b.downloadEnd),
    transferBytes: b.transferBytes,
    wasmBytes: b.wasmBytes,
    instantiated: onPageClock(b.instantiated),
    ready: onPageClock(b.ready),
    error: b.error,
  };
}

/**
 * Starts the engine in a module worker and returns the transport to it.
 * Vite turns the URL into a built worker bundle with the wasm and the
 * glue beside it.
 */
export function createWorkerTransport(): Transport {
  return new WorkerTransport(new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }));
}

/** The engine over a worker of its own. createEngine({mode: 'offline'}). */
export function createWorkerEngine(): Engine {
  return new TypedEngine(createWorkerTransport());
}
