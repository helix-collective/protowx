// Runs the Go engine in the current thread through the Go toolchain's
// wasm_exec.js glue. The worker uses it to host the engine; the Vitest
// tests use it to drive the real binary under node without a browser.
//
// The glue must already have been loaded for its side effect of
// defining globalThis.Go. It is a classic script, so each host imports
// it its own way: the worker with an import, the tests by a require.

import type { Request, Response } from './adl/api';
import type { Transport } from './engine';
import { decodeResponse, encodeRequest } from './protocol';

/** The function Go publishes on the global: request JSON in, response JSON out. */
export type RequestFn = (json: string) => string;

/** What a host may hear of the engine's start; the worker records it. */
export interface LoadHooks {
  /** Compiled and instantiated. */
  instantiated?(): void;
  /** The engine's linear memory, so its size can be read per request. */
  memory?(mem: WebAssembly.Memory): void;
}

interface GoInstance {
  importObject: WebAssembly.Imports;
  env: Record<string, string>;
  argv: string[];
  exit: (code: number) => void;
  run(instance: WebAssembly.Instance): Promise<void>;
}

interface GoGlobal {
  Go: new () => GoInstance;
  calcRequest?: RequestFn;
}

const G = globalThis as unknown as GoGlobal;

/**
 * Instantiates the engine binary and resolves once Go has published
 * calcRequest. The environment handed to the instance is only what is
 * passed here: the glue would otherwise copy the whole process
 * environment in, and a large shell environment overflows Go's limit on
 * argv plus envp.
 */
export async function loadEngine(
  source: BufferSource | PromiseLike<globalThis.Response> | globalThis.Response,
  env: Record<string, string> = {},
  hooks: LoadHooks = {},
): Promise<RequestFn> {
  if (typeof G.Go !== 'function') {
    throw new Error('wasm_exec.js has not been loaded: globalThis.Go is undefined');
  }
  const go = new G.Go();
  go.env = env;
  go.argv = ['calc'];
  let exited: Error | undefined;
  go.exit = (code: number) => {
    exited = new Error(`the engine exited with code ${code}`);
  };
  const { instance } = isBufferSource(source)
    ? await WebAssembly.instantiate(source, go.importObject)
    : await WebAssembly.instantiateStreaming(source, go.importObject);
  hooks.instantiated?.();
  // Go's linker exports the linear memory as `mem`.
  const mem = instance.exports['mem'];
  if (mem instanceof WebAssembly.Memory) hooks.memory?.(mem);
  void go.run(instance).catch((e: unknown) => {
    exited = e instanceof Error ? e : new Error(String(e));
  });
  // main publishes the function and blocks; the scheduler yields to the
  // event loop once every goroutine is parked, so it is there after a tick.
  for (let i = 0; i < 1000; i++) {
    if (typeof G.calcRequest === 'function') return G.calcRequest;
    if (exited) throw exited;
    await new Promise((r) => setTimeout(r, 1));
  }
  throw new Error('the engine did not publish calcRequest');
}

function isBufferSource(s: unknown): s is BufferSource {
  return s instanceof ArrayBuffer || ArrayBuffer.isView(s);
}

/** A Transport over an in-thread engine. */
export class DirectTransport implements Transport {
  constructor(private readonly fn: RequestFn) {}

  request(req: Request): Promise<Response> {
    return Promise.resolve(serve(this.fn, req));
  }

  dispose(): void {}
}

/** One round trip through the engine, typed at both ends. */
export function serve(fn: RequestFn, req: Request): Response {
  return decodeResponse(fn(encodeRequest(req)));
}
