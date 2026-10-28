// Controls stay put: a click that changes the page does not move the
// control it was made on, nor any other control still on screen. The
// user clicks, sees the change, and clicks the same place again, with
// no move of the mouse and no search for where the control went.
// web/AGENTS.md, "Controls stay put", states the rule and its
// exceptions.
//
// The test is a table. One row is a sequence of steps, each on a
// selector. Before each step every control is measured, the step is a
// real click, a fill or a pick at the control, and after it every
// control that is still there is measured again. Any control whose box
// moved by more than half a pixel fails the row, by name.
//
// A layout question, so a browser test: jsdom gives every box a size of
// zero, and every box would stay put.
//
// The page is mounted whole, in the app's own grid (app.css), with its
// half played by signals and a small fake engine: the parts are the
// real components. A control of docs/features/001-calculator/prd.md
// section 4.2 has a row here; a new control, or a new gesture on one,
// gets a row in the same commit.

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-solid';
import { createSignal, type JSX } from 'solid-js';
import { emptyCalculation, type Calculation, type CalculationId } from '@protowx/client';
import {
  Bar,
  BugReportDialog,
  CalculationForm,
  CalculationList,
  PROMPT_TYPES,
  Result,
  type BugKind,
  type FeedbackType,
  type ParseErrorView,
  type SavedView,
} from '../src/index';
import appCss from '../../../apps/app/src/app.css?inline';
import { seeds } from './fixtures';

beforeAll(async () => {
  await page.viewport(1400, 900);
});

afterEach(() => cleanup());

/** What a click may land on, and so what must not move. */
const CONTROLS = 'button, input, select, textarea';

/** A mounted part: the box its controls are looked for in. */
interface Mounted {
  host: HTMLElement;
  /** The boxes to watch. */
  watched(): HTMLElement[];
}

/** One step: a click on a selector, text filled into a field, or an option picked in a select. */
type Step = string | { type: string; text: string } | { select: string; value: string } | { escape: string };

/** One row of the table. */
interface Case {
  name: string;
  mount(): Mounted;
  steps: Step[];
  /**
   * The controls an exception of web/AGENTS.md lets move: they are not
   * measured. A remove and a delete close the gap they leave, so the
   * rows after the one removed move up.
   */
  follows?: string;
}

/** Puts app.css in the page for one mount, and takes it out after. */
function withAppCss(): void {
  const style = document.createElement('style');
  style.textContent = appCss;
  document.head.appendChild(style);
  afterEachOnce(() => style.remove());
}

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const f of cleanups.splice(0)) f();
});
function afterEachOnce(f: () => void): void {
  cleanups.push(f);
}

/**
 * The fake engine's evaluate: an unclosed bracket is a parse error at
 * the text's end, `/ 0` is a division by zero, and anything else is 8.
 */
function evaluate(text: string): { answer?: { value: number; printed: string }; error?: string; parse?: ParseErrorView } {
  if ((text.match(/\(/g) ?? []).length > (text.match(/\)/g) ?? []).length) {
    return { parse: { message: `Line 1, col ${text.length + 1}: match failed`, column: text.length + 1 } };
  }
  if (/\/\s*0\b/.test(text)) return { error: `division by zero: ${text}` };
  return { answer: { value: 8, printed: `(${text})` } };
}

