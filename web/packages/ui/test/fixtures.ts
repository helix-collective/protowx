// The three seeded calculations of engine/store, as the engine lists
// them, for the component tests.

import type { Calculation } from '@protowx/client';

export const seeds: Calculation[] = [
  {
    id: '1',
    name: 'the example',
    text: '(x + 3) * y',
    bindings: [
      { name: 'x', value: 5 },
      { name: 'y', value: 1 },
    ],
    base: 'decimal',
    notes: { kind: 'nothing' },
    starred: false,
  },
  {
    id: '2',
    name: 'precedence',
    text: '2 + 3 * 4',
    bindings: [],
    base: 'decimal',
    notes: { kind: 'just', value: 'Times binds tighter than plus: the value is 14, not 20.' },
    starred: false,
  },
  {
    id: '3',
    name: 'division by zero',
    text: '10 / 0',
    bindings: [],
    base: 'hex',
    notes: { kind: 'nothing' },
    starred: false,
  },
];

/** A host of a fixed width in the body, for a component that fills its parent. */
export function host(width = '900px', height?: string): HTMLElement {
  const el = document.createElement('div');
  el.style.width = width;
  if (height) el.style.height = height;
  document.body.appendChild(el);
  return el;
}
