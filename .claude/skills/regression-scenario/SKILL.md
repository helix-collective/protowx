---
name: regression-scenario
description: Write the steps of a regression scenario in protowx, web/regression/scenarios/<name>.json, and take its baselines. Use this whenever a prompt says "scenario", "regression test for", "a regression scenario", "write the steps", or "baseline for", whenever a run of task gate, task web:regression or task feature:refresh prints a todo: line or scenario: todo <name>, whenever the merge-features skill hands over a todo, and whenever a phase of a plan changes what the page shows and names a scenario — even when the prompt never says "skill", "Playwright" or "regression".
---

# regression-scenario: a todo stub to a green scenario and its baselines

This skill writes one scenario for an agent. A person reads the same
process, command first, in
`docs/devtools/regression-scenario.md`.
`web/regression/README.md` is the
step table and the runner.

**The rule.** You write the steps, play them, and take the first
baselines of a new scenario. The person looks at each shot and says
commit. You never commit a baseline that you took.

## Before you start

- **Say the size.** One scenario of one gesture takes 20 to 40
  minutes: 10 to read, 10 to draft, and a few runs.
- **Run each long command with a 10-minute timeout.** `task
  web:regression` builds `dist/` first, about 10 s, then plays.
- **Run one suite at a time on the machine.** The ports `8096` to
  `8099` are fixed. Do not play a scenario while a gate runs.
- **Use an absolute path in each command.** The Bash tool resets the
  working directory between calls.

## The steps

### 1. Find the stub

```sh
ls web/regression/scenarios/ && grep -l '"todo"' web/regression/scenarios/*.json
```

A `todo` stub is a scenario with a `todo` string and no steps. `task
feature:new` writes one named for the branch. A run prints it as a
skipped test whose title starts `todo:`:

```text
  -  1 [offline] › regression/scenarios.spec.ts:45:9 › todo: crud [crud] offline @offline
```

`task feature:refresh` prints `scenario: todo <branch>` for it. With
no stub, write one; the command refuses to overwrite a scenario:

```sh
task feature:scenario -- <name>
```

Repeat the request back in one sentence: "Write `<name>.json`: one
gesture, `<the gesture>`, on the page."

### 2. Read

Read these, in this order:

1. The feature's `docs/features/NNN-<name>/plan.md`: the **Done when**
   of the phase that changed the page. Its first bullet is the
   scenario's first `see`.
2. The user manual page for the same part: a guide in
   `docs/product/user_manual/guides/`. The guide's numbered steps are
   the scenario's steps.
3. The glossary entry, `docs/glossary.md`, of each part the gesture
   touches. The entry's name in kebab-case is the part's slug.
4. One scenario of the same shape as a model. `crud.json` fills the
   form and saves; `evaluate.json` is a click and a result;
   `report.json` is a dialog.

Pick **one gesture**. When the plan has more than one, write one
scenario now, and name the others for a second stub.

### 3. Find the parts

```sh
grep -rn 'data-term="<slug>"' web/packages web/apps --include='*.tsx'
```

A `see`, a `click` and a `shot` name a part by `[data-term=<slug>]`.
A part with no `data-term`:

- **No glossary entry.** Write the entry first, in STE, in the
  glossary section of its neighbours. A new part on screen also gets
  its `theme.css` tokens; an old part with a new mark does not.
- **Then the mark.** Add `data-term="<slug>"` on the element that draws
  the part, beside its other `data-*` attributes. A mark moves nothing,
  so "Controls stay put" needs no new row.

A detail inside a part, such as a button's state, takes an attribute
selector under the part: `[data-term=calculation-list] [aria-current=true]`.

### 4. Draft the steps

Write the steps into the stub, and delete the `todo` key. The stub's
title is its file name; write a title that says the gesture. The
shape:

```json
{
  "title": "<the part>: <the gesture>, <what it shows>",
  "steps": [
    { "see": "<the state before>" },
    { "click": "<the gesture>" },
    { "see": "<the state after>", "count": 2 },
    { "shot": "<the moment>", "of": "[data-term=<the part>]" },
    { "shot": "end" }
  ]
}
```