/** The whole page: the bar, the list, the form and the result, in app.css's grid. */
function wholePage(): Mounted {
  withAppCss();
  const host = document.createElement('div');
  host.style.width = '1400px';
  host.style.height = '900px';
  document.body.appendChild(host);
  const [calcs, setCalcs] = createSignal<Calculation[]>(seeds.map((c) => ({ ...c })));
  const [draft, setDraft] = createSignal<Calculation>(emptyCalculation());
  const [recording, setRecording] = createSignal(false);
  const [changes, setChanges] = createSignal(0);
  const [status, setStatus] = createSignal('offline: changes are kept until reload');
  const [parseError, setParseError] = createSignal<ParseErrorView>();
  const [answer, setAnswer] = createSignal<{ value: number; printed: string }>();
  const [error, setError] = createSignal<string>();
  let next = 4;
  const open = (id: CalculationId) => {
    setDraft({ ...calcs().find((c) => c.id === id)! });
    setAnswer(undefined);
    setError(undefined);
    setParseError(undefined);
    setStatus(`opened ${JSON.stringify(draft().name)}`);
  };
  render(
    () => (
      <div class="app">
        <Bar
          recording={recording()}
          changes={changes()}
          mode="offline"
          status={status()}
          canRecord
          onRecord={() => {
            setRecording(!recording());
            setStatus(recording() ? 'recording' : 'a long sentence on the status line, longer than its width, so it is cut at its end');
          }}
        />
        <CalculationList
          calculations={calcs()}
          open={draft().id === '' ? undefined : draft().id}
          onNew={() => {
            setDraft(emptyCalculation());
            setStatus('a new calculation');
          }}
          onOpen={open}
        />
        <main class="form-column">
          <CalculationForm
            calculation={draft()}
            parseError={parseError()}
            onChange={(c) => {
              if (c.text !== draft().text) setParseError(undefined);
              setDraft(c);
            }}
            onEvaluate={() => {
              const r = evaluate(draft().text);
              setAnswer(r.answer);
              setError(r.error);
              setParseError(r.parse);
              setStatus('evaluated');
            }}
            onSave={() => {
              const c = draft().id === '' ? { ...draft(), id: String(next++) } : draft();
              setCalcs(calcs().some((x) => x.id === c.id) ? calcs().map((x) => (x.id === c.id ? c : x)) : [...calcs(), c]);
              setDraft(c);
              if (recording()) setChanges(changes() + 1);
              setStatus(`saved ${JSON.stringify(c.name)}`);
            }}
            onDelete={() => {
              setCalcs(calcs().filter((x) => x.id !== draft().id));
              setDraft(emptyCalculation());
              if (recording()) setChanges(changes() + 1);
              setStatus('deleted');
            }}
          />
        </main>
        <Result answer={answer()} error={error()} base={draft().base} />
      </div>
    ),
    { container: host },
  );
  // A row is watched while it is on screen; the bindings' rows too.
  return {
    host,
    watched: () => [...host.querySelectorAll<HTMLElement>(`:is(${CONTROLS}), [data-term=parse-error], [data-term=value], [data-term=printed-expression]`)],
  };
}

/** The feedback dialog, open, with two screenshots, and the app's half played by signals. Every control is watched. */
function feedbackDialog(): Mounted {
  const thumb = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  render((): JSX.Element => {
    const [type, setType] = createSignal<FeedbackType>('bug');
    const [kind, setKind] = createSignal<BugKind>('general');
    const [shots, setShots] = createSignal([
      { url: thumb, caption: 'the row' },
      { url: thumb, caption: '' },
    ]);
    const [full, setFull] = createSignal(false);
    const [saved, setSaved] = createSignal<SavedView>();
    let touched = false;
    return (
      <BugReportDialog
        open
        type={type()}
        onType={(t) => {
          setType(t);
          if (!touched) setKind(PROMPT_TYPES.has(t) ? 'prompt' : 'general');
        }}
        kind={kind()}
        onKind={(k) => {
          touched = true;
          setKind(k);
        }}
        title="a save"
        message=""
        full={full()}
        fullAllowed={kind() !== 'ui' && kind() !== 'prompt'}
        shots={shots()}
        summary="1 change, 3 messages"
        saving={false}
        saved={saved()}
        onTitle={() => {}}
        onMessage={() => {}}
        onFull={setFull}
        onCaption={() => {}}
        onRemove={(i) => setShots((s) => s.filter((_, j) => j !== i))}
        onSubmit={() =>
          setSaved({
            where: 'server',
            file: '.bugreports/20261028-1810__a-save.md',
            prompt: 'Fix the bug in .bugreports/20261028-1810__a-save.md.',
            shots: 1,
          })
        }
        onKeep={() => {}}
        onDiscard={() => {}}
        onClose={() => {}}
      />
    );
  });
  const host = document.querySelector<HTMLElement>('[data-term=feedback-dialog]')!;
  return {
    host,
    watched: () => [...host.querySelectorAll<HTMLElement>(`:is(${CONTROLS}), .shot-list`)],
  };
}

const row = (n: number) => `[data-term=calculation-list] li:nth-child(${n + 1}) [data-term=row]`;
const notes = '[data-term=notes] input[type=checkbox]';
const remove = (n: number) => `[data-term=bindings] tbody tr:nth-child(${n + 1}) [data-term=remove]`;

