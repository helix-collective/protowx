// The bar in a browser: record and stop are one button of one width,
// and the status line is one line of a fixed width.

import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-solid';
import { createSignal } from 'solid-js';
import { Bar, stopWords } from '../src/index';
import { host } from './fixtures';

afterEach(() => cleanup());

describe('Bar', () => {
  it('turns record into stop with the count, in the same box', async () => {
    const el = host('1200px');
    const [on, setOn] = createSignal(false);
    render(() => <Bar recording={on()} changes={2} mode="offline" status="ready" canRecord onRecord={() => setOn(!on())} />, { container: el });
    const button = el.querySelector<HTMLElement>('[data-term=record]')!;
    const box = button.getBoundingClientRect();
    expect(button.textContent).toBe('record');
    await userEvent.click(button);
    expect(button.textContent).toBe('stop · 2 changes');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getBoundingClientRect()).toEqual(box);
    expect(el.querySelector('[data-term=mode]')!.textContent).toBe('offline');
  });

  it('counts one change in the singular', () => {
    expect(stopWords(1)).toBe('stop · 1 change');
    expect(stopWords(0)).toBe('stop · 0 changes');
  });

  it('cuts a long status line, keeps it on one line, and holds it whole in the title', () => {
    const el = host('1200px');
    const long = 'a status line that goes on and on, '.repeat(10);
    render(() => <Bar recording={false} changes={0} mode="connected" status={long} canRecord onRecord={() => {}} />, { container: el });
    const line = el.querySelector<HTMLElement>('[data-term=status-line]')!;
    expect(line.title).toBe(long);
    expect(line.scrollWidth).toBeGreaterThan(line.clientWidth);
    expect(el.querySelector<HTMLElement>('[data-term=bar]')!.getBoundingClientRect().height).toBe(44);
  });
});
