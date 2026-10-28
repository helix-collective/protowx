// Small helpers over model.Calculation that both the page and the
// tests need: a new record, the value in a record's base, the notes.

import type { Base, Calculation } from './adl/model';

/** A calculation the store does not hold yet: an empty id, which a put turns into a new one. */
export function emptyCalculation(): Calculation {
  return {
    id: '',
    name: '',
    text: '',
    bindings: [],
    base: 'decimal',
    notes: { kind: 'nothing' },
    starred: false,
  };
}

/**
 * A value in a base: `14`, `0xe`, `0b1110`. A negative value keeps its
 * sign in front of the prefix: `-0xe`.
 */
export function formatValue(value: number, base: Base): string {
  const sign = value < 0 ? '-' : '';
  const abs = BigInt(Math.abs(value));
  switch (base) {
    case 'hex':
      return `${sign}0x${abs.toString(16)}`;
    case 'binary':
      return `${sign}0b${abs.toString(2)}`;
    default:
      return String(value);
  }
}

/** The notes' text, or '' with none. */
export function notesText(c: Calculation): string {
  return c.notes.kind === 'just' ? c.notes.value : '';
}
