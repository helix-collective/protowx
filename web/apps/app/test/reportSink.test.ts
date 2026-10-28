// Where a report goes: the server, or a download with the same name.

import { describe, expect, it } from 'vitest';
import { saveReport, savedView, type SinkDeps } from '../src/reportSink';

function deps(answer: (url: string) => Response): SinkDeps & { posts: string[]; downloads: string[] } {
  const posts: string[] = [];
  const downloads: string[] = [];
  return {
    posts,
    downloads,
    fetch: (url) => {
      posts.push(url);
      return Promise.resolve(answer(url));
    },
    download: (file) => downloads.push(file),
    now: () => new Date(2026, 9, 28, 18, 10),
  };
}

const png = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });

describe('saveReport', () => {
  it('sends the screenshots first, then the report that links them', async () => {
    let n = 0;
    const d = deps((url) =>
      new Response(JSON.stringify({ path: url.includes('screenshot') ? `.bugreports/s${++n}.png` : '.bugreports/r.md' }), { status: 201 }),
    );
    let linked: string[] = [];
    const saved = await saveReport('a save', (files) => ((linked = files), '# a save'), [png, png], d);
    expect(d.posts).toEqual(['/api/bugreport/screenshot?title=a%20save', '/api/bugreport/screenshot?title=a%20save', '/api/bugreport']);
    expect(linked).toEqual(['s1.png', 's2.png']);
    expect(saved).toEqual({ where: 'server', path: '.bugreports/r.md', shots: ['.bugreports/s1.png', '.bugreports/s2.png'] });
    expect(savedView(saved, 'bug')).toEqual({ where: 'server', file: '.bugreports/r.md', prompt: 'Fix the bug in .bugreports/r.md.', shots: 2, why: undefined });
  });

  it('downloads the report and its screenshots when the server refuses', async () => {
    const d = deps(() => new Response('no', { status: 404 }));
    const saved = await saveReport('a save', () => '# a save', [png], d);
    expect(saved).toMatchObject({ where: 'download', file: '20261028-1810__a-save.md', why: 'the server answered 404' });
    expect(d.downloads).toEqual(['20261028-1810__a-save.png', '20261028-1810__a-save.md']);
  });
});
