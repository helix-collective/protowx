// A recording rendered as one Markdown file, written to be read as the
// first thing in a prompt that says "fix this".
//
// The order of the sections is the order an agent reads: the complaint,
// the reproduction, the evidence, the context. Its core is the replay:
// the store at the start, as bff's --store file holds it, and every
// request that changed the store, as the protocol JSON that crossed. A
// test feeds the two to a fresh engine as they stand.
// docs/features/001-calculator/prd.md section 6.
//
// A report is feedback of a type: a bug, a feature request, an
// improvement, wording, a question or other. The type sets the
// paragraph under the heading and the copy as prompt line, and nothing
// else. The kind decides which sections the file holds, so a reader
// gets the evidence that bears on it and no more. What the user gave,
// the message and the screenshots, is in every kind. `general` is every
// section; the others are in `SECTIONS`.
//
// Nothing here reads the DOM, so a test renders a recording built by
// hand.

import {
  encodeRequest,
  formatRequest,
  formatResponse,
  calculationJson,
  storeJson,
  type Calculation,
  type LogEntry,
  type Request,
} from '@protowx/client';
// The words of the dialog, without its components: this file runs in
// node under the tests.
import { BUG_KINDS, type BugKind, type FeedbackType } from '@protowx/ui/feedback';
import { describeEngine } from './engineConfig';
import { isMutation, type Recording, type Snapshot } from './recording';

/** The type's sentence in the paragraph under the file's heading. */
const TYPE_LEAD: Record<FeedbackType, string> = {
  bug: 'It is a bug: the user says what is wrong, and the sections below are the evidence.',
  'feature request': 'It is a feature request: the user says what they want that the page does not do.',
  improvement: 'It is an improvement: the user says how a thing that works could work better.',
  wording: 'It is about wording: the user names a word, a label or a message that is wrong or unclear.',
  question: 'It is a question: the user does not know how to do a thing, and asks.',
  other: 'The user says what it is about.',
};

/** The copy as prompt line of each type, for the file at `path`. */
const TYPE_PROMPT: Record<FeedbackType, (path: string) => string> = {
  bug: (p) => `Fix the bug in ${p}.`,
  'feature request': (p) => `Write a PRD for the feature in ${p}.`,
  improvement: (p) => `Improve what ${p} describes.`,
  wording: (p) => `Fix the wording in ${p}.`,
  question: (p) => `Answer the question in ${p}.`,
  other: (p) => `Read the feedback in ${p}.`,
};

/** The one line the feedback dialog copies as a prompt, by type. */
export function promptLine(type: FeedbackType, path: string): string {
  return TYPE_PROMPT[type](path);
}

/** A section of the file after the user's own; the header's store rows are `model`. */
export type Section = 'model' | 'steps' | 'store' | 'replay' | 'answers' | 'page' | 'errors' | 'messages' | 'environment' | 'reading';

const EVERY: readonly Section[] = ['model', 'steps', 'store', 'replay', 'answers', 'page', 'errors', 'messages', 'environment', 'reading'];

/**
 * The sections each kind holds. `ui` holds no store and no message:
 * the steps, the form and the errors. `engine` holds the store and the
 * protocol, and not the form. `prompt` is a request rather than a
 * fault: the user's words, the screenshots, and where to start reading.
 */
export const SECTIONS: Record<BugKind, ReadonlySet<Section>> = {
  general: new Set(EVERY),
  ui: new Set(['steps', 'page', 'errors', 'environment', 'reading']),
  engine: new Set(['model', 'steps', 'store', 'replay', 'answers', 'errors', 'messages', 'environment', 'reading']),
  prompt: new Set(['environment', 'reading']),
};

/** What the file holds, in the paragraph under the header, by kind; after the type's sentence. */
const INTRO: Record<BugKind, string> = {
  general:
    'The status line says what the page did. ' +
    'The replay is the store at the start and the protocol JSON that changed it: feed both to a fresh engine to reproduce. ' +
    'The reading list at the end names where to start in the code.',
  ui: "It is about the page: the screenshots, the steps and the form show it. It holds no store and no message. The reading list at the end names the page's code.",
  engine:
    'It is about the engine. ' +
    'The replay is the store at the start and the protocol JSON that changed it: feed both to a fresh engine to reproduce. ' +
    'The reading list at the end names where to start in the code.',
  prompt: 'The screenshots show where. It holds no store. The reading list at the end names where to start in the code.',
};

