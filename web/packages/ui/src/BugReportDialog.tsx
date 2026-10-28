// The feedback dialog: what **stop** opens. Its heading is `Feedback`:
// every word the user reads says feedback, not bug. The type, the
// kind, a title, a message, one option, the screenshot list, and three
// ways out: submit, keep recording, discard. After a save: where the
// file went, the file name with a button that copies it, and a button
// that copies a one-line prompt naming it. docs/glossary.md, "The
// feedback dialog".
//
// It is a native `<dialog>` opened with `showModal`, so the browser
// gives it the top layer, the backdrop and the focus trap. Nothing on
// the page is reachable while it is up, which keeps the recording
// still. It is controlled: the app holds every field and the result,
// and this file knows nothing of the recording, the report or the
// engine.
//
// Escape is keep recording, and a press on the backdrop does nothing:
// either way out of a dialog the user did not mean to leave would lose
// what they typed.
//
// The screenshot list shows what `Alt+Shift+S` took while the
// recording ran: a row per screenshot, with its thumbnail, its caption
// and a `×` that takes it out. The list is one height and scrolls, so
// a row added or removed moves no action under it.

import { createEffect, createSignal, For, Index, Show, type JSX } from 'solid-js';
import { Portal } from 'solid-js/web';
import { BUG_KIND_LABELS, BUG_KINDS, FEEDBACK_TYPE_LABELS, FEEDBACK_TYPES, type BugKind, type FeedbackType } from './feedback';

/** Where the file went, as the dialog says it. */
export interface SavedView {
  /** `server`: bff wrote it under --bugs. `download`: the browser saved it. */
  where: 'server' | 'download';
  /** The path on the server, or the downloaded file's name. */
  file: string;
  /** The one-line prompt that names the file. */
  prompt: string;
  /** How many screenshots went with it. */
  shots: number;
  /** Why the server did not take it, for a download. */
  why?: string;
}

export interface BugReportDialogProps {
  open: boolean;
  type: FeedbackType;
  onType(type: FeedbackType): void;
  kind: BugKind;
  onKind(kind: BugKind): void;
  title: string;
  message: string;
  /** Every request's JSON in the file, not only the ones that changed the store. */
  full: boolean;
  /** Whether the kind has the engine messages section, which `full` is about. */
  fullAllowed: boolean;
  /** Each screenshot taken, in order: an object URL for its thumbnail, and its caption. */
  shots: readonly { url: string; caption: string }[];
  /** What was recorded, in one line: the changes and the messages. */
  summary: string;
  saving: boolean;
  saved?: SavedView;
  /** Why neither the server nor a download took the file. */
  failure?: string;
  onTitle(title: string): void;
  onMessage(message: string): void;
  onFull(full: boolean): void;
  onCaption(i: number, caption: string): void;
  /** The `×` of screenshot i: take it out of the list and the file. */
  onRemove(i: number): void;
  onSubmit(): void;
  onKeep(): void;
  onDiscard(): void;
  /** After a save: the dialog is done. */
  onClose(): void;
}

