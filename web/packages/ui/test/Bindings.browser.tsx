// The bindings in a browser: a name and a value per row, a remove per
// row, the add row below, and a value that takes integers only.

import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-solid';
import { createSignal } from 'solid-js';
import type { Binding } from '@protowx/client';
import { Bindings, integerOf } from '../src/index';
import { host } from './fixtures';

afterEach(() => cleanup());

function mount(start: Binding[]) {
  const el = host('500px');
  const [bindings, setBindings] = createSignal<Binding[]>(start);
  render(() => <Bindings bindings={bindings()} onChange={setBindings} />, { container: el });
  return { el, bindings };
}

describe('Bindings', () => {
  it('adds a binding, and edits its name and its value', async () => {
    const { el, bindings } = mount([{ name: 'x', value: 5 }]);
    await userEvent.click(el.querySelector<HTMLElement>('[data-term=add]')!);
    expect(bindings()).toEqual([
      { name: 'x', value: 5 },
      { name: '', value: 0 },
    ]);
    const names = el.querySelectorAll<HTMLInputElement>('.binding-name');
    const values = el.querySelectorAll<HTMLInputElement>('.binding-value');
    await userEvent.fill(names[1]!, 'y');
    await userEvent.fill(values[1]!, '-12');
    expect(bindings()[1]).toEqual({ name: 'y', value: -12 });
  });

  it('keeps the last value while the text is not an integer', async () => {
    const { el, bindings } = mount([{ name: 'x', value: 5 }]);
    const value = el.querySelector<HTMLInputElement>('.binding-value')!;
    await userEvent.fill(value, '-');
    expect(bindings()[0]!.value).toBe(5);
    expect(value.value).toBe('-');
  });

  it('removes the binding whose × is clicked', async () => {
    const { el, bindings } = mount([
      { name: 'x', value: 5 },
      { name: 'y', value: 1 },
    ]);
    await userEvent.click(el.querySelectorAll<HTMLElement>('[data-term=remove]')[0]!);
    expect(bindings()).toEqual([{ name: 'y', value: 1 }]);
  });

  it('keeps add in its place as rows come and go', async () => {
    const { el } = mount([]);
    const add = el.querySelector<HTMLElement>('[data-term=add]')!;
    const y = add.getBoundingClientRect().y;
    for (let i = 0; i < 7; i++) await userEvent.click(add);
    expect(add.getBoundingClientRect().y).toBe(y);
  });

  it.each([
    ['42', 42],
    ['-7', -7],
    [' 3 ', 3],
    ['-', undefined],
    ['1.5', undefined],
    ['9007199254740993', undefined],
  ])('reads %j as %s', (text, n) => {
    expect(integerOf(text)).toBe(n);
  });
});
