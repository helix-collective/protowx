// The calculation list: the column on the left, one row per
// calculation, its star and its name. **new** sits above the rows, and
// the store error at their foot. docs/glossary.md, "The calculation
// list".
//
// Controls stay put (web/AGENTS.md): **new** is above the rows, so a
// new row moves it nowhere. The open row is marked by a fill and a
// text colour, never by a size. The rows scroll inside the column, and
// the store error has a fixed height at the foot, so a message that
// comes and goes moves no row.

import { For, type JSX } from 'solid-js';
import type { Calculation, CalculationId } from '@protowx/client';

export interface CalculationListProps {
  calculations: readonly Calculation[];
  /** The id of the calculation in the form; none for a new one. */
  open?: CalculationId;
  /** The store's refusal of the last save or delete, or nothing. */
  error?: string;
  onNew(): void;
  onOpen(id: CalculationId): void;
}

/** A row's words when the calculation has no name. */
export const NO_NAME = '(no name)';

export function CalculationList(props: CalculationListProps): JSX.Element {
  return (
    <nav class="calculation-list" data-term="calculation-list" aria-label="calculation list">
      <div class="list-head">
        <button type="button" class="new" data-term="new" onClick={() => props.onNew()}>
          new
        </button>
      </div>
      <ul class="rows">
        <For each={props.calculations}>
          {(c) => (
            <li>
              <button
                type="button"
                class="row"
                data-term="row"
                data-id={c.id}
                aria-current={props.open === c.id ? 'true' : undefined}
                title={c.text}
                onClick={() => props.onOpen(c.id)}
              >
                <span class="row-star" aria-label={c.starred ? 'starred' : undefined}>
                  {c.starred ? '★' : ''}
                </span>
                <span class="row-name">{c.name === '' ? NO_NAME : c.name}</span>
              </button>
            </li>
          )}
        </For>
      </ul>
      <p class="store-error" data-term="store-error" role="alert">
        {props.error ?? ''}
      </p>
    </nav>
  );
}