- **Five to fifteen steps.** A `see` before the gesture and one after
  it. A `see` is cheap and says what broke; a `shot` says only that a
  picture changed. `"count": 0` checks that a part is gone.
- **`nth` picks one of several matches**, from 0, on a `click`, a
  `see` with `text`, and a `shot` with `of`. `"nth": 1` on a row of the
  calculation list picks the second calculation.
- **A `shot` of a part, `of` its `data-term`,** at the moment that
  matters, and one whole-page `shot` named `end` as the last step.
- **`server`.** Leave it out for `offline`. Set `connected` or
  `stack` only for a part that offline mode does not have; the
  README's "The `server` field" says which.
- **A `type` step leaves a caret.** Follow it by a `key` or a `click`
  that blurs the field before a `shot`.

### 5. Play it on the dev server

```sh
setsid task web:dev > /tmp/web-dev.log 2>&1 &
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5173/
REGRESSION_URL=http://localhost:5173 task web:regression -- <name> > /tmp/rs.log 2>&1
```

Start the dev server in its own session, in the background. It
rebuilds the wasm first; warm, it answers `200` in a few seconds. When
the port is taken, a person's dev server runs: ask before you use it.
Then play the scenario.

- **A `see` that fails stops the run at that step.** The error names
  the selector and what it found. Fix the step or the mark, and play
  again.
- **A `shot` with no baseline does not stop the run.** Each one prints
  `A snapshot doesn't exist at ..., writing actual.`, and the run is
  red at its end. Playwright writes the picture to
  `web/regression/scenarios/<name>.json-snapshots/<server>/<shot>-linux.png`
  and to `results/`.
- **The second run is green** when the steps are right: the baselines
  of the first run are there now. Green on the second run is the end
  of this step.

Stop the dev server by its session, and no other process:

```sh
pgrep -af 'task web:dev'          # the PID of your task web:dev
kill -INT -- -<that PID>          # setsid made it the session's leader
```

Do not run `pkill vite`. It stops a dev server of the person too.

### 6. Take the baselines on `dist/`

```sh
task web:regression -- <name> --update-snapshots=all
task web:regression -- <name>
```

The baselines of step 5 are the dev server's pictures. The first
command takes each shot again from `dist/`, which ships. Give `=all`:
a bare `--update-snapshots` is `changed`, and keeps a dev server
picture that is within the threshold. The second command must be
green. Give your scenario's name in both; see the Traps.

The two servers draw the same bytes for each shot. A difference here
is a fault of the build: read the diff, and tell the person.

### 7. Show each shot

Open each new baseline with the Read tool: Read shows a PNG as an
image. Check that it shows what the guide says, not only what the
steps asked. Then write one line for each, in the format of the
merge-features pre-screen:

```text
crud/saved: new — the form after save: the name, the text and one binding
crud/end: new — the whole page: the new row in the calculation list, marked as open
```

### 8. Stop and ask

Show the person the lines and the scenario's steps. Ask, in these
words:

> The scenario `<name>` is green, with N baselines; look at them, and
> say commit.

Wait. "Commit" in the person's message is the signal. Then stage the
scenario, its baselines, and each mark and glossary entry you added.

When the merge-features skill sent you here, go back to its step 2
after the commit. `task feature:refresh` reads the scenario from the
commit, `HEAD`, so it prints `scenario: todo <branch>` until the
commit is made.

## Traps

- **Never commit a baseline without the person.** A wrong baseline
  hides a regression for good. The person looks at each shot first.
- **Update your new scenario's baselines only.** Give its name to each
  `--update-snapshots`. A changed baseline of another scenario is the
  person's to accept, through the merge-features pre-screen.
- **Do not reuse a stub's name for a second gesture.** `task
  feature:scenario` refuses to overwrite a scenario; give the second
  one a name of its own.
- **One gesture to a scenario.** A long scenario fails at its first
  broken step and says nothing about the rest. Write a second stub for
  a second gesture.
- **No `shot` of a transcript or a trace id.** They are not the same
  on two runs. In a `stack` scenario, `see` the trace line, and shoot
  a part that does not hold the id.
- **Do not raise the threshold.** A shot that differs on two runs with
  no change has a cause: a caret, a hover, a clock, an animation.
  Find it, or take a `shot` of a smaller part.
