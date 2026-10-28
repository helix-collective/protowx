// A feedback recording: two snapshots and what passed between them.
//
// The record button takes the first snapshot and stop the second. Each
// holds the Store as the engine has it, read by a `list`. Between them
// three things are kept, and nothing is polled: every message to the
// engine, through `RequestLog.tap`; every sentence the status line
// says; and the page's own uncaught errors. The store changes only by a
// message, a `put` or a `delete`, so the start's Store and those
// messages are the whole story of the model.
// docs/features/001-calculator/prd.md section 6.
//
// The start is the zero: a message that began before the record button
// is not kept, because its effect is in the start's Store already.
//
// This file holds plain values and imports nothing from Solid or the
// DOM, so a test can build a recording by hand and render it.

import type { Calculation, CalculationId, EngineBoot, EngineConfig, LogEntry, Request, Store } from '@protowx/client';

/** One end of the recording. */
export interface Snapshot {
  /** Milliseconds on the page's clock, `performance.now()`. */
  at: number;
  /** Wall-clock time, ISO 8601. */
  when: string;
  engine: EngineConfig;
  /** The store as the engine listed it; none when the list failed. */
  store?: Store;
  /** Why the list failed. */
  storeError?: string;
  /** The calculation in the form: its id, '' for a new one. */
  open?: CalculationId;
  /** The form as it stood, which may hold changes not saved yet. */
  form?: Calculation;
  url: string;
  userAgent: string;
  window: { width: number; height: number };
  /** The engine's start, once the transport has reported it. */
  boot?: EngineBoot;
  /**
   * At the start: the last message `seq` the log had begun. A message
   * at or below it began before the recording, and is not kept.
   */
  messageMark?: number;
}

/** One sentence of the status line, and when it was said. */
export interface Said {
  at: number;
  text: string;
}

/** One error the page did not catch. */
export interface Failure {
  at: number;
  message: string;
  stack?: string;
}

export interface Recording {
  start: Snapshot;
  /** Every message, by `seq`, each the entry as it was last seen. */
  messages: LogEntry[];
  status: Said[];
  errors: Failure[];
  /** How many messages began before the start and ended after it; they are not kept. */
  before: number;
  finish?: Snapshot;
}

/** A recording in progress. Nothing here reads the DOM or the engine. */
export interface Recorder {
  /** Keeps an entry under its `seq`; the ended one replaces the begun one. */
  message(entry: LogEntry): void;
  say(at: number, text: string): void;
  fail(at: number, message: string, stack?: string): void;
  /** Sets the second snapshot and answers the whole recording. */
  finish(snap: Snapshot): Recording;
  /** Takes the second snapshot off again, for keep recording. */
  drop(): void;
  /** The recording as it stands. */
  current(): Recording;
  /** How many messages changed the store: the count on stop. */
  mutations(): number;
}

/** The requests that change what the engine holds: the replay, and the count on stop. */
export function isMutation(req: Request): boolean {
  return req.kind === 'put' || req.kind === 'delete';
}

export function createRecording(start: Snapshot): Recorder {
  const bySeq = new Map<number, LogEntry>();
  const status: Said[] = [];
  const errors: Failure[] = [];
  const mark = start.messageMark ?? 0;
  const earlier = new Set<number>();
  let finish: Snapshot | undefined;

  const current = (): Recording => ({
    start,
    messages: [...bySeq.values()].sort((a, b) => a.seq - b.seq),
    status: status.slice(),
    errors: errors.slice(),
    before: earlier.size,
    finish,
  });

  return {
    message(entry) {
      if (entry.seq <= mark) {
        earlier.add(entry.seq);
        return;
      }
      bySeq.set(entry.seq, entry);
    },
    say(at, text) {
      status.push({ at, text });
    },
    fail(at, message, stack) {
      errors.push(stack === undefined ? { at, message } : { at, message, stack });
    },
    finish(snap) {
      finish = snap;
      return current();
    },
    drop() {
      finish = undefined;
    },
    current,
    mutations() {
      let n = 0;
      for (const e of bySeq.values()) if (isMutation(e.req) && e.status === 'ok') n++;
      return n;
    },
  };
}
