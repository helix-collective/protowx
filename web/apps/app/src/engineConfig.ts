// Which engine the page talks to, read from the URL and the server's
// config, so both modes are reachable without a rebuild.
//
//   /?offline              offline: the wasm engine in its worker
//   /?api=http://host:9000/api/calc
//                          connected, to that URL
//   /                      connected when the server says `api: true`,
//                          offline when it says false or there is none
//
// So bff with --api serves the connected page at `/`, and bff with
// --api=false and Vite's dev server serve the offline one: neither has
// /api/calc, and a POST to it would fail.

import { DEFAULT_API_URL, type EngineConfig } from '@protowx/client';
import type { ServerConfig } from './serverConfig';

/**
 * The config from a query string and the server's config. `offline`
 * present, with any value, is offline; `api` present is connected to
 * its URL. With neither, the server's `api` decides.
 */
export function readEngineConfig(search: string, server: ServerConfig): EngineConfig {
  const params = new URLSearchParams(search);
  const api = params.get('api');
  if (params.has('offline')) return { mode: 'offline' };
  if (api !== null) return { mode: 'connected', url: api === '' ? DEFAULT_API_URL : api };
  return server.api ? { mode: 'connected', url: DEFAULT_API_URL } : { mode: 'offline' };
}

/** What a report says is answering: `offline · wasm worker`, `connected · /api/calc`. */
export function describeEngine(cfg: EngineConfig): string {
  return cfg.mode === 'connected' ? `connected · ${cfg.url ?? DEFAULT_API_URL}` : 'offline · wasm worker';
}

/** The status line's one sentence in the offline mode, said once at the start. */
export const OFFLINE_LINE = 'offline: changes are kept until reload';
