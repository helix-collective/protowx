// The result in a browser: the value in the record's base, the printed
// expression under it, and an evaluation error in the value's place.

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from 'vitest-browser-solid';
import { createSignal } from 'solid-js';
import type { Base } from '@protowx/client';
import { NO_RESULT, Result } from '../src/index';
import { host } from './fixtures';

afterEach(() => cleanup());

describe('Result', () => {
  it('says where the value goes before an evaluate', () => {
    const el = host('360px');
    render(() => <Result base="decimal" />, { container: el });
    expect(el.querySelector('.no-result')!.textContent).toBe(NO_RESULT);
  });

  it('draws the value in the base, again at once when the base changes', () => {
    const el = host('360px');
    const [base, setBase] = createSignal<Base>('decimal');
    render(() => <Result base={base()} answer={{ value: 14, printed: '(2 + (3 * 4))' }} />, { container: el });
    const value = () => el.querySelector('[data-term=value]')!.textContent;
    expect(value()).toBe('14');
    expect(el.querySelector('[data-term=printed-expression]')!.textContent).toBe('(2 + (3 * 4))');
    setBase('hex');
    expect(value()).toBe('0xe');
    setBase('binary');
    expect(value()).toBe('0b1110');
  });

  it('puts an evaluation error in the value\'s place, and keeps the printed expression\'s place', () => {
    const el = host('360px');
    const [error, setError] = createSignal<string>();
    render(() => <Result base="hex" answer={{ value: 8, printed: '((x + 3) * y)' }} error={error()} />, { container: el });
    const printed = el.querySelector<HTMLElement>('[data-term=printed-expression]')!;
    const y = printed.getBoundingClientRect().y;
    setError('division by zero: 10 / 0');
    expect(el.querySelector('[data-term=evaluation-error]')!.textContent).toBe('division by zero: 10 / 0');
    expect(el.querySelector('[data-term=value]')).toBeNull();
    expect(printed.textContent).toBe('');
    expect(printed.getBoundingClientRect().y).toBe(y);
  });
});
