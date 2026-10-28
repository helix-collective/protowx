# The regression suite

```sh
task web:regression                           # every scenario, on dist/
task web:regression -- crud                   # one scenario, by its name
task web:regression -- crud evaluate          # two scenarios
task web:regression -- --project connected    # one project
task web:regression -- --update-snapshots     # take the baselines again
task baselines -- <descr>                     # the configs, and the visual diff under docs/changes/
REGRESSION_URL=http://localhost:5173 task web:regression -- crud   # on task web:dev
```

A scenario drives the page and takes pictures. The suite compares each
picture with its baseline.
[docs/devtools/regression-scenario.md](../../docs/devtools/regression-scenario.md)
is how to write a scenario: the stub, the dev server loop and the
baselines. This page is the runner, the config, the step language and
the `server` field.

## The runner

| file                                        | holds                                                      |
|---------------------------------------------|------------------------------------------------------------|
| `scenarios/<name>.json`                     | one scenario: its steps                                    |
| `scenarios/<name>.json-snapshots/<server>/` | its baselines on one server, `<shot>-linux.png`            |
| `scenarios.spec.ts`                         | one test per scenario and server, which plays its steps    |
| `playwright.config.ts`                      | the local config: offline and connected, their servers     |
| `base.ts`                                   | what the configs share: viewport, threshold, reports       |
| `player.mjs`                                | the step player                                            |
| `visualDiff.mjs`                            | the visual diff that `task baselines` writes               |
| `results/`, `report/`                       | a run's failed shots and its HTML report; git ignores them |

`task web:regression` builds `dist/`, then runs `playwright test`. The
config starts two `bff` servers on `dist/`, and stops them after:

| project     | `bff`                                   | port   | workers |
|-------------|-----------------------------------------|--------|---------|
| `offline`   | `--api=false --bugs ''`                 | `8098` | 4       |
| `connected` | `--api --store <dir> --bugs <dir>/bugs` | `8099` | 1       |

Both have `--myw-url ''`, so a transcription service that runs on this
machine does not change the page. The connected project runs one
scenario at a time, because the engine behind `--api` is single-tenant.
Its directory is `protowx-regression` under the temporary directory,
emptied at each run, so each run starts from the three seeded
calculations. `REGRESSION_DIR` names another, to read the store or a
report after a run. The ports are fixed: run one suite at a time on a
machine.

A test's title is the scenario's title, its name in brackets, and its
server: `crud: ... [crud] offline`. A bare word after `--` that names a
file in `scenarios/` becomes a `--grep` for that name. Every other
argument goes to `playwright test` as it is.

**One scenario on the dev server.** `REGRESSION_URL` is the page of
the offline project. With it, the config starts no server and has no
connected project. Start `task web:dev` in a second shell first. Use
it while you write a scenario; the gate never sets it.

**A new baseline.** `-- --update-snapshots` writes each shot that
differs, and the run is green. Look at each new picture before the
commit. `task baselines -- <descr>`, from the repo root, does it and
then runs `visualDiff.mjs`, which compares each rewritten baseline
with the one in git's index and writes
`docs/changes/visual-diff/<descr>/index.html`. A new scenario's first
run has no baseline: Playwright writes it, and the run is red once, by
design. A baseline changes in the commit that changes the page.

**The report.** A red shot leaves `<shot>-actual.png`, `-expected.png`
and `-diff.png` under `results/`, with a trace. `report/index.html` is
the HTML report. Open it with `pnpm exec playwright show-report
regression/report`, from `web/`.

**A `todo` scenario** is skipped, with `todo: <string>` as the reason,
and its title starts with `todo:`.

**A `stack` scenario** is listed, and skipped with the task that plays
it, `task web:regression:stack`. The stack config comes in phase 6 of
the plan.

### Why `dist/`, and not the dev server

The gate plays the scenarios on `dist/`, because `dist/` is what
ships. A worker URL or a wasm asset path that the build gets wrong
does not show on the dev server. The dev server is offline only, so a
connected scenario cannot run there.

### Determinism

A shot is the same on each run, to the pixel, on this machine. These
rules keep it so:

- **The browser** is the flake's `playwright-driver.browsers`.
  `@playwright/test` and `playwright` are pinned to its version.
- **The viewport** is 1600 by 900, `deviceScaleFactor: 1`, with
  `reducedMotion: 'reduce'`.
