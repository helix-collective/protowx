# web

The repo-wide rules are in the root `AGENTS.md`. This file covers the
page and its packages: a pnpm workspace of two packages, one app and
the regression suite. [docs/glossary.md](../docs/glossary.md) names
the parts on screen; use those words in code, comments and commit
messages. `docs/features/001-calculator/prd.md` section 4 is the
design.

| directory                       | role                                                                 |
|---------------------------------|----------------------------------------------------------------------|
| `spec/api.adl`                  | the protocol between the page and the engine                         |
| `engine/wasm/main.go`           | the `js/wasm` entry: `calcRequest` on the global                     |
| `services/bff/engine.go`        | the same engine behind `POST /api/calc`                              |
| `web/packages/client/`          | the worker, the HTTP transport, the factory, the log, `engine.ts`    |
| `web/packages/client/src/adl/`  | generated from `spec/*.adl` by `task calc:adl-ts`; tracked           |
| `web/packages/client/wasm/`     | `calc.wasm` and `wasm_exec.js`, from `task calc:wasm`; git ignores   |
| `web/packages/ui/`              | the Solid components: the bar, the list, the form, the result        |
| `web/packages/ui/src/theme.css` | every size, colour and face, grouped by the glossary                 |
| `web/packages/ui/src/ui.css`    | the shapes of the parts; it reads `theme.css` for every value        |
| `web/apps/app/`                 | the Vite app: the page, the mode, the feedback report, the dictation |
| `web/regression/`               | the Playwright suite, the scenarios and their baselines              |

- Never hand-edit `packages/client/src/adl/`. Change the `.adl` file
  in `spec/` and run both generators, `task calc:goadlc` and `task
  calc:adl-ts`. `packages/client/wasm/` is a build output.
- Any Go change under `engine/` means `task calc:wasm`. `task web:gen`
  runs both generators, and `test`, `dev` and `build` run it first.
- Every visual literal is a custom property in `theme.css`, grouped
  by the glossary. A new part gets a glossary entry and its tokens in
  the same commit. Text is 4.5 to 1 or more against its fill.
- The page picks its engine at load: `readEngineConfig` in
  `apps/app/src/engineConfig.ts`, from the URL and `GET /api/config`,
  then `createEngine` in `packages/client/src/factory.ts`. The two
  modes differ in a `Transport` and nothing else. A component that
  needs to know its mode means the seam is in the wrong place.
- A component is controlled. It takes its values as props and says a
  change by a callback; the app holds the state. So a component test
  mounts it with a signal, and `controlsStayPut.browser.tsx` mounts
  the whole page with a fake engine.

The root `AGENTS.md`, "Keep the cognitive load low", holds for every
part of the page. Each control has a visible word, each message sits
by its part, and no gesture asks the user to recall an id.

## The tests

| package       | runs in                    | what                                       |
|---------------|----------------------------|--------------------------------------------|
| `client`      | node, against the wasm     | each request; each case of the evaluator   |
| `ui`          | a browser, `*.browser.tsx` | one test per component; controls stay put  |
| `app`         | node                       | the mode, the config, the report, the sink |
| `regression/` | Playwright, on `dist/`     | the scenarios and their baselines          |

`task web:test` runs the first three, `task web:regression` the last.
The browser is the flake's `playwright-driver.browsers`; the npm
`playwright` and `@playwright/test` are pinned to its version.

## Controls stay put

A click that changes the page does not move the control it was made
on. It does not move any other control that stays on screen either. A
control is a button, a checkbox, a select, an input or a clickable
row. The test is the user's: click, see the change, and click the
same pixel again, with no move of the mouse and no search.

Text that changes is the usual cause. Six ways keep the rule:

- **Give a label that changes a fixed width.** Make it a token in
  `theme.css`, wide enough for the longest value. **record**, which
  reads `stop · 2 changes` while a recording runs, is
  `--pw-record-width`; the mode is `--pw-mode-width`.
- **Keep the place of a message that comes and goes.** The parse
  error, the store error and the printed expression each have a fixed
  height, and are there when they are empty.
- **Keep the space of a part that hides.** A hidden notes text area
  keeps its place, so star and the buttons under it stay put.
- **Scroll a growing list inside a fixed height.** The bindings scroll
  in `--pw-bindings-height`, and **add** is below the scroller. The
  screenshot list of the feedback dialog does the same.
- **Show a state in colour, never in size.** The open row changes its
  fill and its text colour; its padding and its weight stay.
- **Put a control that comes and goes out of the flow.** **dictate**
  is drawn only when the server names My Whisper. It sits right of the
  form's width, positioned on the text's line, so drawn or not it
  moves nothing. Its words change in `--pw-dictate-width`.

The feedback dialog sits at a fixed place from the top, not in the
middle, so a change of its height moves none of its controls.

Two exceptions:

- A control that the click removes or adds is not held to the rule.
  The controls that stay on screen are. Submit turns the dialog's
  actions into the saved view, and a new row is added after the last
  row.
- A remove closes the gap it leaves. The bindings' `×` and **delete**
  move the rows after the removed one up, and nothing else. The row is
  the control the click removes.

`packages/ui/test/controlsStayPut.browser.tsx` enforces the rule. It is
a table: one row is a sequence of steps. Before each step it measures
every control, it clicks, fills or picks at the control, and it
measures again. A box that moved more than half a pixel fails the row,
with the control named. It mounts the whole page in the app's grid,
`apps/app/src/app.css`, with a fake engine, and the feedback dialog
on its own. Each control of `docs/features/001-calculator/prd.md`
section 4.2 has a row: **record** and stop, **new**, a row, the name
and the text, **dictate** and stop, **add** and **remove**, the base,
the notes, the star, **evaluate**, **save** and **delete**, and the
dialog's type, kind, option, screenshot `×`, Escape and submit. Add a row when you add a
control, or a gesture on one.

## Arrow keys are inverses

The root `AGENTS.md` states the rule: an arrow, then its opposite,
lands where the first was pressed. The page binds no arrow key of its
own today. A field and a select keep the browser's keys, which keep
the rule. The first arrow key the page binds gets its opposite in the
same commit, and a test that presses the pair from every start.

Two ways keep the rule:

- **Pair a place with a place, not a place with a step.** A key that
  goes to the next row pairs with a key that comes back to the same
  row, not to the first one.
- **Keep the focus with the selection.** A key that moves the
  selection to another part moves the focus there too, so the
  opposite key is read by the part that can come back.

One exception: **a refused move.** `Up` on the first row stays. The
first key did nothing, so there is nothing to undo.
