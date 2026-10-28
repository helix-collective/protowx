// The Web Worker that hosts the engine. It serves postMessage envelopes
// {id, request} with {id, response}, both JSON text, in the order they
// arrive; the client on the main thread is WorkerTransport.
//
// It also says where its time goes. Once, when the engine has started
// or failed to, it posts a `boot` message: when this script ran, when
// the wasm response arrived and its last byte, its size, the compile,
// and when Go was ready. With each response it posts when the request
// arrived, when the engine began and ended, and the size of the wasm
// memory after it. Times are absolute, `timeOrigin + now`, because the
// worker's clock is not the page's; timing.ts converts them.
//
// Vite resolves the glue import and the wasm URL at build time, so the
// built site carries both beside the worker script.

import '../wasm/wasm_exec.js';
import { loadEngine, type RequestFn } from './direct';
import { absNow } from './timing';

export interface WorkerRequest {
  id: number;
  request: string;
}

/** When one request was served, in absolute milliseconds. */
export interface WorkerTiming {
  received: number;
  start: number;
  end: number;
  wasmMemory?: number;
}

/** The engine's start, in absolute milliseconds. */
export interface WorkerBoot {
  workerStart: number;
  fetchStart: number;
  fetchHeaders?: number;
  downloadEnd?: number;
  transferBytes?: number;
  wasmBytes?: number;
  instantiated?: number;
  ready?: number;
  error?: string;
}

export interface WorkerResponse {
  id: number;
  response?: string;
  error?: string;
  timing?: WorkerTiming;
  /** Sent once, with id 0, when the engine has started or failed to. */
  boot?: WorkerBoot;
}

const workerStart = absNow();
const wasmUrl = new URL('../wasm/calc.wasm', import.meta.url);
const boot: WorkerBoot = { workerStart, fetchStart: absNow() };
let memory: WebAssembly.Memory | undefined;

const ready: Promise<RequestFn> = loadEngine(
  fetch(wasmUrl).then((r) => {
    boot.fetchHeaders = absNow();
    return r;
  }),
  {},
  {
    instantiated: () => (boot.instantiated = absNow()),
    memory: (m) => (memory = m),
  },
);

const scope = self as unknown as {
  onmessage: ((ev: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(msg: WorkerResponse): void;
};

/** The wasm download's own entry, which only this thread can see. */
function download(): void {
  const entry = performance.getEntriesByName(wasmUrl.href)[0] as PerformanceResourceTiming | undefined;
  if (!entry) return;
  boot.downloadEnd = performance.timeOrigin + entry.responseEnd;
  boot.transferBytes = entry.transferSize;
  boot.wasmBytes = entry.decodedBodySize;
}

void ready.then(
  () => {
    boot.ready = absNow();
    download();
    scope.postMessage({ id: 0, boot });
  },
  (e: unknown) => {
    boot.error = e instanceof Error ? e.message : String(e);
    download();
    scope.postMessage({ id: 0, boot });
  },
);

scope.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const received = absNow();
  const { id, request } = ev.data;
  try {
    const fn = await ready;
    const start = absNow();
    const response = fn(request);
    const end = absNow();
    scope.postMessage({ id, response, timing: { received, start, end, wasmMemory: memory?.buffer.byteLength } });
  } catch (e) {
    scope.postMessage({ id, error: e instanceof Error ? e.message : String(e) });
  }
};