/** The paragraph under the file's heading: what it is, by type, then what it holds, by kind. */
export function introOf(type: FeedbackType, kind: BugKind): string {
  return `Feedback from the protowx page, written to be read as a prompt. ${TYPE_LEAD[type]} ${INTRO[kind]}`;
}

export interface ReportOptions {
  /** Every message's request and response as JSON, not only the replay. */
  full: boolean;
  /** What the file holds; absent is `general`. */
  kind?: BugKind;
  /** What the feedback is; absent is `bug`. */
  type?: FeedbackType;
  /**
   * The screenshots: each file, relative to the report, when it was
   * taken, and the caption the user typed.
   */
  screenshots?: readonly { file: string; at: number; caption?: string }[];
}

/** The whole report. `title` and `message` are the dialog's two fields. */
export function renderReport(rec: Recording, title: string, message: string, opts: ReportOptions): string {
  const end = rec.finish;
  const replayed = rec.messages.filter((m) => isMutation(m.req));
  const kind = opts.kind ?? 'general';
  const type = opts.type ?? 'bug';
  const has = (s: Section): boolean => SECTIONS[kind].has(s);
  const out: string[] = [];

  out.push(`# ${oneLine(title) || 'Feedback'}`);
  out.push(
    table(
      ['', ''],
      [
        ['type', type],
        ['kind', kind],
        ['recorded', `${rec.start.when}, ${seconds((end?.at ?? rec.start.at) - rec.start.at)}`],
        ['engine', describeEngine(rec.start.engine)],
        ...(has('model')
          ? [
              ['store', `${storeCount(rec.start)} at the start, ${end ? storeCount(end) : 'unknown'} at the end`],
              ['changes', `${count(replayed.length, 'request')} changed the store`],
            ]
          : []),
      ],
    ),
  );
  out.push(introOf(type, kind));

  out.push('## What the user says');
  out.push(message.trim() === '' ? '_The user wrote nothing._' : message.trim());

  if (opts.screenshots && opts.screenshots.length > 0) {
    out.push('## Screenshots');
    out.push('The user took these during the recording, at the times given.');
    for (const [i, s] of opts.screenshots.entries()) {
      out.push(`![screenshot ${i + 1}, at ${clock(s.at - rec.start.at)}](${s.file})`);
      const caption = s.caption?.trim();
      if (caption) out.push(caption);
    }
  }

  if (has('steps')) {
    out.push('## Steps');
    out.push(...stepsSection(rec, has('messages')));
  }

  if (has('store')) {
    out.push('## The store at the start');
    out.push(...storeSection(rec.start));
  }

  if (has('replay')) {
    out.push('## Replay');
    out.push(...replaySection(replayed));
  }

  if (has('answers')) {
    out.push('## What the engine answered');
    out.push(...answersSection(replayed));
  }

  if (has('store')) {
    out.push('## The store at the end');
    out.push(...(end ? storeSection(end) : ['_The recording has no second snapshot._']));
  }

  if (has('page')) {
    out.push('## The form');
    out.push(...formSection(rec.start, end));
  }

  if (has('errors')) {
    out.push('## Errors');
    out.push(...errorsSection(rec));
  }

  if (has('messages')) {
    out.push('## Engine messages');
    out.push(...messagesSection(rec, opts));
  }

  if (has('environment')) {
    out.push('## Environment');
    out.push(
      table(
        ['', ''],
        [
          ['page', rec.start.url],
          ['engine', describeEngine(rec.start.engine)],
          ['user agent', rec.start.userAgent],
          ['window', `${rec.start.window.width} × ${rec.start.window.height}`],
        ],
      ),
    );
  }

  if (has('reading')) {
    out.push('## Reading list');
    out.push(...readingSection(rec, kind));
  }

  return out.join('\n\n') + '\n';
}

// ---------------------------------------------------------------------
// the sections

/**
 * Steps: the status line's sentences, and with the messages section the
 * requests that changed the store, merged by time.
 */
