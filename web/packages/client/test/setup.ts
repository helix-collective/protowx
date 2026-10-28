// Loads the real engine once per test file: the Go glue from the file
// task calc:wasm copies beside the binary, then the binary itself.

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { type Engine, TypedEngine, DirectTransport, loadEngine, type RequestFn } from '../src/index';

const wasmDir = fileURLToPath(new URL('../wasm/', import.meta.url));

let fn: Promise<RequestFn> | undefined;

/**
 * The engine's request function, shared by every test in the process.
 * The engine holds one memory store, so a test that changes it changes
 * it for the next test in the file.
 */
export function engineFn(): Promise<RequestFn> {
  if (!fn) {
    fn = (async () => {
      // wasm_exec.js is a classic script that assigns globalThis.Go.
      createRequire(import.meta.url)(wasmDir + 'wasm_exec.js');
      const bytes = await readFile(wasmDir + 'calc.wasm');
      return loadEngine(bytes, { TMPDIR: '/tmp' });
    })();
  }
  return fn;
}

/** A typed Engine over the in-process binary. */
export async function newEngine(): Promise<Engine> {
  return new TypedEngine(new DirectTransport(await engineFn()));
}
