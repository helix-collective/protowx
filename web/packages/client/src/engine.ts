// The Engine interface the components and the app program against, and
// the typed client that implements it over any transport. A transport
// moves one request to the engine and one response back. The worker is
// one (workerEngine.ts), the in-thread loader another (direct.ts), and
// HTTP a third (http.ts).

import type { EvaluateResp, ParseResp, Position, Request, Response } from './adl/api';
import type { Binding, Calculation, CalculationId } from './adl/model';
import type { EngineBoot, MessageTiming } from './timing';

/** One request in, one response out, in order. */
export interface Transport {
  request(req: Request): Promise<Response>;
  dispose(): void;
  /**
   * The same round trip, with where its time went. A transport that can
   * see inside its round trip offers it; the request log prefers it.
   */
  requestTimed?(req: Request): Promise<Timed>;
  /** The engine's start, once it has started or failed to. */
  boot?(): Promise<EngineBoot>;
}

/** A response and the parts of its round trip. */
export interface Timed {
  resp: Response;
  timing: MessageTiming;
}

/**
 * Thrown by every Engine method when the engine answers with its error
 * branch. `at` is where in the text, for a parse error; undefined for
 * every other error. The page shows a parse error under the text and
 * every other error beside the part it is about.
 */
export class EngineError extends Error {
  readonly at: Position | undefined;
  constructor(message: string, at?: Position) {
    super(message);
    this.name = 'EngineError';
    this.at = at;
  }
}

/** Thrown by a protocol mismatch: the engine answered with the wrong branch. */
export class ProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolError';
  }
}

/** What the page talks to: one method per request of spec/api.adl. A fake for a test implements the same. */
export interface Engine {
  /** Every calculation in the store, in the order they were made. */
  list(): Promise<Calculation[]>;
  /** One calculation by id. */
  get(id: CalculationId): Promise<Calculation>;
  /** Creates or updates: an empty id creates, and the answer carries the new id. */
  put(calc: Calculation): Promise<Calculation>;
  /** Forgets a calculation; answers its id. */
  delete(id: CalculationId): Promise<CalculationId>;
  /** The AST of a text and the text fully parenthesised, or an EngineError with `at`. */
  parse(text: string): Promise<ParseResp>;
  /** The value of a text under the bindings, and its printed form. */
  evaluate(text: string, bindings: Binding[]): Promise<EvaluateResp>;
  /** The engine's start, when the transport reports one: the worker does, HTTP does not. */
  boot(): Promise<EngineBoot> | undefined;
  dispose(): void;
}

/** The typed client over a transport. */
export class TypedEngine implements Engine {
  constructor(private readonly transport: Transport) {}

  async list(): Promise<Calculation[]> {
    const r = await this.send({ kind: 'list' });
    if (r.kind !== 'list') throw wrong('list', r);
    return r.value;
  }

  async get(id: CalculationId): Promise<Calculation> {
    const r = await this.send({ kind: 'get', value: id });
    if (r.kind !== 'got') throw wrong('got', r);
    return r.value;
  }

  async put(calc: Calculation): Promise<Calculation> {
    const r = await this.send({ kind: 'put', value: calc });
    if (r.kind !== 'put') throw wrong('put', r);
    return r.value;
  }

  async delete(id: CalculationId): Promise<CalculationId> {
    const r = await this.send({ kind: 'delete', value: id });
    if (r.kind !== 'deleted') throw wrong('deleted', r);
    return r.value;
  }

  async parse(text: string): Promise<ParseResp> {
    const r = await this.send({ kind: 'parse', value: text });
    if (r.kind !== 'parsed') throw wrong('parsed', r);
    return r.value;
  }

  async evaluate(text: string, bindings: Binding[]): Promise<EvaluateResp> {
    const r = await this.send({ kind: 'evaluate', value: { text, bindings } });
    if (r.kind !== 'evaluated') throw wrong('evaluated', r);
    return r.value;
  }

  boot(): Promise<EngineBoot> | undefined {
    return this.transport.boot?.();
  }

  dispose(): void {
    this.transport.dispose();
  }

  /** One round trip; the error branch is thrown as an EngineError. */
  private async send(req: Request): Promise<Response> {
    const resp = await this.transport.request(req);
    if (resp.kind === 'error') {
      const at = resp.value.at;
      throw new EngineError(resp.value.message, at.kind === 'just' ? at.value : undefined);
    }
    return resp;
  }
}

function wrong(want: string, got: Response): ProtocolError {
  return new ProtocolError(`the engine answered ${got.kind}, not ${want}`);
}
