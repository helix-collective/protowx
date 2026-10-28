// What the page learns about its server at load: whether the feedback
// report routes are on, whether the engine API is, and where My
// Whisper is. bff answers GET /api/config; the page never guesses a
// port. services/bff/config.go writes the body.
//
//   /api/config     { "myw": "http://127.0.0.1:8090", "bugs": true, "api": true }
//   /?myw=<url>     overrides the URL bff names, as ?api= overrides the engine's
//
// Under `task web:dev` there is no bff: Vite answers the fetch with
// index.html as a 200, which is not JSON, and that is no server.

export const CONFIG_URL = '/api/config';

export interface ServerConfig {
  /** My Whisper's URL, the transcription service, or '' for none. */
  myw: string;
  /** Whether the server takes feedback reports and their screenshots. */
  bugs: boolean;
  /** Whether the server answers the engine protocol at POST /api/calc. */
  api: boolean;
}

/** The config with no server: nothing to send to, no engine, nothing to transcribe. */
export const NO_SERVER: ServerConfig = {
  myw: '',
  bugs: false,
  api: false,
};

/**
 * Reads the server's config once. `?myw=` on the page's URL wins over
 * the URL the server names, so a developer points a page at a service
 * without a restart of bff. A fetch that fails, or that answers
 * anything but JSON with the three fields, is no server.
 */
export async function readServerConfig(
  search: string = location.search,
  fetchFn: (url: string) => Promise<Response> = (url) => fetch(url, { cache: 'no-store' }),
): Promise<ServerConfig> {
  const param = new URLSearchParams(search).get('myw');
  const served = await fromServer(fetchFn);
  return {
    ...served,
    myw: param === null ? served.myw : param.replace(/\/$/, ''),
  };
}

async function fromServer(fetchFn: (url: string) => Promise<Response>): Promise<ServerConfig> {
  try {
    const resp = await fetchFn(CONFIG_URL);
    if (!resp.ok) return NO_SERVER;
    const body = (await resp.json()) as { myw?: unknown; bugs?: unknown; api?: unknown };
    if (typeof body.myw !== 'string' || typeof body.bugs !== 'boolean' || typeof body.api !== 'boolean') return NO_SERVER;
    return {
      myw: body.myw.replace(/\/$/, ''),
      bugs: body.bugs,
      api: body.api,
    };
  } catch {
    return NO_SERVER;
  }
}
