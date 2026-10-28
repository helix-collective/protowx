// The visual diff of the baselines that `--update-snapshots` rewrote:
// one page under docs/changes/visual-diff/<descr>/, with each changed
// shot's region zoomed from the old and the new picture, the changed
// pixels tinted, and the whole pictures swapping on hover.
// `task baselines -- <descr>` runs it after the suites.
// docs/devtools/merging-branches.md section 4 is the page.
//
//   node regression/visualDiff.mjs <descr> [--out <dir>]
//
// The old picture is the baseline as the index holds it, `git show
// :<path>`, so it works on a branch and in a merge alike. The new
// picture is the file in the worktree. A baseline that git does not
// know yet is new, and is shown alone.
//
// The page records the commits: HEAD, and MERGE_HEAD in a merge, and
// for each shot the commit that wrote its old baseline. The new
// baselines have no commit yet; the one that adds the page holds them.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { PNG } from 'pngjs';

const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const outArg = outAt >= 0 ? args.splice(outAt, 2)[1] : undefined;
const descr = args[0];
if (!descr || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(descr)) {
  console.error('visual-diff: give a kebab-case description: node regression/visualDiff.mjs <descr> [--out <dir>]');
  process.exit(2);
}

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' });
const gitBuf = (...a) => execFileSync('git', a, { maxBuffer: 64 << 20 });
const top = git('rev-parse', '--show-toplevel').trim();
const scenarios = join(top, 'web', 'regression', 'scenarios');
const out = resolve(outArg ?? join(top, 'docs', 'changes', 'visual-diff', descr));

// The baselines the worktree changed or added, from git's view.
const changedFiles = [];
for (const line of git('status', '--porcelain', '--untracked-files=all', '--', scenarios).split('\n')) {
  if (!line) continue;
  const code = line.slice(0, 2);
  const path = line.slice(3).trim();
  if (!path.endsWith('.png')) continue;
  if (code.includes('U')) continue;
  // The second column is the worktree against the index: M is a
  // baseline the run rewrote, and ?? one it wrote for the first time.
  // A baseline staged but not rewritten, as a merge stages them, is
  // not a change.
  if (code === '??') changedFiles.push({ path: join(top, path), rel: path, isNew: true });
  else if (code[1] === 'M') changedFiles.push({ path: join(top, path), rel: path, isNew: false });
}
if (changedFiles.length === 0) {
  console.log('visual-diff: no baseline changed; nothing to write');
  process.exit(0);
}

// The commits the diff is read against: HEAD, and MERGE_HEAD in a merge.
const commitAt = (ref) => {
  let line;
  try {
    line = git('log', '-1', '--format=%H%x00%s', ref).trim();
  } catch {
    return undefined;
  }
  const [sha, subject] = line.split('\0');
  return { ref, sha, short: sha.slice(0, 12), subject };
};
const commits = [commitAt('HEAD'), commitAt('MERGE_HEAD')].filter(Boolean);

/** The short sha of the commit that wrote the old baseline: the index's blob, found in HEAD or MERGE_HEAD. */
function oldCommit(rel) {
  const staged = git('ls-files', '-s', '--', rel).split(/\s+/)[1];
  for (const c of commits) {
    let blob;
    try {
      blob = git('rev-parse', '-q', '--verify', `${c.ref}:${rel}`).trim();
    } catch {
      continue;
    }
    if (blob === staged) return git('log', '-1', '--format=%H', c.ref, '--', rel).trim().slice(0, 12);
  }
  return 'staged';
}

const read = (buf) => PNG.sync.read(buf);
const write = (p, png) => writeFileSync(p, PNG.sync.write(png));

/** The box around every pixel that differs, and how many there are. */
function changed(a, b) {
  const w = Math.max(a.width, b.width);
  const h = Math.max(a.height, b.height);
  let x0 = w, y0 = h, x1 = -1, y1 = -1, n = 0;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let d;
      if (x >= a.width || y >= a.height || x >= b.width || y >= b.height) d = true;
      else {
        const i = (y * a.width + x) * 4;
        const j = (y * b.width + x) * 4;
        d = Math.abs(a.data[i] - b.data[j]) + Math.abs(a.data[i + 1] - b.data[j + 1]) + Math.abs(a.data[i + 2] - b.data[j + 2]) > 24;
      }
      if (!d) continue;
      mask[y * w + x] = 1;
      n++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return { x0, y0, x1, y1, n, mask, w, h };
}