const cases: Case[] = [
  { name: 'record, then stop, then record: one button of one width', mount: wholePage, steps: ['[data-term=record]', '[data-term=record]', '[data-term=record]'] },
  { name: 'new, a row, another row, new', mount: wholePage, steps: ['[data-term=new]', row(0), row(2), '[data-term=new]'] },
  { name: 'a row clicked twice', mount: wholePage, steps: [row(1), row(1)] },
  {
    name: 'the name and the text typed, Enter evaluates',
    mount: wholePage,
    steps: [
      { type: '[data-term=name]', text: 'rent' },
      { type: '[data-term=text]', text: 'a * 12' },
    ],
  },
  { name: 'add three bindings, then remove the last', mount: wholePage, steps: ['[data-term=add]', '[data-term=add]', '[data-term=add]', remove(2)] },
  {
    name: 'remove the first binding: the rows after it close the gap',
    mount: wholePage,
    steps: [row(0), remove(0)],
    follows: '[data-term=bindings] tbody :is(input, button)',
  },
  {
    name: 'the base: each value in turn',
    mount: wholePage,
    steps: [row(0), '[data-term=evaluate]', { select: '[data-term=base]', value: 'hex' }, { select: '[data-term=base]', value: 'binary' }, { select: '[data-term=base]', value: 'decimal' }],
  },
  { name: 'the notes: off and on, twice', mount: wholePage, steps: [row(1), notes, notes, notes, notes] },
  { name: 'the star: on and off', mount: wholePage, steps: ['[data-term=star]', '[data-term=star]'] },
  {
    name: 'evaluate: a value, an evaluation error, then a parse error',
    mount: wholePage,
    steps: [row(0), '[data-term=evaluate]', row(2), '[data-term=evaluate]', { type: '[data-term=text]', text: '(x + 3' }, '[data-term=evaluate]', '[data-term=evaluate]'],
  },
  {
    name: 'save a new calculation: its row is added at the end',
    mount: wholePage,
    steps: ['[data-term=new]', { type: '[data-term=name]', text: 'rent' }, '[data-term=save]', '[data-term=save]'],
  },
  { name: 'delete the last calculation, while a recording counts', mount: wholePage, steps: ['[data-term=record]', row(2), '[data-term=delete]', '[data-term=new]'] },
  {
    name: 'delete the first calculation: the rows after it close the gap',
    mount: wholePage,
    steps: [row(0), '[data-term=delete]'],
    follows: '[data-term=row]',
  },
  {
    name: 'the feedback dialog: the type, the kind, the option and a screenshot removed',
    mount: feedbackDialog,
    steps: [
      { select: '[data-term=type]', value: 'question' },
      { select: '[data-term=type]', value: 'bug' },
      { select: '[data-term=kind]', value: 'ui' },
      { select: '[data-term=kind]', value: 'engine' },
      '.feedback-option input',
      '[aria-label="remove screenshot 2"]',
      '[aria-label="remove screenshot 1"]',
    ],
  },
  {
    name: 'the feedback dialog: Escape, then submit',
    mount: feedbackDialog,
    steps: [{ escape: '[data-term=submit]' }, '[data-term=submit]'],
  },
];

// ---- the check --------------------------------------------------------

/** A control's name in a failure: its text or its label, and its term. */
function nameOf(el: HTMLElement): string {
  const text = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ');
  const term = el.dataset.term ? `[data-term=${el.dataset.term}]` : '';
  return `<${el.tagName.toLowerCase()}${term}> "${text.slice(0, 30)}"`;
}

/** Waits for the page to settle: Solid's update, then a frame of layout. */
async function settled(): Promise<void> {
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

function moved(a: DOMRect, b: DOMRect): boolean {
  return Math.abs(a.x - b.x) > 0.5 || Math.abs(a.y - b.y) > 0.5 || Math.abs(a.width - b.width) > 0.5 || Math.abs(a.height - b.height) > 0.5;
}

const fmt = (r: DOMRect) => `${r.x.toFixed(1)},${r.y.toFixed(1)} ${r.width.toFixed(1)}×${r.height.toFixed(1)}`;

describe('controls stay put', () => {
  it.each(cases)('$name', async ({ mount, steps, follows }) => {
    const { host, watched } = mount();
    await settled();
    for (const [n, s] of steps.entries()) {
      const selector = typeof s === 'string' ? s : 'select' in s ? s.select : 'escape' in s ? s.escape : s.type;
      const target = host.querySelector<HTMLElement>(selector);
      expect(target, `step ${n}: nothing matches ${selector}`).not.toBeNull();
      const before = new Map<HTMLElement, DOMRect>();
      for (const el of new Set([...watched(), target!])) {
        if (follows && el.matches(follows)) continue;
        before.set(el, el.getBoundingClientRect());
      }
      if (typeof s === 'string') await userEvent.click(target!);
      else if ('select' in s) await userEvent.selectOptions(target!, s.value);
      else if ('escape' in s) await userEvent.keyboard('{Escape}');
      else {
        await userEvent.fill(target!, s.text);
        await userEvent.keyboard('{Enter}');
      }
      await settled();
      const drift: string[] = [];
      for (const [el, was] of before) {
        // A control the step took away, or hid, is not measured.
        if (!el.isConnected || el.getClientRects().length === 0) continue;
        const box = el.getBoundingClientRect();
        if (moved(was, box)) drift.push(`${nameOf(el)} ${fmt(was)} -> ${fmt(box)}`);
      }
      expect(drift, `step ${n}, ${typeof s === 'string' ? 'click' : Object.keys(s)[0]} on ${selector} moved:\n  ${drift.join('\n  ')}`).toEqual([]);
    }
  });
});
