// A log of every message that crossed the transport.
//
// In connected mode the browser's network pane already shows each
// request: one POST per request, the response in its body. Offline mode
// has no such pane -- the messages are postMessage envelopes to a worker
// -- so the same thing is recorded here, and a feedback report reads it.
// It is a Transport decorator and sits below the typed client, so it
// sees every message both modes send, and neither mode knows it is there.
//
// What it holds is the typed Request and Response, not the wire text.
// The JSON is rendered from the value on demand, with formatRequest and
// formatResponse, for the one entry a reader opens.

import type { Request, Response } from './adl/api';
import type { Timed, Transport } from './engine';
import type { EngineBoot, MessageTiming } from './timing';

/**
 * pending: no answer yet. ok: a response. error: the engine's error
 * branch, which is a property of the calculation. failed: the transport
 * itself threw, which is a property of the connection.
 */
export type LogStatus = 'pending' | 'ok' | 'error' | 'failed';

/** One message and its answer. Entries are replaced, never mutated. */
export interface LogEntry {
  /** 1-based, in the order the messages were sent. */
  readonly seq: number;
  readonly kind: Request['kind'];
  readonly req: Request;
  /** Milliseconds from the log's first message to this one being sent. */
  readonly at: number;
  /** When it was sent, on the page's clock, `performance.now()`. */
  readonly sentAt?: number;
  readonly status: LogStatus;
  /** The round trip in milliseconds, once there is an answer. */
  readonly ms?: number;
  readonly resp?: Response;
  /** The transport's failure, when status is 'failed'. */
  readonly error?: string;
  /** Where the round trip went, when the transport can see inside it. */
  readonly timing?: MessageTiming;
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * The record of what the page has sent. It is framework-free: a reader
 * subscribes and reads a snapshot, so the pane that draws it is the only
 * thing that knows about signals.
 *
 * `limit` is a ring: the oldest entries are dropped, because a response
 * is held whole.
 */
export class RequestLog {
  private readonly listeners = new Set<() => void>();
  private readonly taps = new Set<(entry: LogEntry) => void>();
  private entries: LogEntry[] = [];
  private seq = 0;
  private origin = 0;
  private started: EngineBoot | undefined;

  constructor(private readonly limit: number = 200) {}

  /** The entries, oldest first. A fresh array, so it can be a signal's value. */
  snapshot(): LogEntry[] {
    return this.entries.slice();
  }

  /** Calls back on every change. Returns the unsubscribe. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * Calls back with every entry as it is begun and again as it is
   * ended. Returns the removal.
   *
   * It is the second seam, beside `subscribe`, and it does not read the
   * ring. A reader of snapshots sees only what the ring still holds at
   * the moment it reads. A feedback recording must see every message
   * from its start to its finish, so it taps. The two calls carry two
   * objects with one `seq`, because an entry is replaced, never
   * mutated; the second is the finished one.
   */
  tap(fn: (entry: LogEntry) => void): () => void {
    this.taps.add(fn);
    return () => this.taps.delete(fn);
  }

  /**
   * The `seq` of the last message begun, 0 before the first. A
   * recording notes it at its start: a message at or below it began
   * before the recording.
   */
  lastSeq(): number {
    return this.seq;
  }

  /** The engine's start, once the transport has reported it. */
  boot(): EngineBoot | undefined {
    return this.started;
  }

  setBoot(boot: EngineBoot): void {
    this.started = boot;
    this.notify();
  }

  clear(): void {
    this.entries = [];
    this.notify();
  }

  /** Wraps a transport so every message through it is recorded here. */
  wrap(inner: Transport): Transport {
    return new LoggingTransport(inner, this);
  }

  /** Records a message on its way out. The entry is the handle to end(). */
  begin(req: Request): LogEntry {
    const t = now();
    if (this.seq === 0) this.origin = t;
    const entry: LogEntry = {
      seq: ++this.seq,
      kind: req.kind,
      req,
      at: t - this.origin,
      sentAt: t,
      status: 'pending',
    };
    this.entries.push(entry);
    if (this.entries.length > this.limit) this.entries.splice(0, this.entries.length - this.limit);
    this.notify();
    this.pour(entry);
    return entry;
  }

  /** Records the answer, replacing the pending entry with a finished one. */
  end(entry: LogEntry, done: Pick<LogEntry, 'status'> & Partial<LogEntry>): void {
    // The entry can have been dropped by the limit while it was in
    // flight. The ring then has nothing to finish, but a tap still
    // hears of it: the ring is the pane's bound, not the recording's.
    const ended: LogEntry = {
      ...entry,
      ...done,
      ms: now() - this.origin - entry.at,
    };
    const at = this.entries.indexOf(entry);
    if (at >= 0) {
      this.entries[at] = ended;
      this.notify();
    }
    this.pour(ended);
  }

  private pour(entry: LogEntry): void {
    for (const fn of this.taps) fn(entry);
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }
}

/** A Transport that records what passes through it and changes nothing. */
export class LoggingTransport implements Transport {
  constructor(
    private readonly inner: Transport,
    private readonly log: RequestLog,
  ) {
    inner.boot?.().then(
      (b) => log.setBoot(b),
      () => undefined,
    );
  }

  async request(req: Request): Promise<Response> {
    const entry = this.log.begin(req);
    let resp: Response;
    let timing: MessageTiming | undefined;
    try {
      if (this.inner.requestTimed) {
        const timed: Timed = await this.inner.requestTimed(req);
        resp = timed.resp;
        timing = timed.timing;
      } else {
        resp = await this.inner.request(req);
      }
    } catch (e) {
      this.log.end(entry, {
        status: 'failed',
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
    this.log.end(entry, {
      status: resp.kind === 'error' ? 'error' : 'ok',
      resp,
      timing,
    });
    return resp;
  }

  boot(): Promise<EngineBoot> {
    return this.inner.boot ? this.inner.boot() : Promise.reject(new Error('this transport has no start to report'));
  }

  dispose(): void {
    this.inner.dispose();
  }
}
