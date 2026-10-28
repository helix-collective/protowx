// The page: the bar on top, and three parts side by side under it, the
// calculation list, the form and the result. docs/glossary.md names
// each part; docs/features/001-calculator/prd.md section 4 is the
// design.
//
// The page picks its mode at load, from the URL and GET /api/config
// (engineConfig.ts), and makes its engine with createEngine. Nothing
// below that knows which mode it is in. Every message to the engine
// goes through one RequestLog, which a feedback recording taps.
//
// The status line is set in one place, `setStatus`, so a recording
// hears every sentence, a repeat of the same one included.

import { createSignal, onCleanup, onMount, type JSX } from 'solid-js';
import {
  createEngine,
  emptyCalculation,
  EngineError,
  RequestLog,
  type Calculation,
  type CalculationId,
  type Engine,
  type EngineConfig,
} from '@protowx/client';
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
} from '@protowx/ui';
import { formCopy, renderReport, SECTIONS, summaryOf } from './bugReport';
import { describeEngine, OFFLINE_LINE, readEngineConfig } from './engineConfig';
import { startRecording, type LiveRecording } from './recorder';
import type { Recording, Snapshot } from './recording';
import { saveReport, savedView } from './reportSink';
import { dialogOpen, isScreenshotKey, takeScreenshot } from './screenshot';
import { NO_SERVER, readServerConfig, type ServerConfig } from './serverConfig';

/** One screenshot taken while a recording ran: the PNG, a URL for its thumbnail, when, and its caption. */
interface Shot {
  png: Blob;
  url: string;
  at: number;
  caption: string;
}

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const count = (n: number, noun: string): string => (n === 1 ? `1 ${noun}` : `${n} ${noun}s`);
const named = (c: Calculation): string => JSON.stringify(c.name === '' ? c.text : c.name);

