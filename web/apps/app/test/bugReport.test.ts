// The report rendered from a recording built by hand: it names the put,
// holds the store at both ends and the replay, and each kind holds its
// sections and no more.

import { describe, expect, it } from 'vitest';
import { RequestLog, emptyCalculation, type Calculation, type Request, type Response, type Store } from '@protowx/client';
import { askedFor, promptLine, renderReport, replayOf, reportName, SECTIONS, slug, summaryOf, table } from '../src/bugReport';
import { startRecording, type RecorderHost } from '../src/recorder';
import type { Snapshot } from '../src/recording';

const example: Calculation = {
  ...emptyCalculation(),
  id: '1',
  name: 'the example',
  text: '(x + 3) * y',
  bindings: [
    { name: 'x', value: 5 },
    { name: 'y', value: 1 },
  ],
};
const rent: Calculation = { ...emptyCalculation(), name: 'rent', text: 'a * 12', bindings: [{ name: 'a', value: 900 }] };

const snap = (at: number, store: Store, form: Calculation): Snapshot => ({
  at,
  when: '2026-10-28T18:10:00.000Z',
  engine: { mode: 'connected', url: '/api/calc' },
  store,
  open: form.id,
  form,
  url: 'http://127.0.0.1:8080/',
  userAgent: 'test',
  window: { width: 1600, height: 900 },
});

const noWindow: RecorderHost = {
  addEventListener() {},
  removeEventListener() {},
};

/** A recording of one save and its list, over a log fed by hand. */
function recordedSave() {
  const log = new RequestLog();
  // A message before the start is the start's, and is not kept.
  log.end(log.begin({ kind: 'list' }), { status: 'ok', resp: { kind: 'list', value: [example] } });
  let t = 1000;
  const live = startRecording(snap(t, { calculations: [example] }, emptyCalculation()), log, () => {}, () => (t += 500), noWindow);
  const send = (req: Request, resp: Response) => log.end(log.begin(req), { status: resp.kind === 'error' ? 'error' : 'ok', resp });
  const saved = { ...rent, id: '2' };
  send({ kind: 'put', value: rent }, { kind: 'put', value: saved });
  send({ kind: 'list' }, { kind: 'list', value: [example, saved] });
  live.say('saved "rent"');
  send({ kind: 'evaluate', value: { text: '10 / 0', bindings: [] } }, { kind: 'error', value: { message: 'division by zero: 10 / 0', at: { kind: 'nothing' } } });
  live.pause();
  const rec = live.rec.finish(snap(5000, { calculations: [example, saved] }, saved));
  live.end();
  return rec;
}

describe('renderReport', () => {
  it('names the put, in the replay and in the answers', () => {
    const rec = recordedSave();
    expect(rec.before).toBe(0);
    expect(rec.messages.map((m) => m.kind)).toEqual(['put', 'list', 'evaluate']);
    expect(replayOf(rec).map((r) => r.kind)).toEqual(['put']);
    const md = renderReport(rec, 'a save', 'The row did not show.', { full: false });
    expect(md).toContain('# a save');
    expect(md).toContain('The row did not show.');
    expect(md).toContain('## Replay');
    expect(md).toContain('{"put":{"id":"","name":"rent","text":"a * 12","bindings":[{"name":"a","value":900}]');
    expect(md).toContain('### 1. `put` a new calculation, "rent"');
    expect(md).toMatch(/- ok, [0-9.]+ ms: id 2, "rent"/);
    expect(md).toContain('| changes  | 1 request changed the store');
    expect(md).toContain('division by zero: 10 / 0');
  });

  it('holds the store at both ends, as bff --store writes it', () => {
    const md = renderReport(recordedSave(), 'a save', '', { full: false });
    const start = md.indexOf('## The store at the start');
    const end = md.indexOf('## The store at the end');
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(md.slice(start, end)).toContain('1 calculation, as `bff --store` writes the file:');
    expect(md.slice(end)).toContain('2 calculations');
    expect(md).toContain('"calculations": [');
  });

  it('holds each kind\'s sections and no more', () => {
    const rec = recordedSave();
    const heads = (kind: 'general' | 'ui' | 'engine' | 'prompt') =>
      renderReport(rec, 't', '', { full: false, kind })
        .split('\n')
        .filter((l) => l.startsWith('## '));
    expect(heads('general')).toContain('## The form');
    expect(heads('ui')).not.toContain('## Replay');
    expect(heads('ui')).toContain('## The form');
    expect(heads('engine')).not.toContain('## The form');
    expect(heads('prompt')).toEqual(['## What the user says', '## Environment', '## Reading list']);
    expect(SECTIONS.prompt.has('messages')).toBe(false);
  });

  it('writes every message in full with the option', () => {
    const md = renderReport(recordedSave(), 't', '', { full: true });
    expect(md).toContain('### 4 · `evaluate`');
    expect(md).toContain('"division by zero: 10 / 0"');
  });

  it('says the summary the dialog shows', () => {
    expect(summaryOf(recordedSave())).toBe('1 change, 3 messages');
  });
});

describe('the words', () => {
  it('asks for each request in a few words', () => {
    expect(askedFor({ kind: 'list' })).toBe('every calculation');
    expect(askedFor({ kind: 'delete', value: '3' })).toBe('id 3');
    expect(askedFor({ kind: 'evaluate', value: { text: 'x + 1', bindings: [{ name: 'x', value: 2 }] } })).toBe('"x + 1" with x = 2');
  });

  it('names a file by bff\'s rule', () => {
    expect(slug('A save: the row!')).toBe('a-save-the-row');
    expect(slug('')).toBe('bug');
    expect(reportName('a save', new Date(2026, 9, 28, 18, 10))).toBe('20261028-1810__a-save.md');
    expect(promptLine('question', '.bugreports/x.md')).toBe('Answer the question in .bugreports/x.md.');
  });

  it('aligns a table as md-table-fmt does', () => {
    expect(table(['a', 'bb'], [['ccc', 'd|e']])).toBe('| a   | bb  |\n|-----|-----|\n| ccc | d¦e |');
  });
});
