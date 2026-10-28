// The dictation in node, on a fake microphone and a fake My Whisper:
// what is posted, the words answered, and the text they land in.

import { describe, expect, it } from 'vitest';
import { Dictation, dictatedLine, withDictated, wordsOf, type DictationDeps } from '../src/dictation';
import type { MicSink } from '../src/narrationMic';

/** A fake microphone that the test feeds, and a fake service that answers `segments`. */
function fakes(segments: { from: number; to: number; text: string }[]) {
  const seen: { url: string; bytes: number }[] = [];
  const mic = { started: 0, stopped: 0, closed: 0 };
  let sink: MicSink | undefined;
  const deps: DictationDeps = {
    openMic: (s) => {
      sink = s;
      return Promise.resolve({
        start: () => mic.started++,
        stop: () => mic.stopped++,
        close: () => mic.closed++,
      });
    },
    transcribe: async (url, w) => {
      seen.push({ url, bytes: (await w.arrayBuffer()).byteLength });
      return segments;
    },
  };
  return { deps, seen, mic, feed: (n: number) => sink!(new Int16Array(n), 0.5) };
}

describe('Dictation', () => {
  it('posts what the microphone heard as one WAV, and answers the words', async () => {
    const f = fakes([
      { from: 0, to: 900, text: ' x plus 3, ' },
      { from: 900, to: 1800, text: ' times y. ' },
    ]);
    const d = new Dictation('http://127.0.0.1:8090', f.deps);
    await d.start();
    f.feed(4000);
    f.feed(4000);
    expect(d.samples).toBe(8000);
    expect(await d.stop()).toBe('x plus 3, times y');
    expect(f.seen).toEqual([{ url: 'http://127.0.0.1:8090', bytes: 44 + 16000 }]);
    expect(f.mic).toEqual({ started: 1, stopped: 1, closed: 1 });
  });

  it('posts nothing when it heard nothing', async () => {
    const f = fakes([]);
    const d = new Dictation('http://x', f.deps);
    await d.start();
    expect(await d.stop()).toBe('');
    expect(f.seen).toEqual([]);
    expect(f.mic.closed).toBe(1);
  });

  it('throws why the microphone did not open', async () => {
    const d = new Dictation('http://x', {
      openMic: () => Promise.reject(new Error('the browser refused the microphone: NotAllowedError')),
      transcribe: () => Promise.resolve([]),
    });
    await expect(d.start()).rejects.toThrow('the browser refused the microphone');
  });

  it('lets go of the microphone at a cancel, and posts nothing', async () => {
    const f = fakes([{ from: 0, to: 1, text: 'x' }]);
    const d = new Dictation('http://x', f.deps);
    await d.start();
    f.feed(4000);
    d.cancel();
    expect(f.mic.closed).toBe(1);
    expect(await d.stop()).toBe('');
    expect(f.seen).toEqual([]);
  });
});

describe('the words in the text', () => {
  it('joins the segments, trimmed, without the empty ones and the full stop at the end', () => {
    expect(wordsOf([])).toBe('');
    expect(wordsOf([{ from: 0, to: 1, text: ' 2 + 3.' }])).toBe('2 + 3');
    expect(wordsOf([{ from: 0, to: 1, text: ' 2.5 + 3' }])).toBe('2.5 + 3');
    expect(
      wordsOf([
        { from: 0, to: 1, text: ' 2 ' },
        { from: 1, to: 2, text: '  ' },
        { from: 2, to: 3, text: '+ 3' },
      ]),
    ).toBe('2 + 3');
  });

  it('puts the words after the text, with one space, and keeps the text', () => {
    expect(withDictated('', '2 + 3')).toBe('2 + 3');
    expect(withDictated('(x + 3) ', '* y')).toBe('(x + 3) * y');
    expect(withDictated('x', '')).toBe('x');
  });

  it('says what it heard on the status line', () => {
    expect(dictatedLine('2 + 3')).toBe('dictated "2 + 3"');
    expect(dictatedLine('')).toBe('the dictation heard no words');
  });
});
