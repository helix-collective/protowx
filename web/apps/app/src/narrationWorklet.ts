// The narration's AudioWorkletProcessor: it runs on the audio thread and
// posts the microphone's samples to the page, at the device's rate, in
// batches of BATCH. The page cuts them to 16 kHz as they arrive
// (narration.ts). A block of 128 posted on its own would be 375 messages
// a second at 48 kHz. docs/features/001-calculator/prd.md section 5.
//
// It also measures the peak of each block, and posts the largest since
// its last batch with the batch: a level meter's one number, measured
// on the audio thread.
//
// Vite builds it as a worker from the `?worker&url` import in
// narrationMic.ts. It writes no output: its one output, which keeps it
// in the graph the browser pulls, is silence.

// The audio thread's globals: in no TypeScript lib.
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare function registerProcessor(name: string, ctor: new () => AudioWorkletProcessor): void;

/** About 85 ms at 48 kHz. */
const BATCH = 4096;

/** One message to the page: the samples, and their peak, 0 to 1. */
export interface WorkletBatch {
  samples: Float32Array;
  peak: number;
}

class NarrationProcessor extends AudioWorkletProcessor {
  private buf = new Float32Array(BATCH);
  private at = 0;
  private peak = 0;

  process(inputs: Float32Array[][]): boolean {
    // The first channel of the first input: the narration is mono.
    const block = inputs[0]?.[0];
    if (!block) return true;
    for (const v of block) {
      const a = v < 0 ? -v : v;
      if (a > this.peak) this.peak = a;
    }
    for (let i = 0; i < block.length; ) {
      const n = Math.min(block.length - i, BATCH - this.at);
      this.buf.set(block.subarray(i, i + n), this.at);
      this.at += n;
      i += n;
      if (this.at === BATCH) {
        const batch: WorkletBatch = {
          samples: this.buf,
          peak: this.peak,
        };
        this.port.postMessage(batch, [this.buf.buffer]);
        this.buf = new Float32Array(BATCH);
        this.at = 0;
        this.peak = 0;
      }
    }
    return true;
  }
}

registerProcessor('narration', NarrationProcessor);
