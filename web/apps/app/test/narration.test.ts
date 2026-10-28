// The voice's audio in node: the cut to 16 kHz and the WAV. sheafdb's
// narration.test.ts, cut to the parts narration.ts keeps.

import { describe, expect, it } from 'vitest';
import { downsample, Downsampler, RATE, wav } from '../src/narration';

/** `seconds` of a 440 Hz sine at `rate`, at amplitude `peak`. */
function sine(rate: number, seconds: number, peak: number): Float32Array {
  const out = new Float32Array(Math.round(rate * seconds));
  for (let i = 0; i < out.length; i++) out[i] = peak * Math.sin((2 * Math.PI * 440 * i) / rate);
  return out;
}

const peakOf = (s: Int16Array) => s.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

describe('downsample', () => {
  it('cuts a 48 kHz sine to 16 kHz: a third of the length, and the peak kept', () => {
    const out = downsample(sine(48_000, 1, 0.5), 48_000);
    // The last run waits for the next block.
    expect(out.length).toBe(RATE - 1);
    // An average of three samples of a 440 Hz sine loses well under 1%.
    expect(peakOf(out)).toBeGreaterThan(0.49 * 0x7fff);
    expect(peakOf(out)).toBeLessThanOrEqual(0.5 * 0x7fff);
  });

  it('clamps past full scale', () => {
    expect([...downsample(new Float32Array([2, 2, 2, -2, -2, -2, 0]), 48_000)]).toEqual([0x7fff, -0x7fff]);
  });

  it('keeps the length of a stream in blocks of 128, at 48 and 44.1 kHz', () => {
    for (const rate of [48_000, 44_100]) {
      const all = sine(rate, 2, 0.5);
      const down = new Downsampler(rate);
      let n = 0;
      for (let i = 0; i < all.length; i += 128) n += down.push(all.subarray(i, i + 128)).length;
      expect(n).toBe(2 * RATE - 1);
    }
  });
});

describe('wav', () => {
  it('is the 44-byte header of 16 kHz mono 16-bit PCM, then the samples', async () => {
    const blob = wav([Int16Array.from([1, -1]), Int16Array.from([0x7fff])]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(bytes.buffer);
    const text = (at: number, n: number) => String.fromCharCode(...bytes.subarray(at, at + n));
    expect(blob.type).toBe('audio/wav');
    expect(bytes.length).toBe(44 + 6);
    expect(text(0, 4)).toBe('RIFF');
    expect(view.getUint32(4, true)).toBe(36 + 6);
    expect(text(8, 8)).toBe('WAVEfmt ');
    expect(view.getUint32(16, true)).toBe(16);
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint32(28, true)).toBe(32_000);
    expect(view.getUint16(32, true)).toBe(2);
    expect(view.getUint16(34, true)).toBe(16);
    expect(text(36, 4)).toBe('data');
    expect(view.getUint32(40, true)).toBe(6);
    expect([view.getInt16(44, true), view.getInt16(46, true), view.getInt16(48, true)]).toEqual([1, -1, 0x7fff]);
  });
});
