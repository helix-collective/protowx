// The typed client against the real wasm engine, under node: the store
// requests, and an evaluate of each case of docs/features/001-calculator/prd.md
// section 1.4. task calc:wasm builds the binary first; task web:test
// runs it.

import { beforeAll, describe, expect, it } from 'vitest';
import {
  EngineError,
  RequestLog,
  TypedEngine,
  DirectTransport,
  decodeRequest,
  emptyCalculation,
  encodeRequest,
  formatValue,
  type Engine,
} from '../src/index';
import { engineFn, newEngine } from './setup';

let engine: Engine;

beforeAll(async () => {
  engine = await newEngine();
});

/** The error an engine call throws, or a failure when it does not throw. */
async function refused(p: Promise<unknown>): Promise<EngineError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(EngineError);
    return e as EngineError;
  }
  throw new Error('the engine answered, and was expected to refuse');
}

describe('the store', () => {
  it('lists the three seeded calculations', async () => {
    const names = (await engine.list()).map((c) => c.name);
    expect(names).toEqual(['the example', 'precedence', 'division by zero']);
  });

  it('reads the seeds field by field', async () => {
    const [example, precedence, divide] = await engine.list();
    expect(example!.bindings).toEqual([
      { name: 'x', value: 5 },
      { name: 'y', value: 1 },
    ]);
    expect(precedence!.notes).toEqual({ kind: 'just', value: 'Times binds tighter than plus: the value is 14, not 20.' });
    expect(example!.notes.kind).toBe('nothing');
    expect(divide!.base).toBe('hex');
  });

  it('puts a new calculation, and the list has it', async () => {
    const put = await engine.put({
      ...emptyCalculation(),
      name: 'rent',
      text: 'a * 12',
      bindings: [{ name: 'a', value: 900 }],
      starred: true,
    });
    expect(put.id).toBe('4');
    const list = await engine.list();
    expect(list.map((c) => c.id)).toEqual(['1', '2', '3', '4']);
    expect(list[3]).toEqual(put);
    expect(await engine.get('4')).toEqual(put);
  });

  it('updates a calculation in its place', async () => {
    const was = await engine.get('4');
    await engine.put({ ...was, name: 'rent a year' });
    const list = await engine.list();
    expect(list.map((c) => c.name)).toEqual(['the example', 'precedence', 'division by zero', 'rent a year']);
  });

  it('deletes a calculation, and refuses an unknown id', async () => {
    expect(await engine.delete('4')).toBe('4');
    expect((await engine.list()).map((c) => c.id)).toEqual(['1', '2', '3']);
    const e = await refused(engine.delete('4'));
    expect(e.at).toBeUndefined();
  });
});

describe('evaluate', () => {
  it.each([
    ['42', [], 42, '42'],
    ['x + y', [{ name: 'x', value: 2 }, { name: 'y', value: 3 }], 5, '(x + y)'],
    ['(x + 3) * y', [{ name: 'x', value: 5 }, { name: 'y', value: 1 }], 8, '((x + 3) * y)'],
    ['(x + 3) * y - 10 / 2', [{ name: 'x', value: 5 }, { name: 'y', value: 1 }], 3, '(((x + 3) * y) - (10 / 2))'],
    ['2 + 3 * 4', [], 14, '(2 + (3 * 4))'],
  ])('%s is the value and the printed form', async (text, bindings, value, printed) => {
    expect(await engine.evaluate(text, bindings)).toEqual({ value, printed });
  });

  it('refuses a variable with no binding', async () => {
    const e = await refused(engine.evaluate('x + 1', []));
    expect(e.message).toBe('unknown variable x');
    expect(e.at).toBeUndefined();
  });

  it('refuses a division by zero, and prints the division', async () => {
    const e = await refused(engine.evaluate('10 / 0', []));
    expect(e.message).toBe('division by zero: 10 / 0');
    expect(e.at).toBeUndefined();
  });

  it('refuses a value past int64', async () => {
    const e = await refused(engine.evaluate('x * x', [{ name: 'x', value: 2 ** 40 }]));
    expect(e.message).toBe('the value overflows');
  });

  it('refuses a text that does not parse, and says where', async () => {
    const e = await refused(engine.evaluate('(x + 3', [{ name: 'x', value: 1 }]));
    expect(e.at).toEqual({ line: 1, column: 7 });
  });
});

describe('parse', () => {
  it('answers the AST and the printed form', async () => {
    const p = await engine.parse('2 + 3 * 4');
    expect(p.printed).toBe('(2 + (3 * 4))');
    expect(p.exp.kind).toBe('bin');
  });
});

describe('the wire', () => {
  it('spells a request as ADL JSON, and reads it back', () => {
    const req = { kind: 'evaluate' as const, value: { text: 'x', bindings: [{ name: 'x', value: 5 }] } };
    const text = encodeRequest(req);
    expect(JSON.parse(text)).toEqual({ evaluate: { text: 'x', bindings: [{ name: 'x', value: 5 }] } });
    expect(decodeRequest(JSON.parse(text))).toEqual(req);
  });

  it('logs every message through a logged transport', async () => {
    const log = new RequestLog();
    const logged = new TypedEngine(log.wrap(new DirectTransport(await engineFn())));
    await logged.list();
    await refused(logged.evaluate('1 / 0', []));
    expect(log.snapshot().map((e) => [e.kind, e.status])).toEqual([
      ['list', 'ok'],
      ['evaluate', 'error'],
    ]);
  });
});

describe('formatValue', () => {
  it.each([
    [14, 'decimal', '14'],
    [14, 'hex', '0xe'],
    [14, 'binary', '0b1110'],
    [-14, 'hex', '-0xe'],
  ] as const)('%d in %s is %s', (value, base, text) => {
    expect(formatValue(value, base)).toBe(text);
  });
});
