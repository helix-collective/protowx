// The HTTP transport: the same ADL JSON the worker carries in a
// postMessage, carried in a fetch body instead. The engine runs as a
// native Go binary behind POST /api/calc (services/bff/engine.go),
// rather than as wasm in a worker.

import type { Request, Response } from './adl/api';
import type { Timed, Transport } from './engine';
import { decodeResponse, encodeRequest } from './protocol';
import { serverTiming } from './timing';

/**
 * Thrown when the transport itself failed: no server, a 405, a 413, a
 * body the server would not take.
 *
 * It is not an EngineError. An EngineError is a property of the
 * calculation, a text that does not parse or a divisor of zero, and the
 * page shows it beside the part it is about. A TransportError is a
 * property of the connection, and the page says it on the status line.
 */
export class TransportError extends Error {
  /** The HTTP status, or 0 when the request never got an answer. */
  readonly status: number;
  constructor(message: string, status: number, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'TransportError';
    this.status = status;
  }
}

/** Connected mode: one POST per request, the response in its body. */
export class HttpTransport implements Transport {
  private readonly abort = new AbortController();

  constructor(private readonly url: string) {}

  async request(req: Request): Promise<Response> {
    return (await this.requestTimed(req)).resp;
  }

  /**
   * The round trip with its parts: the server may send its lock wait
   * and its engine time in a `Server-Timing` header, and the rest of the
   * round trip is the network.
   */
  async requestTimed(req: Request): Promise<Timed> {
    let res: globalThis.Response;
    const t0 = performance.now();
    const body = encodeRequest(req);
    const encodeMs = performance.now() - t0;
    try {
      res = await fetch(this.url, {
        method: 'POST',
        body,
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        signal: this.abort.signal,
      });
    } catch (e) {
      throw new TransportError(`${this.url}: ${messageOf(e)}`, 0, { cause: e });
    }
    // An engine error is a 200 carrying the protocol's error branch, so
    // it falls through to decodeResponse, and TypedEngine throws the
    // same EngineError it would from the worker. Only a non-200 is this
    // transport's own failure.
    if (!res.ok) {
      throw new TransportError(`${this.url}: ${res.status} ${res.statusText}: ${await bodyText(res)}`, res.status);
    }
    const text = await res.text();
    const server = serverTiming(res.headers.get('server-timing'));
    try {
      const t1 = performance.now();
      const resp = decodeResponse(text);
      return {
        resp,
        timing: {
          encodeMs,
          queuedMs: server['lock'],
          engineMs: server['engine'],
          decodeMs: performance.now() - t1,
          requestChars: body.length,
          responseChars: text.length,
        },
      };
    } catch (e) {
      // A 200 that does not decode is not a protocol value either: the
      // engine would have answered with an error branch. Something
      // between the page and the engine answered instead: a proxy, or an
      // index.html from a fallback.
      throw new TransportError(`${this.url}: the answer was not a response: ${messageOf(e)}`, res.status, { cause: e });
    }
  }

  /** Matches worker.terminate(): every request in flight is abandoned. */
  dispose(): void {
    this.abort.abort();
  }
}

/** The server's plain-text reason, trimmed to something loggable. */
async function bodyText(res: globalThis.Response): Promise<string> {
  try {
    return (await res.text()).trim().slice(0, 200);
  } catch {
    return '';
  }
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