/** A crop of `src` scaled by `z`, nearest; with `mask`, the changed pixels tinted and the rest faded. */
function crop(src, box, z, mask, mw) {
  const cw = box.x1 - box.x0 + 1;
  const ch = box.y1 - box.y0 + 1;
  const png = new PNG({ width: cw * z, height: ch * z });
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const sx = box.x0 + Math.floor(x / z);
      const sy = box.y0 + Math.floor(y / z);
      const o = (y * png.width + x) * 4;
      let r = 255, g = 255, b = 255, al = 255;
      if (sx < src.width && sy < src.height) {
        const i = (sy * src.width + sx) * 4;
        r = src.data[i];
        g = src.data[i + 1];
        b = src.data[i + 2];
        al = src.data[i + 3];
      }
      if (mask) {
        if (mask[sy * mw + sx]) {
          r = 255;
          g = 0;
          b = 128;
        } else {
          r = 160 + r * 0.37;
          g = 160 + g * 0.37;
          b = 160 + b * 0.37;
        }
      }
      png.data[o] = r;
      png.data[o + 1] = g;
      png.data[o + 2] = b;
      png.data[o + 3] = al;
    }
  }
  return png;
}

mkdirSync(out, { recursive: true });
const shots = [];
for (const f of changedFiles) {
  // scenarios/<scenario>.json-snapshots/<server>/<shot>-linux.png: the
  // shot is named with its server, `offline/end`.
  const parts = relative(scenarios, f.path).split('/');
  const scenario = parts[0].replace(/\.json-snapshots$/, '');
  const shot = parts.slice(1).join('/').replace(/-linux\.png$/, '').replace(/\.png$/, '');
  // The file names flatten the server into the name: `crud--offline-end`.
  const id = `${scenario}--${shot.replaceAll('/', '-')}`;
  const now = read(readFileSync(f.path));
  writeFileSync(join(out, `${id}-new.png`), readFileSync(f.path));
  if (f.isNew) {
    shots.push({ id, scenario, shot, isNew: true, size: [now.width, now.height] });
    continue;
  }
  const oldBuf = gitBuf('show', `:${f.rel}`);
  writeFileSync(join(out, `${id}-old.png`), oldBuf);
  const old = read(oldBuf);
  const c = changed(old, now);
  const pad = 24;
  const box = {
    x0: Math.max(0, c.x0 - pad),
    y0: Math.max(0, c.y0 - pad),
    x1: Math.min(c.w - 1, c.x1 + pad),
    y1: Math.min(c.h - 1, c.y1 + pad),
  };
  const boxW = box.x1 - box.x0 + 1;
  const z = boxW > 900 ? 1 : boxW > 450 ? 2 : 3;
  write(join(out, `${id}-crop-old.png`), crop(old, box, z));
  write(join(out, `${id}-crop-new.png`), crop(now, box, z));
  write(join(out, `${id}-crop-marked.png`), crop(now, box, z, c.mask, c.w));
  shots.push({
    id,
    scenario,
    shot,
    isNew: false,
    n: c.n,
    region: { w: c.x1 - c.x0 + 1, h: c.y1 - c.y0 + 1, x: c.x0, y: c.y0 },
    size: { old: [old.width, old.height], now: [now.width, now.height] },
    z,
    oldCommit: oldCommit(f.rel),
  });
}
shots.sort((p, q) => p.scenario.localeCompare(q.scenario) || p.shot.localeCompare(q.shot));

const esc = (s) => String(s).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);
const regionText = (s) => `${s.region.w}×${s.region.h} at ${s.region.x},${s.region.y}`;
const section = (s) =>
  s.isNew
    ? `
<section id="${esc(s.id)}">
  <h2>${esc(s.scenario)} / ${esc(s.shot)} <small>new · ${s.size.join('×')}</small></h2>
  <figure><figcaption>the new baseline; it had none before</figcaption><img class="whole" src="${s.id}-new.png" alt="new baseline"></figure>
</section>`
    : `
<section id="${esc(s.id)}">
  <h2>${esc(s.scenario)} / ${esc(s.shot)} <small>${s.n} pixels differ · region ${regionText(s)} · old ${s.size.old.join('×')}, new ${s.size.now.join('×')} · old baseline from ${esc(s.oldCommit)}</small></h2>
  <h3>the changed region, ×${s.z}</h3>
  <div class="row">
    <figure><figcaption>old baseline</figcaption><img src="${s.id}-crop-old.png" alt="old baseline, cropped"></figure>
    <figure><figcaption>new baseline</figcaption><img src="${s.id}-crop-new.png" alt="new baseline, cropped"></figure>
    <figure><figcaption>changed pixels in magenta, over the new</figcaption><img src="${s.id}-crop-marked.png" alt="changed pixels marked"></figure>
  </div>
  <h3>the whole shot: hover for the new, or tick blink</h3>
  <div class="swap"><img class="whole old" src="${s.id}-old.png" alt="old baseline"><img class="whole new" src="${s.id}-new.png" alt="new baseline"><span class="tag">old</span></div>
</section>`;