export function BugReportDialog(props: BugReportDialogProps): JSX.Element {
  let dialog!: HTMLDialogElement;
  let titleInput!: HTMLInputElement;
  const [copied, setCopied] = createSignal<string>();

  createEffect(() => {
    if (props.open && !dialog.open) {
      setCopied(undefined);
      dialog.showModal();
      titleInput.focus();
    } else if (!props.open && dialog.open) {
      dialog.close();
    }
  });

  const copy = async (line: string, what: string) => {
    try {
      await navigator.clipboard.writeText(line);
      setCopied(`copied the ${what}`);
    } catch {
      setCopied(`the clipboard refused; copy the ${what} by hand`);
    }
  };

  return (
    <Portal>
      <dialog
        ref={dialog}
        class="feedback-dialog"
        data-term="feedback-dialog"
        aria-label="feedback"
        onCancel={(ev) => {
          // Escape. The browser would close the dialog under the app's
          // feet; the app decides instead.
          ev.preventDefault();
          if (props.saved) props.onClose();
          else props.onKeep();
        }}
      >
        <form
          class="feedback-body"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!props.saved && !props.saving) props.onSubmit();
          }}
        >
          <header class="feedback-head">
            <h2>Feedback</h2>
            <span class="muted" data-term="feedback-summary">
              {props.summary}
            </span>
          </header>
          <label class="feedback-field">
            <span>type</span>
            <select
              class="feedback-select"
              data-term="type"
              value={props.type}
              disabled={!!props.saved}
              title="what the feedback is; it sets the file's first paragraph and the prompt the dialog copies"
              onChange={(ev) => props.onType(ev.currentTarget.value as FeedbackType)}
            >
              <For each={FEEDBACK_TYPES}>{(t) => <option value={t}>{FEEDBACK_TYPE_LABELS[t]}</option>}</For>
            </select>
          </label>
          <label class="feedback-field">
            <span>kind</span>
            <select
              class="feedback-select"
              data-term="kind"
              value={props.kind}
              disabled={!!props.saved}
              title="what the file holds; the report holds the sections that bear on it"
              onChange={(ev) => props.onKind(ev.currentTarget.value as BugKind)}
            >
              <For each={BUG_KINDS}>{(k) => <option value={k}>{BUG_KIND_LABELS[k]}</option>}</For>
            </select>
          </label>
          <label class="feedback-field">
            <span>title</span>
            <input
              ref={titleInput}
              type="text"
              data-term="title"
              value={props.title}
              placeholder="the feedback, in a few words"
              disabled={!!props.saved}
              onInput={(ev) => props.onTitle(ev.currentTarget.value)}
            />
          </label>
          <label class="feedback-field">
            <span>message</span>
            <textarea
              data-term="message"
              value={props.message}
              placeholder="what you did, and what you expected or want"
              disabled={!!props.saved}
              onInput={(ev) => props.onMessage(ev.currentTarget.value)}
            />
          </label>
          <label class="feedback-option">
            <input
              type="checkbox"
              checked={props.full}
              disabled={!!props.saved || !props.fullAllowed}
              onChange={(ev) => props.onFull(ev.currentTarget.checked)}
            />
            every request in full, not only the ones that changed the store
          </label>
          <div class="feedback-shots">
            <span>screenshots</span>
            {/* Index, not For: a key press in a caption gives a new
                object for the row, and For would build the row again,
                field and focus with it. */}
            <ol class="shot-list" data-term="screenshot-list">
              <Index each={props.shots} fallback={<li class="muted">none; Alt+Shift+S takes one while a recording runs</li>}>
                {(shot, i) => (
                  <li class="shot-row">
                    <img src={shot().url} alt={`screenshot ${i + 1}`} />
                    <input
                      type="text"
                      class="shot-caption"
                      value={shot().caption}
                      placeholder="what to look at in this screenshot"
                      aria-label={`caption of screenshot ${i + 1}`}
                      disabled={!!props.saved}
                      onInput={(ev) => props.onCaption(i, ev.currentTarget.value)}
                    />
                    <button
                      type="button"
                      class="shot-remove"
                      title="remove this screenshot"
                      aria-label={`remove screenshot ${i + 1}`}
                      disabled={!!props.saved}
                      onClick={() => props.onRemove(i)}
                    >
                      ×
                    </button>
                  </li>
                )}
              </Index>
            </ol>
          </div>
          <Show when={props.failure}>{(f) => <p class="feedback-failure">Not saved: {f()}</p>}</Show>
          <Show
            when={props.saved}
            fallback={
              <footer class="feedback-actions">
                <button type="submit" class="primary" data-term="submit" disabled={props.saving}>
                  {props.saving ? 'saving…' : 'submit'}
                </button>
                <button type="button" data-term="keep-recording" disabled={props.saving} onClick={() => props.onKeep()}>
                  keep recording
                </button>
                <button type="button" data-term="discard" disabled={props.saving} onClick={() => props.onDiscard()}>
                  discard
                </button>
              </footer>
            }
          >
            {(s) => (
              <section class="feedback-saved" data-term="saved" role="status">
                <p>
                  {s().where === 'server' ? 'Saved to ' : 'Downloaded as '}
                  <code>{s().file}</code>
                  <Show when={s().shots > 0}>
                    <span class="muted">
                      {' '}
                      with {s().shots} {s().shots === 1 ? 'screenshot' : 'screenshots'}
                    </span>
                  </Show>
                  <Show when={s().why}>
                    <span class="muted"> ({s().why})</span>
                  </Show>
                </p>
                <div class="feedback-copy">
                  <textarea readonly rows={1} wrap="off" value={s().file} aria-label="the file name" onFocus={(ev) => ev.currentTarget.select()} />
                  <button type="button" data-term="copy-filename" onClick={() => void copy(s().file, 'file name')}>
                    copy filename
                  </button>
                  <textarea readonly rows={1} wrap="off" value={s().prompt} aria-label="the prompt" onFocus={(ev) => ev.currentTarget.select()} />
                  <button type="button" data-term="copy-as-prompt" onClick={() => void copy(s().prompt, 'prompt')}>
                    copy as prompt
                  </button>
                </div>
                <p class="muted feedback-copied">{copied() ?? ''}</p>
                <footer class="feedback-actions">
                  <button type="button" class="primary" data-term="close" onClick={() => props.onClose()}>
                    close
                  </button>
                </footer>
              </section>
            )}
          </Show>
        </form>
      </dialog>
    </Portal>
  );
}
