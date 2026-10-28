# Writing a regression scenario

## TL;DR

```sh
task feature:scenario -- <name>                                    # the todo stub
setsid task web:dev > /tmp/web-dev.log 2>&1 &                      # the dev server
REGRESSION_URL=http://localhost:5173 task web:regression -- <name> # play on it
task web:regression -- <name> --update-snapshots=all               # baselines on dist/
task web:regression -- <name>                                      # green
```

A scenario is a JSON file, `web/regression/scenarios/<name>.json`. It
drives the page through one gesture and takes shots. The gate plays
every scenario, and compares each shot with its baseline. This page is
how you write one. [web/regression/README.md](../../web/regression/README.md)
is the runner and the step table, "The steps".
[feature-workflow.md](feature-workflow.md), section 4, is where a
scenario sits in the loop of a feature.

## 1. The stub

`task feature:new` writes a stub for the new branch. `task
feature:scenario -- <name>` writes one by hand: for a feature that is
older than `feature:new`, or for a second gesture. It does not
overwrite a scenario. A stub has a `todo` string and no steps:

```json
{
  "title": "crud",
  "todo": "write the steps; see web/regression/README.md",
  "steps": []
}
```

**How a `todo` shows in a run.** Each run skips the stub, and lists it
as a skipped test whose title starts `todo:`:

```text
  -  1 [offline] › regression/scenarios.spec.ts:45:9 › todo: crud [crud] offline @offline

  1 skipped
```

`task gate` prints the same line. `task feature:refresh` also prints
`scenario: todo <branch>`, and `task feature:finish` refuses the
branch until the stub has steps, or until you give `--no-scenario
"<reason>"`.

## 2. The steps

Read the feature's `plan.md`, the **Done when** of the phase that
changed the page. Read the user manual guide for the same part. The
guide's numbered steps are the scenario's steps. Then write the steps
into the stub, and delete the `todo` key.

This is one gesture, a new calculation, in the shape of
`web/regression/scenarios/crud.json`. The parts are those of
`docs/glossary.md`:

```json
{
  "title": "crud: a new calculation, saved, is a row of the list",
  "steps": [
    { "see": "[data-term=row]", "count": 3 },
    { "click": "[data-term=new]" },
    { "type": "rent", "into": "[data-term=form] [name=name]" },
    { "type": "a * 12", "into": "[data-term=form] [name=text]" },
    { "click": "[data-term=save]" },
    { "see": "[data-term=row]", "count": 4 },
    { "see": "[data-term=row]", "nth": 3, "text": "rent" },
    { "shot": "saved", "of": "[data-term=form]" },
    { "shot": "end" }
  ]
}
```

- **One gesture, five to fifteen steps.** Write a second stub for a
  second gesture.
- **A `see` before the gesture, and one after it.** A red `see` names
  the part that broke.
- **A `shot` of a part, `of` its `data-term`,** and one whole-page
  `shot`, `end`, as the last step.
- **Name a part by its `data-term`,** the slug of its glossary entry.
  A part with no `data-term` gets one. A part with no glossary entry
  gets the entry first, in `docs/glossary.md`.

## 3. The dev server loop

Play the scenario on `task web:dev` while you write it. The dev server
picks up a change to the page at once, and `dist/` does not need a
build for each try.

1. Start the dev server in its own session: `setsid task web:dev >
   /tmp/web-dev.log 2>&1 &`. It answers on `localhost:5173`.
2. Play: `REGRESSION_URL=http://localhost:5173 task web:regression --
   <name>`. With `REGRESSION_URL`, the config starts no `bff`, and has
   no connected project.
3. The first run is red. Each shot prints `A snapshot doesn't exist at
   ..., writing actual.`, and Playwright writes it as a baseline. A red
   `see` stops the run at its step. Fix the step, and play again.
4. The second run is green when the steps are right.
5. Stop the dev server: `kill -INT -- -<PID>`, with the PID of `task
   web:dev` from `pgrep -af 'task web:dev'`.

## 4. The baselines

The baselines of the loop are the dev server's pictures. Take them
again from `dist/`, which is what ships:

```sh
task web:regression -- <name> --update-snapshots=all
task web:regression -- <name>
```

Give `=all`. A bare `--update-snapshots` updates a shot only when it
differs by more than the threshold, so it can keep a dev server
picture. The second command must be green. The baselines are
`web/regression/scenarios/<name>.json-snapshots/<server>/<shot>-linux.png`.

Look at each baseline before the commit. It must show what the guide
says. Commit the scenario, its baselines, and each `data-term` and
glossary entry you added, in one commit.

## 5. With an agent

The `regression-scenario` skill,
[.claude/skills/regression-scenario/SKILL.md](../../.claude/skills/regression-scenario/SKILL.md),
does sections 1 to 4. An agent invokes it for "scenario", "regression
test for", a `todo:` line in a run, or when the `merge-features` skill
meets `scenario: todo <branch>`. It ends with one line per shot, on
what the shot frames, and it asks you to say commit. It never commits
a baseline that it took.

## 6. Gotchas

- **A first run with no baseline writes one.** Playwright's default
  writes a missing baseline into `scenarios/`, as an untracked file,
  and the run is red once. The next run is green on that file. A gate
  on a branch does the same; `task feature:finish` plays the committed
  tree, so it stays red until the baselines are committed.
- **A `type` step leaves a caret.** Follow it with a `key` or a
  `click` before a `shot`.
- **No `shot` of a transcript or a trace id.** They differ on each
  run. A `stack` scenario checks the trace line with a `see`.
- **Run one suite at a time.** The suite's ports are fixed. A
  scenario played on `dist/` while a gate runs is red, and so is the
  gate.
- **Do not stop a dev server by name.** `pkill vite` stops every dev
  server on the machine, a person's too. Stop yours by its PID.

## Experiences

None in this repository yet. Add one, with a date and a name, when a
scenario surprises you.
