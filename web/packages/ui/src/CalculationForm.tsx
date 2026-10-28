// The form: the part in the middle, the fields of one model.Calculation.
// The form is the calculator: **evaluate** is beside **save** and
// **delete**. docs/glossary.md, "The form".
//
//   name      [                     ]
//   text      [(x + 3) * y          ]
//             ^ the parse error, at its column
//   bindings  name   value   ×
//             [add]
//   base      [decimal]
//   notes     [x] [the text area     ]
//   star      [ ]
//             [evaluate] [save] [delete]
//
// It is controlled: the app holds the record and the parse error, and
// this file knows nothing of the engine. Enter in a field evaluates,
// the form's default action.
//
// Controls stay put (web/AGENTS.md): the parse error's line has a fixed
// height and is there when it is empty; the bindings scroll in a fixed
// height; a hidden notes text area keeps its place; every button has
// one width.

import { createSignal, type JSX } from 'solid-js';
import type { Base, Calculation } from '@protowx/client';
import { Bindings } from './Bindings';

export const BASES: readonly Base[] = ['decimal', 'hex', 'binary'];

/** A parse error, as the form draws it under the text. */
export interface ParseErrorView {
  message: string;
  /** From 1, as the engine counts it. */
  column: number;
}

export interface CalculationFormProps {
  calculation: Calculation;
  onChange(next: Calculation): void;
  /** The text's parse error from the last evaluate, or nothing. */
  parseError?: ParseErrorView;
  /** While a request is out: the buttons are disabled, and keep their places. */
  busy?: boolean;
  onEvaluate(): void;
  onSave(): void;
  onDelete(): void;
}

export function CalculationForm(props: CalculationFormProps): JSX.Element {
  // The notes' text while the checkbox is off, so off and on again
  // gives the same words back.
  const [kept, setKept] = createSignal('');
  const change = (patch: Partial<Calculation>) => props.onChange({ ...props.calculation, ...patch });
  const notesOn = () => props.calculation.notes.kind === 'just';
  const notes = () => {
    const n = props.calculation.notes;
    return n.kind === 'just' ? n.value : kept();
  };
  return (
    <form
      class="calculation-form"
      data-term="form"
      aria-label="form"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!props.busy) props.onEvaluate();
      }}
    >
      <label class="field">
        <span class="field-label">name</span>
        <input
          type="text"
          name="name"
          data-term="name"
          value={props.calculation.name}
          placeholder="what the calculation is for"
          onInput={(ev) => change({ name: ev.currentTarget.value })}
        />
      </label>
      <label class="field">
        <span class="field-label">text</span>
        <input
          type="text"
          name="text"
          class="text"
          data-term="text"
          value={props.calculation.text}
          spellcheck={false}
          autocomplete="off"
          placeholder="(x + 3) * y"
          aria-invalid={props.parseError ? 'true' : undefined}
          aria-describedby="parse-error"
          onInput={(ev) => change({ text: ev.currentTarget.value })}
        />
      </label>
      <div class="field parse-error-row">
        <span />
        <p class="parse-error" id="parse-error" data-term="parse-error" role="alert" title={props.parseError?.message ?? ''}>
          {props.parseError ? (
            <span class="parse-error-at" style={{ '--pw-parse-error-column': String(props.parseError.column - 1) }}>
              ^ {props.parseError.message}
            </span>
          ) : (
            ''
          )}
        </p>
      </div>
      <div class="field">
        <span class="field-label" id="bindings-label">
          bindings
        </span>
        <Bindings bindings={props.calculation.bindings} onChange={(bindings) => change({ bindings })} />
      </div>
      <label class="field">
        <span class="field-label">base</span>
        <select
          name="base"
          class="base"
          data-term="base"
          value={props.calculation.base}
          onChange={(ev) => change({ base: ev.currentTarget.value as Base })}
        >
          {BASES.map((b) => (
            <option value={b}>{b}</option>
          ))}
        </select>
      </label>
      <div class="field notes" data-term="notes">
        <label class="field-label check">
          <input
            type="checkbox"
            name="notes-on"
            checked={notesOn()}
            onChange={(ev) => {
              if (ev.currentTarget.checked) change({ notes: { kind: 'just', value: kept() } });
              else {
                setKept(notes());
                change({ notes: { kind: 'nothing' } });
              }
            }}
          />
          notes
        </label>
        {/* Hidden, not removed: it keeps its place, so star and the
            buttons under it stay put. */}
        <textarea
          name="notes"
          classList={{ hidden: !notesOn() }}
          aria-hidden={notesOn() ? undefined : 'true'}
          tabIndex={notesOn() ? 0 : -1}
          aria-label="notes"
          value={notes()}
          placeholder="free notes"
          onInput={(ev) => change({ notes: { kind: 'just', value: ev.currentTarget.value } })}
        />
      </div>
      <div class="field">
        <label class="field-label check">
          <input type="checkbox" name="starred" data-term="star" checked={props.calculation.starred} onChange={(ev) => change({ starred: ev.currentTarget.checked })} />
          star
        </label>
      </div>
      <div class="actions">
        <button type="submit" class="primary" data-term="evaluate" disabled={props.busy}>
          evaluate
        </button>
        <button type="button" data-term="save" disabled={props.busy} onClick={() => props.onSave()}>
          save
        </button>
        <button
          type="button"
          data-term="delete"
          disabled={props.busy || props.calculation.id === ''}
          title={props.calculation.id === '' ? 'a new calculation is not in the store yet' : 'remove the calculation from the store'}
          onClick={() => props.onDelete()}
        >
          delete
        </button>
      </div>
    </form>
  );
}
