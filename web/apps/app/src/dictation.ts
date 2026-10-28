// The dictation: the dictate button's half in the app. The first click
// opens the microphone and keeps its samples; the second stops it, posts
// the samples as one WAV to My Whisper, and answers the words. The app
// puts the words in the text. docs/features/001-calculator/prd.md
// section 5; docs/glossary.md, "dictate".
//
// The microphone and the service are handed in, so a node test drives
// the whole of it with fakes; App.tsx hands in narrationMic.ts and
// transcribeClient.ts. The microphone is let go of after each
// dictation, so the browser's indicator is on only while it listens.

import type { DictateState } from '@protowx/ui';
import { LIMIT_SAMPLES, wav } from './narration';
import type { Mic, MicSink } from './narrationMic';
import type { Segment } from './transcribeClient';

export interface DictationDeps {
  openMic(sink: MicSink): Promise<Mic>;
  transcribe(url: string, wav: Blob): Promise<Segment[]>;
}

/**
 * The words of the segments, as one line: each trimmed, empty ones left
 * out. Whisper ends a sentence with a full stop, which no expression
 * has, so one stop, `!` or `?` at the end goes.
 */
export function wordsOf(segments: readonly Segment[]): string {
  return segments
    .map((s) => s.text.trim())
    .filter((t) => t !== '')
    .join(' ')
    .replace(/\s*[.!?]$/, '');
}

/**
 * The text after a dictation: the words after the text, with one space
 * between them. The text is kept, so a dictation never loses what was
 * typed; an empty text is the words alone.
 */
export function withDictated(text: string, words: string): string {
  if (words === '') return text;
  const kept = text.trimEnd();
  return kept === '' ? words : `${kept} ${words}`;
}

/** The status line's sentence after a dictation. */
export function dictatedLine(words: string): string {
  return words === '' ? 'the dictation heard no words' : `dictated ${JSON.stringify(words)}`;
}

/** The dictate button's title in each state. */
export const DICTATE_TITLES: Record<DictateState, string> = {
  idle: 'speak an expression; a second click puts the words in the text',
  asking: 'waiting for the microphone',
  listening: 'click to stop and put the words in the text',
  transcribing: 'My Whisper is writing the words',
};

/**
 * One dictation. `start` opens the microphone and listens; `stop` lets
 * go of it and answers the words. A dictation is used once.
 */
export class Dictation {
  private mic?: Mic;
  private chunks: Int16Array[] = [];
  private kept = 0;

  constructor(
    private readonly url: string,
    private readonly deps: DictationDeps,
  ) {}

  /** Opens the microphone and starts to keep its samples. It throws why the microphone did not open. */
  async start(): Promise<void> {
    this.mic = await this.deps.openMic((samples) => this.keep(samples));
    this.mic.start();
  }

  private keep(samples: Int16Array): void {
    if (this.kept >= LIMIT_SAMPLES) return;
    this.chunks.push(samples);
    this.kept += samples.length;
  }

  /** The samples kept so far: 16 kHz, mono. */
  get samples(): number {
    return this.kept;
  }

  /**
   * Lets go of the microphone, posts what it heard, and answers the
   * words. Nothing heard is no words, and nothing is posted. It throws
   * the service's refusal.
   */
  async stop(): Promise<string> {
    this.mic?.stop();
    this.mic?.close();
    this.mic = undefined;
    if (this.kept === 0) return '';
    const audio = wav(this.chunks);
    this.chunks = [];
    return wordsOf(await this.deps.transcribe(this.url, audio));
  }

  /** Lets go of the microphone and drops what it heard: the page goes. */
  cancel(): void {
    this.mic?.close();
    this.mic = undefined;
    this.chunks = [];
    this.kept = 0;
  }
}
