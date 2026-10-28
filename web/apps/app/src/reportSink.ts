// Where feedback goes: the server first, a download second.
//
// The page does not know whether a server will take the file. It posts
// to /api/bugreport, which services/bff answers by writing the file
// under --bugs and naming the path. Anything else, no server under
// `task web:dev`, a server run with --bugs '', a network failure, is
// the fallback: the same Markdown downloaded under the same name, which
// `reportName` computes by the server's rule. The page knows which sink
// took the file, never which engine mode it is in.

import type { FeedbackType, SavedView } from '@protowx/ui';
import { promptLine, reportName, screenshotName } from './bugReport';

export const REPORT_URL = '/api/bugreport';
export const SCREENSHOT_URL = '/api/bugreport/screenshot';

/** Which sink took the report, and where it is, with its screenshots. */
export type Saved =
  | { where: 'server'; path: string; shots: string[] }
  | {
      where: 'download';
      file: string;
      shots: string[];
      /** Why the server did not take it, for the dialog. */
      why: string;
    };

/** What saving needs from the browser, so a test can stand in for it. */
export interface SinkDeps {
  fetch(url: string, init: RequestInit): Promise<Response>;
  download(file: string, body: string | Blob): void;
  now(): Date;
}

/** The browser's own: `fetch`, and an anchor with `download` clicked once. */
export const browserDeps: SinkDeps = {
  fetch: (url, init) => fetch(url, init),
  download(file, body) {
    const blob = typeof body === 'string' ? new Blob([body], { type: 'text/markdown;charset=utf-8' }) : body;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file;
    a.style.display = 'none';
    document.body.append(a);
    a.click();
    a.remove();
    // The click has started the download; the URL is not needed after.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  },
  now: () => new Date(),
};

/**
 * Saves the report, and links its screenshots. The screenshots go
 * first, so the report can link to the names the server gives them:
 * `render` takes the links and answers the Markdown. A server that
 * refuses a file means a download of the report and of every
 * screenshot. It throws only when the download fails too, which leaves
 * the dialog open with what the user typed still in it.
 */
export async function saveReport(
  title: string,
  render: (shots: string[]) => string,
  shots: readonly Blob[] = [],
  deps: SinkDeps = browserDeps,
): Promise<Saved> {
  const held: string[] = [];
  let why: string;
  try {
    for (const png of shots) held.push(await post(deps, `${SCREENSHOT_URL}?title=${encodeURIComponent(title || 'screenshot')}`, { headers: { 'Content-Type': 'image/png' }, body: png }));
    const path = await post(deps, REPORT_URL, {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        markdown: render(held.map(baseName)),
      }),
    });
    return { where: 'server', path, shots: held };
  } catch (e) {
    why = e instanceof Error ? e.message : String(e);
  }
  const at = deps.now();
  const files = shots.map((_, i) => screenshotName(title, at, i));
  shots.forEach((png, i) => deps.download(files[i]!, png));
  const file = reportName(title, at);
  deps.download(file, render(files));
  return { where: 'download', file, shots: files, why };
}

/** One POST to a route that answers the path it wrote; it throws why not. */
async function post(deps: SinkDeps, url: string, init: RequestInit): Promise<string> {
  const resp = await deps.fetch(url, { method: 'POST', ...init });
  if (!resp.ok) throw new Error(`the server answered ${resp.status}`);
  const body = (await resp.json()) as { path?: unknown };
  if (typeof body.path !== 'string' || body.path === '') throw new Error('the server named no path');
  return body.path;
}

/** The last part of a path: a screenshot's name beside the report. */
function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** The report's path on the server, or its file name in the downloads. */
export function fileFor(saved: Saved): string {
  return saved.where === 'server' ? saved.path : saved.file;
}

/** The dialog's view of a save: where, the file, the prompt line. */
export function savedView(saved: Saved, type: FeedbackType): SavedView {
  return {
    where: saved.where,
    file: fileFor(saved),
    prompt: promptLine(type, fileFor(saved)),
    shots: saved.shots.length,
    why: saved.where === 'download' ? saved.why : undefined,
  };
}
