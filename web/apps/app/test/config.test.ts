// The mode and the server's config: what the page reads at load.

import { describe, expect, it } from 'vitest';
import { describeEngine, readEngineConfig } from '../src/engineConfig';
import { NO_SERVER, readServerConfig, type ServerConfig } from '../src/serverConfig';

const withApi: ServerConfig = { myw: '', bugs: true, api: true };
const noApi: ServerConfig = { myw: '', bugs: true, api: false };

describe('readEngineConfig', () => {
  it.each([
    ['', withApi, { mode: 'connected', url: '/api/calc' }],
    ['', noApi, { mode: 'offline' }],
    ['', NO_SERVER, { mode: 'offline' }],
    ['?offline', withApi, { mode: 'offline' }],
    ['?api=http://127.0.0.1:9000/api/calc', NO_SERVER, { mode: 'connected', url: 'http://127.0.0.1:9000/api/calc' }],
  ] as const)('%j with %j is %j', (search, server, want) => {
    expect(readEngineConfig(search, server)).toEqual(want);
  });

  it('says which engine answers', () => {
    expect(describeEngine({ mode: 'offline' })).toBe('offline · wasm worker');
    expect(describeEngine({ mode: 'connected', url: '/api/calc' })).toBe('connected · /api/calc');
  });
});

describe('readServerConfig', () => {
  const answer = (body: unknown, status = 200) => () => Promise.resolve(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));

  it('reads bff\'s body', async () => {
    expect(await readServerConfig('', answer({ myw: 'http://127.0.0.1:8090/', bugs: true, api: false }))).toEqual({
      myw: 'http://127.0.0.1:8090',
      bugs: true,
      api: false,
    });
  });

  it('is no server for Vite\'s index.html, a 404 and a failed fetch', async () => {
    expect(await readServerConfig('', answer('<!doctype html>'))).toEqual(NO_SERVER);
    expect(await readServerConfig('', answer({}, 404))).toEqual(NO_SERVER);
    expect(await readServerConfig('', () => Promise.reject(new Error('refused')))).toEqual(NO_SERVER);
  });

  it('takes My Whisper\'s URL from ?myw= over the server\'s', async () => {
    const c = await readServerConfig('?myw=http://h:1/', answer({ myw: 'http://127.0.0.1:8090', bugs: false, api: true }));
    expect(c.myw).toBe('http://h:1');
  });
});
