// The bar: the strip at the top of the page. The **record** button,
// the mode and the status line, in that order. docs/glossary.md, "The
// bar".
//
// Controls stay put (web/AGENTS.md): record and stop are one button of
// one width, `--pw-record-width`, so its words change and it does not
// move. The mode has a fixed width, and the status line comes last.

import type { JSX } from 'solid-js';
import type { EngineMode } from '@protowx/client';
import { StatusLine } from './StatusLine';

export interface BarProps {
  /** Whether a recording runs: the button reads stop. */
  recording: boolean;
  /** The changes the recording holds: each save and each delete. */
  changes: number;
  /** The mode, or undefined while the page has not chosen it. */
  mode?: EngineMode;
  status: string;
  /** Whether the record button takes a click; false before the engine starts. */
  canRecord: boolean;
  onRecord(): void;
}

/** The record button's words while a recording runs: `stop · 1 change`. */
export function stopWords(changes: number): string {
  return `stop · ${changes} ${changes === 1 ? 'change' : 'changes'}`;
}

export function Bar(props: BarProps): JSX.Element {
  return (
    <header class="bar" data-term="bar">
      <button
        type="button"
        class="record"
        data-term="record"
        aria-pressed={props.recording}
        disabled={!props.canRecord}
        title={
          props.recording
            ? 'end the recording, and open the feedback dialog'
            : 'start a feedback recording: the store, every message to the engine, and the status line'
        }
        onClick={() => props.onRecord()}
      >
        {props.recording ? stopWords(props.changes) : 'record'}
      </button>
      <span class="mode" data-term="mode" title="which engine the page talks to">
        {props.mode ?? ''}
      </span>
      <StatusLine text={props.status} />
    </header>
  );
}
