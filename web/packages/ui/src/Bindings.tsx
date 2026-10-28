// The bindings: the small table of the variables the expression may
// name, a name and a value per row, a remove `×` at each row's right
// end, and the add row below. docs/glossary.md, "bindings".
//
// A value is an Int64. The value field takes an integer; while its
// text is not one, such as a lone `-`, the binding keeps its last
// value, and the field keeps the text.
//
// Controls stay put (web/AGENTS.md): the rows scroll inside a fixed
// height, `--pw-bindings-height`, so an add or a remove moves nothing
// under the table. **add** is below the scroller and stays put. A
// remove moves the rows after the removed one up, and nothing else: the
// row is the control the click removes.

import { Index, type JSX } from 'solid-js';
import type { Binding } from '@protowx/client';

export interface BindingsProps {
  bindings: readonly Binding[];
  onChange(next: Binding[]): void;
}

export function Bindings(props: BindingsProps): JSX.Element {
  const set = (i: number, b: Binding) => props.onChange(props.bindings.map((x, j) => (j === i ? b : x)));
  return (
    <div class="bindings" data-term="bindings">
      <div class="bindings-scroll">
        <table>
          <colgroup>
            <col class="binding-name-col" />
            <col class="binding-value-col" />
            <col class="binding-remove-col" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">name</th>
              <th scope="col">value</th>
              <th scope="col">
                <span class="visually-hidden">remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Index, not For: a key press gives a new object for the
                row, and For would build the row again, field and focus
                with it. */}
            <Index each={props.bindings}>
              {(b, i) => (
                <tr data-term="binding">
                  <td>
                    <input
                      type="text"
                      class="binding-name"
                      value={b().name}
                      spellcheck={false}
                      aria-label={`name of binding ${i + 1}`}
                      onInput={(ev) =>
                        set(i, {
                          name: ev.currentTarget.value,
                          value: b().value,
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      inputmode="numeric"
                      class="binding-value"
                      value={String(b().value)}
                      aria-label={`value of binding ${i + 1}`}
                      onInput={(ev) => {
                        const n = integerOf(ev.currentTarget.value);
                        if (n !== undefined)
                          set(i, {
                            name: b().name,
                            value: n,
                          });
                      }}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      class="remove"
                      data-term="remove"
                      title={`remove the binding ${b().name}`}
                      aria-label={`remove binding ${i + 1}`}
                      onClick={() => props.onChange(props.bindings.filter((_, j) => j !== i))}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              )}
            </Index>
          </tbody>
        </table>
      </div>
      <button
        type="button"
        class="add"
        data-term="add"
        onClick={() =>
          props.onChange([
            ...props.bindings,
            {
              name: '',
              value: 0,
            },
          ])
        }
      >
        add
      </button>
    </div>
  );
}

/** The integer a field holds, or undefined while its text is not one. */
export function integerOf(text: string): number | undefined {
  const t = text.trim();
  if (!/^-?\d+$/.test(t)) return undefined;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : undefined;
}
