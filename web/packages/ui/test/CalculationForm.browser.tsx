// The form in a browser: each field of model.Calculation changes the
// record; evaluate, save and delete reach the app; the parse error sits
// under the text, at its column.

import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-solid';
import { createSignal } from 'solid-js';
import { emptyCalculation, type Calculation } from '@protowx/client';
import { CalculationForm, type ParseErrorView } from '../src/index';
import { host, seeds } from './fixtures';

afterEach(() => cleanup());

function mount(start: Calculation, parseError?: () => ParseErrorView | undefined) {
  const el = host('600px');
  const [calc, setCalc] = createSignal(start);
  const calls: string[] = [];
  render(
    () => (
      <CalculationForm
        calculation={calc()}
        onChange={setCalc}
        parseError={parseError?.()}
        onEvaluate={() => calls.push('evaluate')}
        onSave={() => calls.push('save')}
        onDelete={() => calls.push('delete')}
      />
    ),
    { container: el },
  );
  const q = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  return { el, calc, calls, q };
}

describe('CalculationForm', () => {
  it('edits the name, the text, the base and the star', async () => {
    const { calc, q } = mount(emptyCalculation());
    await userEvent.fill(q('[data-term=name]'), 'rent');
    await userEvent.fill(q('[data-term=text]'), 'a * 12');
    await userEvent.selectOptions(q('[data-term=base]'), 'binary');
    await userEvent.click(q('[data-term=star]'));
    expect(calc()).toMatchObject({ name: 'rent', text: 'a * 12', base: 'binary', starred: true });
  });

  it('shows and hides the notes, keeps their words, and keeps the place of the text area', async () => {
    const { calc, q } = mount(seeds[1]!);
    const area = q<HTMLTextAreaElement>('[data-term=notes] textarea');
    const box = q<HTMLInputElement>('[data-term=notes] input[type=checkbox]');
    expect(box.checked).toBe(true);
    expect(area.value).toBe('Times binds tighter than plus: the value is 14, not 20.');
    const place = area.getBoundingClientRect();
    await userEvent.click(box);
    expect(calc().notes.kind).toBe('nothing');
    expect(getComputedStyle(area).visibility).toBe('hidden');
    expect(area.getBoundingClientRect()).toEqual(place);
    await userEvent.click(box);
    expect(calc().notes).toEqual({ kind: 'just', value: 'Times binds tighter than plus: the value is 14, not 20.' });
  });

  it('evaluates on the button and on Enter, saves, and deletes a stored one', async () => {
    const { calls, q } = mount(seeds[0]!);
    await userEvent.click(q('[data-term=evaluate]'));
    await userEvent.click(q('[data-term=text]'));
    await userEvent.keyboard('{Enter}');
    await userEvent.click(q('[data-term=save]'));
    await userEvent.click(q('[data-term=delete]'));
    expect(calls).toEqual(['evaluate', 'evaluate', 'save', 'delete']);
  });

  it('disables delete for a calculation the store does not hold', () => {
    const { q } = mount(emptyCalculation());
    expect(q<HTMLButtonElement>('[data-term=delete]').disabled).toBe(true);
  });

  it('puts the parse error under the text, its caret under the column', () => {
    const [err, setErr] = createSignal<ParseErrorView>();
    const { q } = mount({ ...seeds[0]!, text: '(x + 3' }, err);
    const line = q('[data-term=parse-error]');
    const h = line.getBoundingClientRect().height;
    expect(line.textContent).toBe('');
    setErr({ message: 'Line 1, col 7: match failed', column: 7 });
    expect(line.textContent).toBe('^ Line 1, col 7: match failed');
    expect(line.getBoundingClientRect().height).toBe(h);
    // The caret's left edge is the left edge of the seventh character.
    const text = q<HTMLInputElement>('[data-term=text]');
    const ch = charWidth(text);
    const caret = q('.parse-error-at');
    const caretLeft = caret.getBoundingClientRect().left + parseFloat(getComputedStyle(caret).paddingLeft);
    const textLeft = text.getBoundingClientRect().left + parseFloat(getComputedStyle(text).borderLeftWidth) + parseFloat(getComputedStyle(text).paddingLeft);
    expect(Math.abs(caretLeft - (textLeft + 6 * ch))).toBeLessThan(1);
  });
});

/** The width of one character in a field's face. */
function charWidth(el: HTMLElement): number {
  const c = document.createElement('canvas').getContext('2d')!;
  c.font = getComputedStyle(el).font;
  return c.measureText('0').width;
}