function stepsSection(rec: Recording, withChanges: boolean): string[] {
  const rows = [
    ...rec.status.map((s) => ({ at: s.at, what: 'status', text: s.text })),
    ...(withChanges
      ? rec.messages.filter((m) => isMutation(m.req)).map((m) => ({ at: m.sentAt ?? rec.start.at, what: m.kind, text: askedFor(m.req) }))
      : []),
  ].sort((a, b) => a.at - b.at);
  if (rows.length === 0) return ['_The status line said nothing._'];
  return [
    table(
      ['time', 'what', 'text'],
      rows.map((r) => [clock(r.at - rec.start.at), r.what, r.text]),
    ),
  ];
}

/** One end's store, as bff's --store file holds it. */
function storeSection(s: Snapshot): string[] {
  if (!s.store) return [`_The engine did not list the store: ${s.storeError ?? 'no answer'}._`];
  return [
    `${count(s.store.calculations.length, 'calculation')}, as \`bff --store\` writes the file:`,
    fenced(JSON.stringify(storeJson(s.store), null, 2), 'json'),
  ];
}

/** The replay as values: every request that changed the store, in the order sent. */
export function replayOf(rec: Recording): Request[] {
  return rec.messages.filter((m) => isMutation(m.req)).map((m) => m.req);
}

function replaySection(replayed: LogEntry[]): string[] {
  const out: string[] = [];
  out.push(
    'Write the store at the start as the file of `bff --store`, start a fresh `bff` on it, and send each request below to `POST /api/calc`, in order. ' +
      (replayed.length === 0
        ? 'No request changed the store.'
        : replayed.length === 1
          ? 'The one request is the one that changed the store.'
          : `The ${replayed.length} requests are the ones that changed the store, in the order they were sent.`),
  );
  // Each request in the wire form, one to a line: what crossed, and
  // what a test of either side sends.
  const items = replayed.map((m) => `  ${encodeRequest(m.req)}`);
  out.push(fenced(`[\n${items.join(',\n')}\n]`, 'json'));
  return out;
}

function answersSection(replayed: LogEntry[]): string[] {
  if (replayed.length === 0) return ['_No request changed the store._'];
  return replayed.map((m, i) =>
    [`### ${i + 1}. \`${m.kind}\` ${askedFor(m.req)}`, `- ${m.status}${m.ms === undefined ? '' : `, ${m.ms.toFixed(1)} ms`}: ${answerOf(m)}`].join(
      '\n\n',
    ),
  );
}

/** The form at both ends: the open calculation, and the record as the form held it. */
function formSection(start: Snapshot, end: Snapshot | undefined): string[] {
  const part = (label: string, s: Snapshot): string[] => [
    `### ${label}`,
    s.form === undefined
      ? '_The form held nothing._'
      : `${s.open ? `The form held the calculation \`${s.open}\`` : 'The form held a new calculation'}:\n\n${fenced(JSON.stringify(calculationJson(s.form), null, 2), 'json')}`,
  ];
  return [...part('At the start', start), ...(end ? part('At the end', end) : [])];
}

function errorsSection(rec: Recording): string[] {
  const failed = rec.messages.filter((m) => m.status === 'error' || m.status === 'failed');
  if (rec.errors.length === 0 && failed.length === 0) return ['_No message failed, and the page threw nothing._'];
  const out: string[] = [];
  for (const m of failed) out.push(`- ${clock((m.sentAt ?? rec.start.at) - rec.start.at)} \`${m.kind}\` ${m.status}: ${answerOf(m)}`);
  for (const e of rec.errors) {
    out.push(`- ${clock(e.at - rec.start.at)} the page threw: ${oneLine(e.message)}`);
    if (e.stack) out.push(fenced(e.stack, 'text'));
  }
  return out;
}

function messagesSection(rec: Recording, opts: ReportOptions): string[] {
  const out: string[] = [];
  const n = rec.messages.length;
  if (rec.before > 0) out.push(`${count(rec.before, 'message')} begun before the recording ${rec.before === 1 ? 'is' : 'are'} not shown.`);
  out.push(
    `${count(n, 'message')} crossed to the engine during the recording. ` +
      (opts.full ? 'Each request is written in full below the table, with its response.' : 'The ones that changed the store are in the replay in full.'),
  );
  if (n === 0) return out;
  out.push(
    table(
      ['seq', 'request', 'asked for', 'answer', 'ms'],
      rec.messages.map((m) => [String(m.seq), m.kind, askedFor(m.req), answerOf(m), m.ms === undefined ? '' : m.ms.toFixed(1)]),
    ),
  );
  if (opts.full) {
    for (const m of rec.messages) {
      out.push(`### ${m.seq} · \`${m.kind}\``);
      out.push(fenced(formatRequest(m.req), 'json'));
      if (m.resp) out.push(fenced(formatResponse(m.resp), 'json'));
      if (m.error) out.push(fenced(m.error, 'text'));
    }
  }
  return out;
}

