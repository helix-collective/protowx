// The page's client for My Whisper, `myw serve`: the probe, the WAV
// posted at finish for its segments, and the live streams, one per span
// of a narration. The dictate button posts the WAV. The service is another
// origin, so each call is a CORS request; the service names the origins
// it lets in. Nothing here imports Solid or the DOM: `fetch` and the
// `EventSource` are handed in, so a node test drives it with fakes.
// docs/features/001-calculator/prd.md section 5; services/myw/README.md
// is the service.

/** One line of the transcript: milliseconds into the audio the service was given. */
export interface Segment {
  from: number;
  to: number;
  text: string;
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const browserFetch: FetchLike = (url, init) => fetch(url, init);

/** How long the probe waits for /healthz before it calls the service gone. */
export const PROBE_MS = 2000;

/** The narration button's title when the probe found no service: the mode fell to `at finish`. */
export const NO_TRANSCRIBER = 'no transcriber; the audio is saved';

/**
 * Asks the service's /healthz, and answers whether a service answered
 * within PROBE_MS. No URL is no service. A refused origin, a closed
 * port and a timeout are all false: the caller falls back to saving the
 * audio untranscribed.
 */
export async function probe(url: string, fetchFn: FetchLike = browserFetch, ms: number = PROBE_MS): Promise<boolean> {
  if (url === '') return false;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), ms);
  try {
    const resp = await fetchFn(`${url}/healthz`, { signal: abort.signal });
    return resp.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Posts the WAV to /transcribe and answers the segments. It throws the
 * body's message when the service refuses or fails, which the page
 * says as why the audio was not transcribed. A fetch that fails
 * before any answer, a closed port or a refused origin, throws with the
 * URL: the browser's own words are "Failed to fetch" for both.
 */
export async function transcribeWav(url: string, wav: Blob, fetchFn: FetchLike = browserFetch): Promise<Segment[]> {
  let resp: Response;
  try {
    resp = await fetchFn(`${url}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'audio/wav' },
      body: wav,
    });
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    throw new Error(`the service at ${url} did not answer (${why}); it is not running, or it does not list this page's origin`);
  }
  if (!resp.ok) throw new Error(await answered(resp));
  return parseSegments(await resp.json());
}

/** The service's refusal as one message: its status, and its body when it has one. */
async function answered(resp: Response): Promise<string> {
  const text = (await resp.text()).trim();
  return text === '' ? `the service answered ${resp.status}` : `the service answered ${resp.status}: ${text}`;
}

/** The segments the service answered, checked and trimmed. */
function parseSegments(body: unknown): Segment[] {
  if (!Array.isArray(body)) throw new Error('the service answered no segments');
  return body.map((s: { from?: unknown; to?: unknown; text?: unknown }) => parseSegment(s));
}

function parseSegment(s: { from?: unknown; to?: unknown; text?: unknown }): Segment {
  if (typeof s.from !== 'number' || typeof s.to !== 'number' || typeof s.text !== 'string') {
    throw new Error('the service answered a malformed segment');
  }
  return { from: s.from, to: s.to, text: s.text.trim() };
}

// ---------------------------------------------------------------------
// the live streams

/** What a stream's events say: a partial that replaces the last, a final that is kept, or the end. */
export type LiveEvent = { kind: 'partial' | 'final'; seg: Segment } | { kind: 'end' };

/**
 * One span's transcript as the page keeps it, as plain values. The
 * finals are kept in order; the partial is the guess for the words
 * after them, and each one replaces the last. The close answers the
 * whole span's segments, which the report uses; when the close fails,
 * `segments` stays undefined, `why` says so, and the finals stand in.
 */
export interface SpanTranscript {
  finals: readonly Segment[];
  partial?: Segment;
  segments?: readonly Segment[];
  why?: string;
  /** True once the stream's events ended: the service closed it. */
  ended: boolean;
}

export const emptySpan = (): SpanTranscript => ({ finals: [], ended: false });

/** The transcript after one event. A new value; the old one is not touched. */
export function applyEvent(t: SpanTranscript, ev: LiveEvent): SpanTranscript {
  switch (ev.kind) {
    case 'partial':
      return { ...t, partial: ev.seg };
    case 'final':
      return { ...t, finals: [...t.finals, ev.seg], partial: undefined };
    case 'end':
      return { ...t, partial: undefined, ended: true };
  }
}

/** The transcript after the close answered the whole span's segments. */
export function closedWith(t: SpanTranscript, segments: readonly Segment[]): SpanTranscript {
  return { ...t, segments, partial: undefined, why: undefined };
}

/** The transcript after the close, or the open, failed: the finals stand in. */
export function closedWithout(t: SpanTranscript, why: string): SpanTranscript {
  return { ...t, partial: undefined, why };
}

/** The span's segments for the report: the close's, else the finals. */
export function spanSegments(t: SpanTranscript): readonly Segment[] {
  return t.segments ?? t.finals;
}

/** The browser's EventSource, as much of it as the client uses. */
export interface EventSourceLike {
  addEventListener(type: string, listener: (ev: { data: string }) => void): void;
  close(): void;
}

export interface LiveDeps {
  fetch: FetchLike;
  eventSource(url: string): EventSourceLike;
}

export const browserLiveDeps: LiveDeps = {
  fetch: browserFetch,
  eventSource: (url) => new EventSource(url),
};

/** How many samples one feed posts: about 250 ms at 16 kHz. */
export const SLICE_SAMPLES = 4000;

/**
 * One live stream in the service: one span of the narration. It opens
 * with `POST /live`, posts the samples it is fed in slices of about
 * 250 ms, in order, and reads the events from an `EventSource`. The
 * close flushes what is pending, then `DELETE /live/{id}`, and answers
 * the span's transcript with the whole span's segments.
 *
 * The stream exists from the first sample: samples fed before the open
 * answers wait, so the stream's time 0 is the span's start. A refused
 * open leaves the stream dead, and feeding it does nothing; the
 * narration goes on, and the span's transcript says why it has no
 * words.
 */
export class LiveStream {
  private state: SpanTranscript = emptySpan();
  private pending: Int16Array[] = [];
  private pendingLength = 0;
  private id?: string;
  private dead = false;
  private source?: EventSourceLike;
  /** The posts, one after the other: slices must reach the service in order. */
  private queue: Promise<void> = Promise.resolve();
  private closing?: Promise<SpanTranscript>;
  /** Resolves true once the service answered an id, false when it refused. */
  readonly opened: Promise<boolean>;

  constructor(
    private readonly url: string,
    private readonly deps: LiveDeps,
    private readonly onChange: () => void,
  ) {
    this.opened = this.open();
  }

  get transcript(): SpanTranscript {
    return this.state;
  }

  private async open(): Promise<boolean> {
    try {
      const resp = await this.deps.fetch(`${this.url}/live`, { method: 'POST' });
      if (!resp.ok) throw new Error(await answered(resp));
      const body = (await resp.json()) as { id?: unknown };
      if (typeof body.id !== 'string' || body.id === '') throw new Error('the service answered no stream id');
      this.id = body.id;
    } catch (e) {
      this.state = closedWithout(this.state, `the stream did not open: ${e instanceof Error ? e.message : String(e)}`);
      this.dead = true;
      this.pending = [];
      this.pendingLength = 0;
      this.onChange();
      return false;
    }
    if (this.dead) return false;
    this.listen();
    this.flush();
    return true;
  }

  /** The events: a partial, a final, and the end, each applied to the transcript. */
  private listen(): void {
    const es = this.deps.eventSource(`${this.url}/live/${this.id}/events`);
    this.source = es;
    const take = (data: string): Segment => parseSegment(JSON.parse(data) as { from?: unknown; to?: unknown; text?: unknown });
    es.addEventListener('partial', (ev) => this.apply({ kind: 'partial', seg: take(ev.data) }));
    es.addEventListener('final', (ev) => this.apply({ kind: 'final', seg: take(ev.data) }));
    es.addEventListener('end', () => {
      this.apply({ kind: 'end' });
      es.close();
    });
  }

  private apply(ev: LiveEvent): void {
    // After the close answered, nothing changes; while it is out, a
    // final is still kept, in case the close fails, and a partial is
    // not: the partial row went when the narration turned off.
    if (this.state.segments || (this.closing && ev.kind === 'partial')) return;
    this.state = applyEvent(this.state, ev);
    this.onChange();
  }

  /** Takes a block of 16 kHz samples; a slice is posted once enough are pending. */
  feed(samples: Int16Array): void {
    if (this.dead || this.closing || samples.length === 0) return;
    this.pending.push(samples);
    this.pendingLength += samples.length;
    if (this.id && this.pendingLength >= SLICE_SAMPLES) this.flush();
  }

  /** Posts what is pending as one slice, after the posts before it. */
  private flush(): void {
    if (!this.id || this.pendingLength === 0) return;
    // Over its own ArrayBuffer, which is what fetch takes as a body.
    const bytes = new Int16Array(new ArrayBuffer(this.pendingLength * 2));
    let at = 0;
    for (const p of this.pending) {
      bytes.set(p, at);
      at += p.length;
    }
    this.pending = [];
    this.pendingLength = 0;
    this.queue = this.queue.then(() => this.post(bytes)).catch(() => undefined);
  }

  private async post(bytes: Int16Array<ArrayBuffer>): Promise<void> {
    await this.deps.fetch(`${this.url}/live/${this.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: bytes,
    });
  }

  /**
   * Closes the stream and answers the span's transcript: the whole
   * span's segments when the close answered, else the finals with why.
   * Once started, a second call answers the same promise.
   */
  close(): Promise<SpanTranscript> {
    if (!this.closing) {
      this.closing = this.doClose();
      if (this.state.partial) {
        this.state = { ...this.state, partial: undefined };
        this.onChange();
      }
    }
    return this.closing;
  }

  private async doClose(): Promise<SpanTranscript> {
    if (!(await this.opened)) return this.state;
    this.flush();
    await this.queue;
    try {
      const resp = await this.deps.fetch(`${this.url}/live/${this.id}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error(await answered(resp));
      this.state = closedWith(this.state, parseSegments(await resp.json()));
    } catch (e) {
      this.state = closedWithout(this.state, `the close failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    this.source?.close();
    this.onChange();
    return this.state;
  }

  /** Drops the stream without a close: the probe found no service. */
  abandon(): void {
    this.dead = true;
    this.pending = [];
    this.pendingLength = 0;
    this.source?.close();
  }
}

/** Opens a live stream for one span. `onChange` is called on each event and at the close. */
export function openStream(url: string, deps: LiveDeps = browserLiveDeps, onChange: () => void = () => undefined): LiveStream {
  return new LiveStream(url, deps, onChange);
}
