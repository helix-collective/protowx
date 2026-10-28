// The status line in a browser: one line, its sentence in the title.

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from 'vitest-browser-solid';
import { createSignal } from 'solid-js';
import { StatusLine } from '../src/index';
import { host } from './fixtures';

afterEach(() => cleanup());

describe('StatusLine', () => {
  it('says the sentence, and keeps one height for a long one', () => {
    const el = host('400px');
    el.style.display = 'flex';
    const [text, setText] = createSignal('offline: changes are kept until reload');
    render(() => <StatusLine text={text()} />, { container: el });
    const line = el.querySelector<HTMLElement>('[data-term=status-line]')!;
    expect(line.textContent).toBe('offline: changes are kept until reload');
    const h = line.getBoundingClientRect().height;
    setText('a much longer sentence that the line cuts with an ellipsis, '.repeat(4));
    expect(line.getBoundingClientRect().height).toBe(h);
    expect(line.title).toBe(text());
  });
});
