// The microphone, for the dictation: getUserMedia, an AudioContext at
// the device's rate, and the worklet that posts its samples. Each batch
// is cut to 16 kHz here and handed to the sink, with the batch's peak
// for a level meter. docs/features/001-calculator/prd.md section 5.
//
// The context runs at the device's rate, not at 16 kHz: Firefox refuses
// to connect a microphone to a context of another rate.

import workletUrl from './narrationWorklet.ts?worker&url';
import type { WorkletBatch } from './narrationWorklet';
import { Downsampler } from './narration';

/** Why the microphone is not offered: the page is not in a secure context. */
export const NO_MIC = 'the microphone needs https or localhost';

/** True where the browser offers the microphone at all. */
export const micOffered = (): boolean => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

/** The open microphone. While stopped, the context is suspended and posts nothing. */
export interface Mic {
  start(): void;
  stop(): void;
  /** Lets go of the microphone: the browser's indicator goes. */
  close(): void;
}

/**
 * Where each batch goes: the samples at 16 kHz, and the batch's peak,
 * 0 to 1, for the level meter.
 */
export type MicSink = (samples: Int16Array, peak: number) => void;

/**
 * Asks for the microphone and connects it to the worklet. It throws the
 * reason when the page has no microphone to ask for, or the user or the
 * browser refuses. The context starts suspended; `start` resumes it.
 */
export async function openMic(sink: MicSink): Promise<Mic> {
  if (!micOffered()) throw new Error(NO_MIC);
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
  } catch (e) {
    throw new Error(`the browser refused the microphone: ${e instanceof Error ? e.message : String(e)}`);
  }
  const ctx = new AudioContext();
  try {
    await ctx.audioWorklet.addModule(workletUrl);
  } catch (e) {
    for (const t of stream.getTracks()) t.stop();
    void ctx.close();
    throw e;
  }
  await ctx.suspend();
  const source = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, 'narration');
  const down = new Downsampler(ctx.sampleRate);
  node.port.onmessage = (ev: MessageEvent<WorkletBatch>) => sink(down.push(ev.data.samples), ev.data.peak);
  source.connect(node);
  node.connect(ctx.destination);
  return {
    start: () => void ctx.resume(),
    stop: () => void ctx.suspend(),
    close() {
      node.port.onmessage = null;
      source.disconnect();
      node.disconnect();
      for (const t of stream.getTracks()) t.stop();
      void ctx.close();
    },
  };
}
