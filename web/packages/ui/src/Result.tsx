// The result: the part on the right. The value, large, in the
// calculation's base, and under it the printed expression, the text
// fully parenthesised. An evaluation error replaces the value with its
// message. docs/glossary.md, "The result".
//
// It holds the value as a number, so a change of the base draws it
// again at once, with no new evaluate.

import { Show, type JSX } from 'solid-js';
import { formatValue, type Base } from '@protowx/client';

export interface ResultProps {
  /** The last evaluate's answer, or nothing before one. */
  answer?: { value: number; printed: string };
  /** The last evaluate's error, when it was not a parse error. */
  error?: string;
  base: Base;
}

/** The value's place before the first evaluate. */
export const NO_RESULT = 'evaluate shows the value here';

export function Result(props: ResultProps): JSX.Element {
  return (
    <section class="result" data-term="result" aria-label="result">
      <div class="value-slot">
        <Show
          when={props.error === undefined}
          fallback={
            <p class="evaluation-error" data-term="evaluation-error" role="alert">
              {props.error}
            </p>
          }
        >
          <Show when={props.answer} fallback={<p class="no-result">{NO_RESULT}</p>}>
            {(a) => (
              <output class="value" data-term="value" data-base={props.base}>
                {formatValue(a().value, props.base)}
              </output>
            )}
          </Show>
        </Show>
      </div>
      <p class="printed" data-term="printed-expression">
        {props.error === undefined ? (props.answer?.printed ?? '') : ''}
      </p>
    </section>
  );
}