const branch = git('branch', '--show-current').trim();
const when = new Date().toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });
const commitText = commits.map((c) => `${c.ref} ${c.short}`).join(', ');
const html = `<!doctype html>
<meta charset="utf-8">
<title>visual diff · ${esc(descr)}</title>
<style>
  body { font: 14px/1.4 system-ui, sans-serif; margin: 16px 24px; color: #111; }
  h1 { font-size: 20px; }
  h2 { font-size: 16px; margin: 32px 0 4px; border-top: 2px solid #ddd; padding-top: 12px; }
  h2 small { font-weight: 400; color: #666; margin-left: 8px; }
  h3 { font-size: 13px; color: #444; margin: 12px 0 6px; text-transform: uppercase; letter-spacing: .04em; }
  nav a { margin-right: 12px; }
  .row { display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-start; }
  figure { margin: 0; }
  figcaption { font-size: 12px; color: #555; margin-bottom: 4px; }
  .row img { border: 1px solid #ccc; image-rendering: pixelated; max-width: 100%; }
  img.whole { max-width: 100%; border: 1px solid #ccc; }
  .swap { position: relative; display: inline-block; }
  .swap img.new { position: absolute; left: 0; top: 0; opacity: 0; }
  .swap:hover img.new, body.blink .swap img.new { opacity: 1; }
  .swap .tag { position: absolute; left: 8px; top: 8px; background: #111c; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
  .swap:hover .tag::after, body.blink .swap .tag::after { content: ' → new'; }
</style>
<h1>visual diff · ${esc(descr)} <small>${shots.length} baselines, ${esc(branch)}, ${when}, ${esc(commitText)}</small></h1>
<p>Each shot: the changed region zoomed from the old and the new baseline, then the changed pixels in magenta.
Under it, the whole old baseline; hover it and the new one takes its place.
The old baseline is the one in git's index; each shot names the commit that wrote it.
The new baseline is the one in the worktree; the commit that adds this page holds it.
<label><input type="checkbox" id="blink"> blink old/new every second</label></p>
<nav>${shots.map((s) => `<a href="#${esc(s.id)}">${esc(s.scenario)}/${esc(s.shot)}</a>`).join('')}</nav>
${shots.map(section).join('\n')}
<script>
  const box = document.getElementById('blink'); let t;
  box.onchange = () => { clearInterval(t); document.body.classList.remove('blink');
    if (box.checked) t = setInterval(() => document.body.classList.toggle('blink'), 1000); };
</script>
`;
writeFileSync(join(out, 'index.html'), html);

// README.md beside it: the table, padded, as md-table-fmt wants it.
const rows = shots.map((s) => [
  `\`${s.scenario}\``,
  `\`${s.shot}\``,
  s.isNew ? 'new' : String(s.n),
  s.isNew ? '' : regionText(s),
  s.isNew ? '' : `\`${s.oldCommit}\``,
]);
const head = ['scenario', 'shot', 'pixels', 'region', 'old commit'];
const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => [...r[i]].length)));
const line = (cells) => `| ${cells.map((c, i) => c + ' '.repeat(widths[i] - [...c].length)).join(' | ')} |`;
const table = [line(head), `|${widths.map((w) => '-'.repeat(w + 2)).join('|')}|`, ...rows.map(line)].join('\n');
writeFileSync(
  join(out, 'README.md'),
  `# ${descr}

The baselines that \`task baselines -- ${descr}\` took again, on
\`${branch}\`, ${when}. [index.html](index.html) is the visual diff:
open it in a browser.

The commits:

${commits.map((c) => `- \`${c.ref}\`: \`${c.sha}\`, ${c.subject}`).join('\n')}

The old baseline of a shot is the one in git's index. The \`old commit\`
column names the commit that wrote it. The new baseline is the one in
the worktree. The commit that adds this directory holds it. The region
is the box around every changed pixel, as width×height at x,y.

${table}

## The verdicts

`,
);
const shown = out.startsWith(top) ? relative(top, join(out, 'index.html')) : join(out, 'index.html');
console.log(`visual-diff: ${shots.length} baselines → ${shown}; ${commitText}`);
for (const s of shots) console.log(`  ${s.scenario}/${s.shot}: ${s.isNew ? 'new' : `${s.n} px, region ${regionText(s)}`}`);
