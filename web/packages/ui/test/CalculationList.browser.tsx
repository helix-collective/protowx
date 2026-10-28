// The calculation list in a browser: a row per calculation, new above
// them, the open row marked in colour and not in size, the store error
// at the foot.

import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-solid';
import { createSignal } from 'solid-js';
import { CalculationList, NO_NAME } from '../src/index';
import { host, seeds } from './fixtures';

afterEach(() => cleanup());

describe('CalculationList', () => {
  it('draws a row per calculation, its star and its name, and marks the open row by colour', async () => {
    const el = host('260px', '400px');
    const [open, setOpen] = createSignal<string>();
    const opened: string[] = [];
    let news = 0;
    const calcs = [...seeds, { ...seeds[0]!, id: '4', name: '', starred: true }];
    render(
      () => (
        <CalculationList
          calculations={calcs}
          open={open()}
          onNew={() => news++}
          onOpen={(id) => {
            opened.push(id);
            setOpen(id);
          }}
        />
      ),
      { container: el },
    );
    const rows = () => [...el.querySelectorAll<HTMLElement>('[data-term=row]')];
    expect(rows().map((r) => r.textContent)).toEqual(['the example', 'precedence', 'division by zero', `★${NO_NAME}`]);
    const before = rows()[1]!.getBoundingClientRect();
    const fill = getComputedStyle(rows()[1]!).backgroundColor;
    await userEvent.click(rows()[1]!);
    expect(opened).toEqual(['2']);
    expect(rows()[1]!.getAttribute('aria-current')).toBe('true');
    expect(rows().filter((r) => r.getAttribute('aria-current') === 'true')).toHaveLength(1);
    const after = rows()[1]!.getBoundingClientRect();
    expect([after.x, after.y, after.width, after.height]).toEqual([before.x, before.y, before.width, before.height]);
    expect(getComputedStyle(rows()[1]!).backgroundColor).not.toBe(fill);
    await userEvent.click(el.querySelector<HTMLElement>('[data-term=new]')!);
    expect(news).toBe(1);
  });

  it('shows the store error at the foot, and keeps its height without one', () => {
    const el = host('260px', '400px');
    const [error, setError] = createSignal<string>();
    render(() => <CalculationList calculations={seeds} error={error()} onNew={() => {}} onOpen={() => {}} />, { container: el });
    const foot = el.querySelector<HTMLElement>('[data-term=store-error]')!;
    const h = foot.getBoundingClientRect().height;
    expect(h).toBeGreaterThan(0);
    setError('no such calculation: 9');
    expect(foot.textContent).toBe('no such calculation: 9');
    expect(foot.getBoundingClientRect().height).toBe(h);
  });
});
