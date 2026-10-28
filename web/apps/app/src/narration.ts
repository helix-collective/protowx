// The voice as plain values: 16 kHz mono 16-bit samples, cut from the
// device's rate, and the WAV that holds them. sheafdb's narration.ts,
// cut to its audio: the dictation needs no spans and no transcript.
// docs/features/001-calculator/prd.md section 5.
//
// Nothing here imports Solid or touches the microphone; narrationMic.ts
// hears the microphone and hands each block here. So a test in node can
// feed a sine and read the WAV back.

/** The rate the narration is kept at, and the only one whisper.cpp reads. */
export const RATE = 16_000;

/** A voice stops here: 30 minutes, about 58 MB of WAV. */
export const LIMIT_SAMPLES = RATE * 30 * 60;

/**
 * Cuts a stream of blocks at the device's rate to 16 kHz, by averaging
 * each run of input samples that falls in one output sample, and turns
 * the averages to 16-bit integers.
 *
 * It carries the run in flight from one block to the next. A block of
 * 128 samples at 48 kHz is 42.67 samples at 16 kHz, so a block cut on
 * its own would gain or lose a sample at each edge, and the narration's
 * length would drift from the time it was on.
 */
export class Downsampler {
  private readonly ratio: number;
  // Input samples seen so far, and the output sample the next one feeds.
  private seen = 0;
  private slot = 0;
  private sum = 0;
  private count = 0;

  constructor(rate: number) {
    this.ratio = rate / RATE;
  }

  push(block: Float32Array): Int16Array {
    const out: number[] = [];
    for (const v of block) {
      const slot = Math.floor(this.seen / this.ratio);
      if (slot !== this.slot && this.count > 0) {
        out.push(toInt16(this.sum / this.count));
        this.sum = 0;
        this.count = 0;
      }
      this.slot = slot;
      this.sum += v;
      this.count++;
      this.seen++;
    }
    return Int16Array.from(out);
  }
}

const toInt16 = (v: number): number => Math.round(Math.max(-1, Math.min(1, v)) * 0x7fff);

/**
 * One block at `rate` as 16 kHz samples. The last run, which the next
 * block would finish, is left out; Downsampler keeps it for a stream.
 */
export function downsample(block: Float32Array, rate: number): Int16Array {
  return new Downsampler(rate).push(block);
}

/**
 * The samples as a WAV file: the 44-byte RIFF header of 16 kHz mono
 * 16-bit PCM, then the samples. An Int16Array is in the platform's
 * byte order, which is little-endian everywhere the page runs, as WAV
 * is.
 */
export function wav(chunks: readonly Int16Array[]): Blob {
  const bytes = chunks.reduce((n, c) => n + c.byteLength, 0);
  const head = new DataView(new ArrayBuffer(44));
  const text = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) head.setUint8(at + i, s.charCodeAt(i));
  };
  text(0, 'RIFF');
  head.setUint32(4, 36 + bytes, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  head.setUint32(16, 16, true); // the fmt chunk's size
  head.setUint16(20, 1, true); // PCM
  head.setUint16(22, 1, true); // mono
  head.setUint32(24, RATE, true);
  head.setUint32(28, RATE * 2, true); // bytes a second
  head.setUint16(32, 2, true); // bytes a frame
  head.setUint16(34, 16, true); // bits a sample
  text(36, 'data');
  head.setUint32(40, bytes, true);
  return new Blob([head.buffer, ...chunks.map((c) => c.slice().buffer)], { type: 'audio/wav' });
}

/** The milliseconds that n samples at 16 kHz last. */
export const samplesMs = (n: number): number => (n * 1000) / RATE;
