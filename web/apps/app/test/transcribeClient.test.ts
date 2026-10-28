// The service's client, against a fake fetch: the probe, and the WAV
// posted for its segments.

import { describe, expect, it } from 'vitest';
import { probe, transcribeWav, type FetchLike } from '../src/transcribeClient';

function fetching(answer: (url: string, init?: RequestInit) => Promise<Response>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const f: FetchLike = (url, init) => {
    calls.push({ url, init });
    return answer(url, init);
  };
  return { f, calls };
}

describe('probe', () => {
  it('is true when /healthz answers ok', async () => {
    const { f, calls } = fetching(() => Promise.resolve(new Response('ok base.en\n', { status: 200 })));
    expect(await probe('http://127.0.0.1:8090', f)).toBe(true);
    expect(calls.map((c) => c.url)).toEqual(['http://127.0.0.1:8090/healthz']);
  });

  it('is false with no URL, and asks nothing', async () => {
    const { f, calls } = fetching(() => Promise.resolve(new Response('ok')));
    expect(await probe('', f)).toBe(false);
    expect(calls).toEqual([]);
  });

  it('is false when the fetch throws or answers an error', async () => {
    expect(await probe('http://127.0.0.1:8090', () => Promise.reject(new TypeError('Failed to fetch')))).toBe(false);
    expect(await probe('http://127.0.0.1:8090', () => Promise.resolve(new Response('no', { status: 503 })))).toBe(false);
  });

  it('is false when nothing answers within the timeout, through the signal', async () => {
    const { f } = fetching(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    expect(await probe('http://127.0.0.1:8090', f, 10)).toBe(false);
  });
});

describe('transcribeWav', () => {
  const wav = new Blob(['RIFF....WAVE'], { type: 'audio/wav' });

  it('posts the WAV to /transcribe and answers the segments, trimmed', async () => {
    const segs = [
      { from: 0, to: 2400, text: ' And now I rename the group.' },
      { from: 2400, to: 5000, text: ' The cell should move with the group.' },
    ];
    const { f, calls } = fetching(() => Promise.resolve(new Response(JSON.stringify(segs), { status: 200 })));
    expect(await transcribeWav('http://127.0.0.1:8090', wav, f)).toEqual([
      { from: 0, to: 2400, text: 'And now I rename the group.' },
      { from: 2400, to: 5000, text: 'The cell should move with the group.' },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('http://127.0.0.1:8090/transcribe');
    expect(calls[0]!.init?.method).toBe('POST');
    expect((calls[0]!.init?.headers as Record<string, string>)['Content-Type']).toBe('audio/wav');
    expect(calls[0]!.init?.body).toBe(wav);
  });

  it('answers no segments as an empty list', async () => {
    expect(await transcribeWav('http://x', wav, () => Promise.resolve(new Response('[]')))).toEqual([]);
  });

  it("throws the body's message when the service fails", async () => {
    await expect(
      transcribeWav('http://x', wav, () => Promise.resolve(new Response('transcribing: the model is not loaded\n', { status: 500 }))),
    ).rejects.toThrow('the service answered 500: transcribing: the model is not loaded');
    await expect(transcribeWav('http://x', wav, () => Promise.resolve(new Response('', { status: 403 })))).rejects.toThrow(
      'the service answered 403',
    );
  });

  it('names the URL when nothing answers, a closed port or a refused origin', async () => {
    await expect(transcribeWav('http://x', wav, () => Promise.reject(new TypeError('Failed to fetch')))).rejects.toThrow(
      'the service at http://x did not answer (Failed to fetch)',
    );
    await expect(transcribeWav('http://x', wav, () => Promise.reject(new TypeError('Failed to fetch')))).rejects.toThrow(
      "it does not list this page's origin",
    );
  });

  it('throws on an answer that is not a list of segments', async () => {
    await expect(transcribeWav('http://x', wav, () => Promise.resolve(new Response('{"ok":true}')))).rejects.toThrow('no segments');
    await expect(transcribeWav('http://x', wav, () => Promise.resolve(new Response('[{"from":"0"}]')))).rejects.toThrow('malformed');
  });
});

// ---- the live streams ------------------------------------------------

import { applyEvent, closedWith, closedWithout, emptySpan, openStream, spanSegments, SLICE_SAMPLES, type EventSourceLike } from '../src/transcribeClient';

/** A fake EventSource: the test emits events on it. */
class FakeSource implements EventSourceLike {
  readonly listeners = new Map<string, ((ev: { data: string }) => void)[]>();
  closed = false;
  constructor(readonly url: string) {}
  addEventListener(type: string, listener: (ev: { data: string }) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  close(): void {
    this.closed = true;
  }
  emit(type: string, data: unknown = {}): void {
    for (const l of this.listeners.get(type) ?? []) l({ data: JSON.stringify(data) });
  }
}

/** A fake service: the open, the feeds it saw, the close's answer. */
function service(opts: { open?: Response; close?: () => Response } = {}) {
  const feeds: Int16Array[] = [];
  const calls: string[] = [];
  const sources: FakeSource[] = [];
  const f = (url: string, init?: RequestInit): Promise<Response> => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url.endsWith('/live') && init?.method === 'POST') {
      return Promise.resolve(opts.open ?? new Response(JSON.stringify({ id: 'abc' })));
    }
    if (init?.method === 'POST') {
      feeds.push(init.body as Int16Array);
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (init?.method === 'DELETE') return Promise.resolve(opts.close ? opts.close() : new Response('[]'));
    return Promise.reject(new Error(`unexpected ${url}`));
  };
  const deps = {
    fetch: f,
    eventSource: (url: string) => {
      const s = new FakeSource(url);
      sources.push(s);
      return s;
    },
  };
  return { deps, feeds, calls, sources };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('applyEvent', () => {
  it('keeps the finals in order, replaces the partial, and clears it at a final and at the end', () => {
    const a = { from: 0, to: 700, text: 'the cell' };
    const b = { from: 0, to: 1400, text: 'the cell should' };
    const c = { from: 0, to: 2400, text: 'The cell should move.' };
    const d = { from: 2400, to: 3000, text: 'It' };
    let t = emptySpan();
    t = applyEvent(t, { kind: 'partial', seg: a });
    expect(t).toEqual({ finals: [], partial: a, ended: false });
    t = applyEvent(t, { kind: 'partial', seg: b });
    expect(t.partial).toEqual(b);
    t = applyEvent(t, { kind: 'final', seg: c });
    expect(t).toEqual({ finals: [c], partial: undefined, ended: false });
    t = applyEvent(t, { kind: 'partial', seg: d });
    t = applyEvent(t, { kind: 'end' });
    expect(t).toEqual({ finals: [c], partial: undefined, ended: true });
    expect(spanSegments(t)).toEqual([c]);
    expect(spanSegments(closedWith(t, [a]))).toEqual([a]);
    expect(closedWithout(t, 'the close failed').why).toBe('the close failed');
    expect(spanSegments(closedWithout(t, 'x'))).toEqual([c]);
  });
});

describe('openStream', () => {
  const url = 'http://127.0.0.1:8090';
  const block = (n: number, v: number) => new Int16Array(n).fill(v);

  it('opens, feeds in slices of about 250 ms in order, takes the events, and closes with the segments', async () => {
    const segs = [{ from: 0, to: 2400, text: ' The cell should move with the group.' }];
    const svc = service({ close: () => new Response(JSON.stringify(segs)) });
    let changes = 0;
    const s = openStream(url, svc.deps, () => changes++);
    // Fed before the open answers: nothing is lost.
    s.feed(block(1000, 1));
    expect(await s.opened).toBe(true);
    expect(svc.sources).toHaveLength(1);
    expect(svc.sources[0]!.url).toBe(`${url}/live/abc/events`);
    await tick();
    // 1000 pending went out at the open; then 3000 + 1500 crosses the slice.
    expect(svc.feeds.map((f) => f.length)).toEqual([1000]);
    s.feed(block(3000, 2));
    expect(svc.feeds).toHaveLength(1);
    s.feed(block(1500, 3));
    await tick();
    expect(svc.feeds.map((f) => f.length)).toEqual([1000, 4500]);
    expect(svc.feeds[1]![0]).toBe(2);
    expect(svc.feeds[1]![3000]).toBe(3);
    expect(SLICE_SAMPLES).toBe(4000);
    const src = svc.sources[0]!;
    src.emit('partial', { from: 0, to: 700, text: ' the cell' });
    expect(s.transcript.partial).toEqual({ from: 0, to: 700, text: 'the cell' });
    src.emit('final', { from: 0, to: 2400, text: ' The cell should move with the group.' });
    expect(s.transcript).toEqual({ finals: [{ from: 0, to: 2400, text: 'The cell should move with the group.' }], partial: undefined, ended: false });
    expect(changes).toBe(2);
    s.feed(block(100, 4));
    src.emit('partial', { from: 2400, to: 3000, text: ' It' });
    expect(s.transcript.partial?.text).toBe('It');
    const closing = s.close();
    // The partial row goes at the close; a partial that still arrives is dropped, and a final is kept.
    expect(s.transcript.partial).toBeUndefined();
    src.emit('partial', { from: 2400, to: 3200, text: ' It stayed' });
    expect(s.transcript.partial).toBeUndefined();
    const closed = await closing;
    expect(svc.feeds.map((f) => f.length)).toEqual([1000, 4500, 100]);
    expect(closed.segments).toEqual([{ from: 0, to: 2400, text: 'The cell should move with the group.' }]);
    expect(spanSegments(closed)).toEqual(closed.segments);
    expect(src.closed).toBe(true);
    expect(svc.calls.at(-1)).toBe(`DELETE ${url}/live/abc`);
    // A second close is the same answer; a feed after the close goes nowhere.
    s.feed(block(10, 5));
    expect(await s.close()).toBe(closed);
    expect(svc.feeds).toHaveLength(3);
    // The end after the close changes nothing.
    src.emit('end');
    expect(s.transcript).toBe(closed);
  });

  it('keeps the finals with why when the close fails', async () => {
    const svc = service({ close: () => new Response('transcribing the span: out of memory\n', { status: 500 }) });
    const s = openStream(url, svc.deps);
    await s.opened;
    svc.sources[0]!.emit('final', { from: 0, to: 1000, text: 'one' });
    svc.sources[0]!.emit('partial', { from: 1000, to: 1500, text: 'tw' });
    const closed = await s.close();
    expect(closed.segments).toBeUndefined();
    expect(closed.partial).toBeUndefined();
    expect(closed.finals).toEqual([{ from: 0, to: 1000, text: 'one' }]);
    expect(closed.why).toBe('the close failed: the service answered 500: transcribing the span: out of memory');
    expect(spanSegments(closed)).toEqual(closed.finals);
  });

  it('ends when the service closes the stream, and the close still asks for the segments', async () => {
    const svc = service();
    const s = openStream(url, svc.deps);
    await s.opened;
    svc.sources[0]!.emit('partial', { from: 0, to: 500, text: 'a' });
    svc.sources[0]!.emit('end');
    expect(s.transcript).toEqual({ finals: [], partial: undefined, ended: true });
    expect(svc.sources[0]!.closed).toBe(true);
    expect((await s.close()).segments).toEqual([]);
  });

  it('is dead when the open is refused: feeds go nowhere, the close answers no words and why', async () => {
    const svc = service({ open: new Response('the origin is not allowed', { status: 403 }) });
    let changes = 0;
    const s = openStream(url, svc.deps, () => changes++);
    s.feed(block(5000, 1));
    expect(await s.opened).toBe(false);
    s.feed(block(5000, 1));
    await tick();
    expect(svc.feeds).toEqual([]);
    expect(svc.sources).toEqual([]);
    const closed = await s.close();
    expect(closed).toEqual({ finals: [], partial: undefined, ended: false, why: 'the stream did not open: the service answered 403: the origin is not allowed' });
    expect(changes).toBe(1);
    expect(svc.calls).toEqual([`POST ${url}/live`]);
  });

  it('is dead when nothing answers the open', async () => {
    const s = openStream(url, { fetch: () => Promise.reject(new TypeError('Failed to fetch')), eventSource: () => new FakeSource('') });
    expect(await s.opened).toBe(false);
    expect((await s.close()).why).toBe('the stream did not open: Failed to fetch');
  });

  it('abandons: no events, no close', async () => {
    const svc = service();
    const s = openStream(url, svc.deps);
    s.abandon();
    expect(await s.opened).toBe(false);
    s.feed(block(5000, 1));
    await tick();
    expect(svc.feeds).toEqual([]);
    expect(svc.sources).toEqual([]);
  });
});