/** What a request asked for, in a few words. */
export function askedFor(req: Request): string {
  switch (req.kind) {
    case 'list':
      return 'every calculation';
    case 'get':
    case 'delete':
      return `id ${req.value}`;
    case 'put':
      return `${req.value.id === '' ? 'a new calculation' : `id ${req.value.id}`}, ${quoted(req.value.name)}`;
    case 'parse':
      return quoted(req.value);
    case 'evaluate':
      return `${quoted(req.value.text)}${req.value.bindings.length === 0 ? '' : ` with ${req.value.bindings.map((b) => `${b.name} = ${b.value}`).join(', ')}`}`;
  }
}

/** What a message got back, in a few words. */
export function answerOf(m: LogEntry): string {
  if (m.status === 'pending') return 'no answer';
  if (m.status === 'failed') return `the transport failed: ${m.error ?? ''}`;
  const r = m.resp;
  if (!r) return '';
  switch (r.kind) {
    case 'list':
      return count(r.value.length, 'calculation');
    case 'got':
      return `${quoted(r.value.name)}`;
    case 'put':
      return `id ${r.value.id}, ${quoted(r.value.name)}`;
    case 'deleted':
      return `id ${r.value}`;
    case 'parsed':
      return r.value.printed;
    case 'evaluated':
      return `${r.value.value}, ${r.value.printed}`;
    case 'error':
      return r.value.at.kind === 'just'
        ? `${r.value.message} (line ${r.value.at.value.line}, column ${r.value.at.value.column})`
        : r.value.message;
  }
}

// ---------------------------------------------------------------------
// the reading list

/** One kind of thing a report can show, and where its code is. */
export interface Reading {
  shows: string;
  files: string[];
  /** The kinds it bears on. */
  kinds: readonly BugKind[];
  /** Whether this recording shows it; absent means always. */
  when?(rec: Recording): boolean;
}

const MODEL: readonly BugKind[] = ['general', 'engine'];
const PAGE: readonly BugKind[] = ['general', 'ui', 'prompt'];

const sent = (rec: Recording, ...kinds: Request['kind'][]): boolean => rec.messages.some((m) => kinds.includes(m.req.kind));

/**
 * The files to open, by what the report shows. A row names files, so
 * this table is under the root AGENTS.md rule "Docs that quote the
 * code": a file it names that moves changes this table in that commit.
 */
export const readingList: readonly Reading[] = [
  {
    shows: 'the protocol: every request and response in the replay',
    kinds: MODEL,
    files: ['spec/api.adl', 'spec/model.adl', 'web/packages/client/src/engine.ts'],
  },
  {
    shows: 'a save or a delete, and the store',
    kinds: MODEL,
    files: ['engine/engine/engine.go', 'engine/store/store.go', 'services/bff/store.go'],
    when: (rec) => sent(rec, 'put', 'delete'),
  },
  {
    shows: 'an evaluate: the grammar, the AST and the evaluator',
    kinds: MODEL,
    files: ['spec/calc.ohm', 'engine/ast/build.go', 'engine/eval/eval.go'],
    when: (rec) => sent(rec, 'evaluate', 'parse'),
  },
  {
    shows: 'the page: the parts and what each click does',
    kinds: PAGE,
    files: ['web/apps/app/src/App.tsx', 'web/packages/ui/src/CalculationForm.tsx', 'web/packages/ui/src/CalculationList.tsx'],
  },
  {
    shows: 'the rule that a click moves no control, and its test',
    kinds: ['ui', 'prompt'],
    files: ['web/AGENTS.md', 'web/packages/ui/test/controlsStayPut.browser.tsx'],
  },
  {
    shows: 'the names of the parts on screen',
    kinds: PAGE,
    files: ['docs/glossary.md'],
  },
  {
    shows: 'what is computed where',
    kinds: BUG_KINDS,
    files: ['docs/architecture/engine.md'],
  },
  {
    shows: 'this report: how it was recorded and written',
    kinds: BUG_KINDS,
    files: ['web/apps/app/src/recording.ts', 'web/apps/app/src/bugReport.ts'],
  },
];

