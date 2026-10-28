// The feedback dialog in a browser: it opens modal with the title in
// focus, Escape is keep recording, submit and the saved view, and the
// screenshot list's ×.

import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-solid';
import { createSignal } from 'solid-js';
import { BugReportDialog, type BugKind, type FeedbackType, type SavedView } from '../src/index';

afterEach(() => cleanup());

/** A one-pixel PNG, as a thumbnail's URL. */
const thumb = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function mount() {
  const calls: string[] = [];
  const [saved, setSaved] = createSignal<SavedView>();
  const [shots, setShots] = createSignal([
    { url: thumb, caption: 'the row' },
    { url: thumb, caption: '' },
  ]);
  const [title, setTitle] = createSignal('');
  const [type, setType] = createSignal<FeedbackType>('bug');
  const [kind, setKind] = createSignal<BugKind>('general');
  render(() => (
    <BugReportDialog
      open
      type={type()}
      onType={setType}
      kind={kind()}
      onKind={setKind}
      title={title()}
      message=""
      full={false}
      fullAllowed
      shots={shots()}
      summary="1 change, 3 messages"
      saving={false}
      saved={saved()}
      onTitle={setTitle}
      onMessage={() => {}}
      onFull={() => {}}
      onCaption={() => {}}
      onRemove={(i) => setShots((s) => s.filter((_, j) => j !== i))}
      onSubmit={() => calls.push('submit')}
      onKeep={() => calls.push('keep')}
      onDiscard={() => calls.push('discard')}
      onClose={() => calls.push('close')}
    />
  ));
  const dialog = document.querySelector<HTMLDialogElement>('[data-term=feedback-dialog]')!;
  return { calls, dialog, setSaved, shots, title, type, kind };
}

describe('BugReportDialog', () => {
  it('opens modal, with the title in focus', () => {
    const { dialog } = mount();
    expect(dialog.open).toBe(true);
    expect(dialog.matches(':modal')).toBe(true);
    expect(document.activeElement).toBe(dialog.querySelector('[data-term=title]'));
  });

  it('takes the title, the type and the kind', async () => {
    const { dialog, title, type, kind } = mount();
    await userEvent.fill(dialog.querySelector<HTMLInputElement>('[data-term=title]')!, 'a save');
    await userEvent.selectOptions(dialog.querySelector<HTMLSelectElement>('[data-term=type]')!, 'question');
    await userEvent.selectOptions(dialog.querySelector<HTMLSelectElement>('[data-term=kind]')!, 'engine');
    expect([title(), type(), kind()]).toEqual(['a save', 'question', 'engine']);
  });

  it('is keep recording on Escape, and submits on submit', async () => {
    const { dialog, calls } = mount();
    await userEvent.keyboard('{Escape}');
    expect(dialog.open).toBe(true);
    await userEvent.click(dialog.querySelector<HTMLElement>('[data-term=submit]')!);
    await userEvent.click(dialog.querySelector<HTMLElement>('[data-term=discard]')!);
    expect(calls).toEqual(['keep', 'submit', 'discard']);
  });

  it('takes a screenshot out by its ×', async () => {
    const { dialog, shots } = mount();
    await userEvent.click(dialog.querySelector<HTMLElement>('[aria-label="remove screenshot 1"]')!);
    expect(shots().map((s) => s.caption)).toEqual(['']);
  });

  it('says where the file went, and copies its name and its prompt', async () => {
    const { dialog, setSaved, calls } = mount();
    setSaved({ where: 'server', file: '.bugreports/20261028-1810__a-save.md', prompt: 'Fix the bug in .bugreports/20261028-1810__a-save.md.', shots: 2 });
    const saved = dialog.querySelector<HTMLElement>('[data-term=saved]')!;
    expect(saved.querySelector('p')!.textContent).toBe('Saved to .bugreports/20261028-1810__a-save.md with 2 screenshots');
    expect(dialog.querySelector('[data-term=submit]')).toBeNull();
    expect(dialog.querySelector<HTMLTextAreaElement>('[aria-label="the prompt"]')!.value).toBe('Fix the bug in .bugreports/20261028-1810__a-save.md.');
    await userEvent.click(dialog.querySelector<HTMLElement>('[data-term=close]')!);
    expect(calls).toEqual(['close']);
  });
});