- **No motion and no caret.** The spec adds a style that turns off
  every transition and animation and hides the caret.
- **The fonts.** The spec waits for `document.fonts.ready`, and for
  the first row of the calculation list, before the first step.
- **The settle.** The player waits for network idle and 250 ms after
  each step, and 400 ms more before a `shot`.
- **No hover.** Before a whole-page `shot`, the player moves the mouse
  to `(0, 0)`.
- **No clock and no path in a shot.** The offline page has its own
  wasm engine and memory store, and the connected server starts fresh
  for each run. The feedback dialog's summary counts the changes and
  the messages, not the seconds. A report's path holds the time, so a
  scenario checks the saved view with a `see`, and shoots the page
  after close.
- **The threshold** is `maxDiffPixels: 10`.
- **No retries.** A red scenario is red.

## The player

`player.mjs` plays the steps. It imports no Playwright module, so a
plain playwright script, such as one that takes the user manual's
screenshots, can share it. A new step kind goes in `player.mjs`, and
gets a row in the step table below.

```js
import { settle, play } from './player.mjs';

await play(page, steps, { shot, see });
```

## The steps

A step is a JSON object. One key names its kind, such as `click`. A
step with a selector can give `nth`, the index of the match, from 0.
The default is 0.

| step                                    | does                                                         |
|-----------------------------------------|--------------------------------------------------------------|
| `{ "click": "<css>" }`                  | clicks the match at `nth`                                    |
| `{ "dblclick": "<css>" }`               | double-clicks the match at `nth`                             |
| `{ "select": "<css>", "value": "v" }`   | picks the option `v` in the select at `nth`                  |
| `{ "hover": "<css>" }`                  | moves the mouse onto the match at `nth`                      |
| `{ "key": "Enter" }`                    | presses the key on the focused part                          |
| `{ "type": "<text>" }`                  | types the text, key by key, into the focused part            |
| `{ "type": "<text>", "into": "<css>" }` | clears the field at `nth`, and fills it in one input         |
| `{ "upload": "<css>", "file": "f" }`    | sets the file `f`, from `web/regression/`, on the file input |
| `{ "wait": 300 }`                       | waits 300 ms                                                 |
| `{ "wait": "<css>" }`                   | waits until the first match is visible; `nth` does not apply |
| `{ "see": "<css>", "count": 2 }`        | there are 2 matches; `nth` does not apply                    |
| `{ "see": "<css>", "text": "rent" }`    | the match at `nth` has the text `rent`                       |
| `{ "see": "<css>" }`                    | the match at `nth` is visible                                |
| `{ "shot": "<name>" }`                  | takes a picture of the whole page                            |
| `{ "shot": "<name>", "of": "<css>" }`   | takes a picture of the match of `of` at `nth`                |

**Example.** `scenarios/evaluate.json`, in part:

```json
{
  "title": "evaluate: a value, an evaluation error, and a parse error under the text",
  "server": ["offline", "connected"],
  "steps": [
    { "click": "[data-term=row]", "nth": 0 },
    { "click": "[data-term=evaluate]" },
    { "see": "[data-term=value]", "text": "8" },
    { "shot": "value", "of": "[data-term=result]" },
    { "shot": "end" }
  ]
}
```

A scenario has these fields beside `steps`: `title`; `url`, which is
`/?offline` for the offline server and `/` for any other when it is
absent; `server`; and `todo`, a string that skips the scenario. One
gesture to a scenario, five to fifteen steps where the plan allows.
Take a `shot` of a part, `of` its `data-term`, at the moment that
matters, and one whole-page `shot` at the end.

Name a part by its `data-term`, the slug of its glossary entry. A part
with no `data-term` gets one, and gets a glossary entry if it has none.

## The `server` field

The `server` field of a scenario names the engine the page runs on:
one server, or a list. A scenario with a list is played once on each,
and has its baselines in one directory for each.

| `server`    | the page runs against                                        |
|-------------|--------------------------------------------------------------|
| `offline`   | the default: `dist/` from `bff --api=false`, the wasm engine |
| `connected` | `dist/` from `bff --api`, the server's engine and file store |
| `stack`     | the stack of phase 6: the docker image of `bff`, with Jaeger |

Use `offline` when the wasm engine can play the scenario. Use
`connected` for a part that the offline page does not have, such as a
report saved through `bff`, and with `offline` where a scenario must
hold in both modes, as `crud` and `evaluate` do.