function readingSection(rec: Recording, kind: BugKind): string[] {
  const lines = readingList
    .filter((r) => r.kinds.includes(kind) && (!r.when || r.when(rec)))
    .map((r) => `- **${r.shows}**: ${r.files.map((f) => `\`${f}\``).join(', ')}`);
  return [lines.join('\n')];
}

// ---------------------------------------------------------------------
// the file name

/**
 * The report's file name: the local time as `YYYYMMDD-HHMM`, two
 * underscores, and the title as a slug. The server names a file it
 * writes by the same rule (`reportFileName` in
 * services/bff/bugreport.go), so the two sinks agree.
 */
export function reportName(title: string, at: Date): string {
  return `${nameBase(title, at)}.md`;
}

/** The download name of the report's screenshot i, from 0: `-2` and on after the first. */
export function screenshotName(title: string, at: Date, i: number): string {
  return `${nameBase(title, at)}${i === 0 ? '' : `-${i + 1}`}.png`;
}

/** The time as YYYYMMDD-HHMM, two underscores, and the title as a slug. */
function nameBase(title: string, at: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${at.getFullYear()}${p(at.getMonth() + 1)}${p(at.getDate())}-${p(at.getHours())}${p(at.getMinutes())}`;
  return `${stamp}__${slug(title)}`;
}

/** Lower case, each run of anything else one `-`, at most 40, or `bug`: `slug` in services/bff/bugreport.go. */
export function slug(title: string): string {
  const s = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return s === '' ? 'bug' : s;
}

// ---------------------------------------------------------------------
// Markdown

/**
 * An aligned table, as md-table-fmt would leave it: each cell padded to
 * its column's widest, at least three wide as a separator cell must be,
 * the separator filled to match. A pipe in a cell is written as a
 * broken bar, since the house rule forbids an escaped one.
 */
export function table(head: string[], rows: string[][]): string {
  const clean = (s: string) => oneLine(s).replaceAll('|', '¦');
  const all = [head, ...rows].map((r) => r.map(clean));
  const width = head.map((_, c) => Math.max(3, ...all.map((r) => runes(r[c] ?? ''))));
  const line = (r: string[]) => `| ${r.map((cell, c) => pad(cell, width[c]!)).join(' | ')} |`;
  const sep = `|${width.map((w) => '-'.repeat(w + 2)).join('|')}|`;
  return [line(all[0]!), sep, ...all.slice(1).map(line)].join('\n');
}

/** A fenced block whose fence is longer than any run of backticks inside. */
export function fenced(text: string, lang: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((r) => r.length));
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}${lang}\n${text.replace(/\n+$/, '')}\n${fence}`;
}

/** Milliseconds as `mm:ss`. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const runes = (s: string): number => [...s].length;
const pad = (s: string, w: number): string => s + ' '.repeat(w - runes(s));
const oneLine = (s: string): string => s.replace(/\s*\n\s*/g, ' ').trim();
const count = (n: number, noun: string): string => (n === 1 ? `1 ${noun}` : `${n} ${noun}s`);
const seconds = (ms: number): string => `${(ms / 1000).toFixed(1)} s`;
const quoted = (s: string): string => JSON.stringify(s);
const storeCount = (s: Snapshot): string => (s.store ? count(s.store.calculations.length, 'calculation') : 'unknown');

/** The form's record as the store would hold it, for a snapshot: a copy, so a later edit does not change it. */
export function formCopy(c: Calculation): Calculation {
  return JSON.parse(JSON.stringify(c)) as Calculation;
}

/** The summary line of the feedback dialog: `1 change, 3 messages`. */
export function summaryOf(rec: Recording): string {
  const changes = rec.messages.filter((m) => isMutation(m.req) && m.status === 'ok').length;
  return `${count(changes, 'change')}, ${count(rec.messages.length, 'message')}`;
}