export function App(): JSX.Element {
  const log = new RequestLog();
  let engine: Engine | undefined;
  onCleanup(() => engine?.dispose());

  // ---- the status line, and the recording that hears it -------------
  let live: LiveRecording | undefined;
  const [status, setStatusLine] = createSignal('starting');
  function setStatus(text: string): void {
    setStatusLine(text);
    live?.say(text);
  }

  // ---- the mode -------------------------------------------------------
  // The server's config: `api` picks the mode with the URL; `myw` is for
  // the dictate button, which reads it in phase 5 of the plan.
  const [server, setServer] = createSignal<ServerConfig>(NO_SERVER);
  const [cfg, setCfg] = createSignal<EngineConfig>();

  // ---- the three parts ------------------------------------------------
  const [calcs, setCalcs] = createSignal<Calculation[]>([]);
  const [draft, setDraft] = createSignal<Calculation>(emptyCalculation());
  const [storeError, setStoreError] = createSignal<string>();
  const [parseError, setParseError] = createSignal<ParseErrorView>();
  const [answer, setAnswer] = createSignal<{ value: number; printed: string }>();
  const [evalError, setEvalError] = createSignal<string>();
  const [busy, setBusy] = createSignal(true);
  // The engine has answered its first list: the record button works.
  const [ready, setReady] = createSignal(false);

  onMount(async () => {
    const sc = await readServerConfig();
    setServer(sc);
    const c = readEngineConfig(location.search, sc);
    setCfg(c);
    engine = createEngine(c, log);
    setStatus(`starting the engine (${describeEngine(c)})`);
    try {
      const list = await engine.list();
      setCalcs(list);
      // The offline page says once that its changes go at a reload:
      // the memory store keeps nothing (prd section 2.3).
      setStatus(c.mode === 'offline' ? OFFLINE_LINE : `connected: ${count(list.length, 'calculation')}`);
      setBusy(false);
      setReady(true);
    } catch (e) {
      setStatus(`the engine did not start: ${messageOf(e)}`);
    }
  });

  /** The result and the errors of the last evaluate, gone: a new calculation is in the form. */
  function clearResult(): void {
    setAnswer(undefined);
    setEvalError(undefined);
    setParseError(undefined);
  }

  /** One request to the engine, with the buttons disabled until it answers; a transport failure is said on the status line. */
  async function run(what: string, f: (e: Engine) => Promise<void>): Promise<void> {
    if (!engine) return;
    setBusy(true);
    try {
      await f(engine);
    } catch (e) {
      if (!(e instanceof EngineError)) setStatus(`${what} failed: ${messageOf(e)}`);
      else throw e;
    } finally {
      setBusy(false);
    }
  }

  function onNew(): void {
    setDraft(emptyCalculation());
    clearResult();
    setStatus('a new calculation');
  }

  function onOpen(id: CalculationId): void {
    void run('open', async (e) => {
      try {
        const c = await e.get(id);
        setDraft(c);
        clearResult();
        setStatus(`opened ${named(c)}`);
      } catch (err) {
        if (err instanceof EngineError) setStoreError(err.message);
        else throw err;
      }
    });
  }

  function onChange(next: Calculation): void {
    // A parse error is about the text it was found in.
    if (next.text !== draft().text) setParseError(undefined);
    setDraft(next);
  }

  function onSave(): void {
    void run('save', async (e) => {
      try {
        const saved = await e.put(draft());
        setDraft(saved);
        setStoreError(undefined);
        setCalcs(await e.list());
        setStatus(`saved ${named(saved)}`);
      } catch (err) {
        if (err instanceof EngineError) setStoreError(err.message);
        else throw err;
      }
    });
  }

  function onDelete(): void {
    const c = draft();
    if (c.id === '') return;
    void run('delete', async (e) => {
      try {
        await e.delete(c.id);
        setStoreError(undefined);
        setCalcs(await e.list());
        setDraft(emptyCalculation());
        clearResult();
        setStatus(`deleted ${named(c)}`);
      } catch (err) {
        if (err instanceof EngineError) setStoreError(err.message);
        else throw err;
      }
    });
  }

  function onEvaluate(): void {
    const c = draft();
    void run('evaluate', async (e) => {
      try {
        const r = await e.evaluate(c.text, c.bindings);
        setAnswer(r);
        setEvalError(undefined);
        setParseError(undefined);
        setStatus(`evaluated ${named(c)}`);
      } catch (err) {
        if (!(err instanceof EngineError)) throw err;
        setAnswer(undefined);
        if (err.at) {
          // A parse error goes under the text, at its column; the
          // result keeps nothing.
          setParseError({ message: err.message, column: err.at.column });
          setEvalError(undefined);
          setStatus('the text does not parse');
        } else {
          setParseError(undefined);
          setEvalError(err.message);
          setStatus(`${named(c)} does not evaluate`);
        }
      }
    });
  }

  // ---- the feedback recording ----------------------------------------
  const [recording, setRecording] = createSignal(false);
  const [changes, setChanges] = createSignal(0);
  const [shots, setShots] = createSignal<Shot[]>([]);
  const [dialog, setDialog] = createSignal(false);
  const [rec, setRec] = createSignal<Recording>();
  const [type, setType] = createSignal<FeedbackType>('bug');
  const [kind, setKind] = createSignal<BugKind>('general');
  let kindTouched = false;
  const [title, setTitle] = createSignal('');
  const [message, setMessage] = createSignal('');
  const [full, setFull] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [saved, setSaved] = createSignal<SavedView>();
  const [failure, setFailure] = createSignal<string>();

  /** One end of the recording: the store as the engine lists it, and the form. */
  async function snapshot(): Promise<Snapshot> {
    const snap: Snapshot = {
      at: performance.now(),
      when: new Date().toISOString(),
      engine: cfg()!,
      open: draft().id,
      form: formCopy(draft()),
      url: location.href,
      userAgent: navigator.userAgent,
      window: {
        width: innerWidth,
        height: innerHeight,
      },
    };
    // The engine's start, as the log heard it: the worker reports one,
    // HTTP has none.
    const boot = log.boot();
    if (boot) snap.boot = boot;
    try {
      snap.store = { calculations: await engine!.list() };
    } catch (e) {
      snap.storeError = messageOf(e);
    }
    return snap;
  }

  async function onRecord(): Promise<void> {
    if (live) {
      // stop: the second snapshot, read while paused so its own list
      // is not a step, then the dialog.
      live.pause();
      const end = await snapshot();
      setRec(live.rec.finish(end));
      setSaved(undefined);
      setFailure(undefined);
      setDialog(true);
      return;
    }
    const start = await snapshot();
    live = startRecording(start, log, () => setChanges(live?.rec.mutations() ?? 0));
    setChanges(0);
    setShots([]);
    setRecording(true);
    setStatus('recording');
  }

  /** Ends the recording and lets go of what it listened to. */
  function endRecording(): void {
    live?.end();
    live = undefined;
    setRecording(false);
    setChanges(0);
  }

  function onKeep(): void {
    live?.rec.drop();
    live?.resume();
    setDialog(false);
  }

  function onDiscard(): void {
    endRecording();
    setDialog(false);
    resetDialog();
    setStatus('recording discarded');
  }

  function resetDialog(): void {
    for (const s of shots()) URL.revokeObjectURL(s.url);
    setShots([]);
    setTitle('');
    setMessage('');
    setFull(false);
    setType('bug');
    setKind('general');
    kindTouched = false;
    setSaved(undefined);
    setFailure(undefined);
    setRec(undefined);
  }

  async function onSubmit(): Promise<void> {
    const r = rec();
    if (!r) return;
    setSaving(true);
    setFailure(undefined);
    try {
      const taken = shots();
      const result = await saveReport(
        title(),
        (files) =>
          renderReport(r, title(), message(), {
            full: full(),
            kind: kind(),
            type: type(),
            screenshots: taken.map((s, i) => ({
              file: files[i]!,
              at: s.at,
              caption: s.caption,
            })),
          }),
        taken.map((s) => s.png),
      );
      setSaved(savedView(result, type()));
      endRecording();
      // The dialog names the file; the status line does not, so it reads
      // the same on each run.
      setStatus(result.where === 'server' ? 'feedback saved' : 'feedback downloaded');
    } catch (e) {
      setFailure(messageOf(e));
    } finally {
      setSaving(false);
    }
  }

  function onClose(): void {
    setDialog(false);
    resetDialog();
  }

  // Alt+Shift+S takes a screenshot while a recording runs, of the
  // dialog too while it is up and the report is not saved.
  const onShotKey = (ev: KeyboardEvent) => {
    if (!isScreenshotKey(ev) || !live || saved()) return;
    ev.preventDefault();
    const at = performance.now();
    void takeScreenshot({ dialogs: dialogOpen() }).then(
      (png) => {
        setShots((s) => [
          ...s,
          {
            png,
            url: URL.createObjectURL(png),
            at,
            caption: '',
          },
        ]);
        if (!dialog()) setStatus(`screenshot ${shots().length} taken`);
      },
      (e: unknown) => setStatus(`the screenshot failed: ${messageOf(e)}`),
    );
  };
  window.addEventListener('keydown', onShotKey, true);
  onCleanup(() => window.removeEventListener('keydown', onShotKey, true));

  return (
    <div class="app">
      <Bar
        recording={recording()}
        changes={changes()}
        mode={cfg()?.mode}
        status={status()}
        canRecord={ready() && !dialog()}
        onRecord={() => void onRecord()}
      />
      <CalculationList calculations={calcs()} open={draft().id === '' ? undefined : draft().id} error={storeError()} onNew={onNew} onOpen={onOpen} />
      <main class="form-column">
        <CalculationForm
          calculation={draft()}
          onChange={onChange}
          parseError={parseError()}
          busy={busy()}
          onEvaluate={onEvaluate}
          onSave={onSave}
          onDelete={onDelete}
        />
      </main>
      <Result answer={answer()} error={evalError()} base={draft().base} />
      <BugReportDialog
        open={dialog()}
        type={type()}
        onType={(t) => {
          setType(t);
          if (!kindTouched) setKind(PROMPT_TYPES.has(t) ? 'prompt' : 'general');
        }}
        kind={kind()}
        onKind={(k) => {
          kindTouched = true;
          setKind(k);
        }}
        title={title()}
        message={message()}
        full={full()}
        fullAllowed={SECTIONS[kind()].has('messages')}
        shots={shots().map((s) => ({
          url: s.url,
          caption: s.caption,
        }))}
        summary={rec() ? summaryOf(rec()!) : ''}
        saving={saving()}
        saved={saved()}
        failure={failure()}
        onTitle={setTitle}
        onMessage={setMessage}
        onFull={setFull}
        onCaption={(i, caption) => setShots((s) => s.map((x, j) => (j === i ? { ...x, caption } : x)))}
        onRemove={(i) =>
          setShots((s) => {
            URL.revokeObjectURL(s[i]!.url);
            return s.filter((_, j) => j !== i);
          })
        }
        onSubmit={() => void onSubmit()}
        onKeep={onKeep}
        onDiscard={onDiscard}
        onClose={onClose}
      />
    </div>
  );
}
