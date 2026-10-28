// The recorder: a recording while it runs on the page. It wires a
// Recorder of recording.ts to what it listens to, and lets go of it
// all at the end: the log's tap, which hears every message to the
// engine, and the window's uncaught errors and rejections. The status
// line's sentences come through `say`, from the page's one status
// setter, which is not a watch on a signal.
//
// It is paused while the feedback dialog is up, so nothing behind the
// dialog is kept, and resumed by keep recording.
//
// sheafdb's recorder.ts is the study's event recorder. The starter has
// no study, so this file holds what sheafdb's App.tsx does in
// beginRecording and stopRecording instead.

import type { RequestLog } from '@protowx/client';
import { createRecording, type Recorder, type Snapshot } from './recording';

/** The window events the recorder listens to, so a test can stand in for them. */
export interface RecorderHost {
  addEventListener(type: 'error', f: (ev: ErrorEvent) => void): void;
  addEventListener(type: 'unhandledrejection', f: (ev: PromiseRejectionEvent) => void): void;
  removeEventListener(type: 'error', f: (ev: ErrorEvent) => void): void;
  removeEventListener(type: 'unhandledrejection', f: (ev: PromiseRejectionEvent) => void): void;
}

/** A recording that runs. */
export interface LiveRecording {
  readonly rec: Recorder;
  /** One sentence of the status line, kept unless paused. */
  say(text: string): void;
  pause(): void;
  resume(): void;
  paused(): boolean;
  /** Lets go of the tap and the window. */
  end(): void;
}

/**
 * Starts a recording from `start`. The zero is the log's last message
 * now: a message begun before it is the snapshot's, not the
 * recording's. `changed` is called on each message, so the page draws
 * the count on stop again.
 */
export function startRecording(
  start: Snapshot,
  log: RequestLog,
  changed: () => void,
  now: () => number = () => performance.now(),
  host: RecorderHost = window,
): LiveRecording {
  const rec = createRecording({
    ...start,
    messageMark: log.lastSeq(),
  });
  let paused = false;
  const offTap = log.tap((entry) => {
    if (paused) return;
    rec.message(entry);
    changed();
  });
  const onError = (ev: ErrorEvent) => {
    if (!paused) rec.fail(now(), ev.message, ev.error instanceof Error ? ev.error.stack : undefined);
  };
  const onRejection = (ev: PromiseRejectionEvent) => {
    const r: unknown = ev.reason;
    if (!paused) rec.fail(now(), r instanceof Error ? r.message : String(r), r instanceof Error ? r.stack : undefined);
  };
  host.addEventListener('error', onError);
  host.addEventListener('unhandledrejection', onRejection);
  return {
    rec,
    say(text) {
      if (!paused) rec.say(now(), text);
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    paused: () => paused,
    end() {
      offTap();
      host.removeEventListener('error', onError);
      host.removeEventListener('unhandledrejection', onRejection);
    },
  };
}
