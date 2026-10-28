# calculator: implementation plan

The checklist for [prd.md](prd.md), one bullet per change, in the
order the changes landed. That document is the argument; this one is
the work. A bullet is ticked in the commit that lands it. Section
numbers in brackets point into `prd.md`. A bullet that says
`workspace:` is a change in `~/devel/protowx-workspace`, the
workspace that holds this repository. Much of the starter was copied
from a larger application, here called the source. A bullet that says
"copied" names a file that came from there, with the paths changed.
The phase numbers are the ones the commits name.

## Legend

- `[ ]` not started
- `[~]` in progress — the bullet says what is missing
- `[x]` done and tested

## Before starting

- [x] Read [prd.md](prd.md) and [../../kb/go-style.md](../../kb/go-style.md).
- [x] Read ohm-go's `examples/generic-methods/`: `arith.ohm`,
      `arith.go` and `arith_test.go`. The grammar and the two visitors
      are taken from there.

## Phase 1 — the skeleton

- [x] The shell, the hooks, the tasks and the docs, with no code:
      `flake.nix`, `.envrc`, `prek.toml`, `Taskfile.yml`, `go.work`
      and the four empty modules, `AGENTS.md`, `docs/`. The commit
      `protowx: the skeleton`.

### Done when

- [x] `direnv allow` enters the shell, `task --list-all` lists the
      tasks, and `prek run --all-files` is green.

### Documentation

- [x] `README.md`: the name, what it is, `direnv allow`, `task
      web:dev`.

## Phase 2 — the grammar and the AST [1.2, 1.3]

- [x] **grammar:** `spec/calc.ohm`, the rules of PRD section 1.2, as
      quoted: ohm-go's `arith.ohm`, renamed. The rule "the grammar is
      the specification" is met by the PRD; a change to what the PRD
      quotes is discussed first.
      Written as quoted; it compiled with no change.
- [x] `engine/go.mod`: the `tool` lines for `goadlc` and `ohm-cli`;
      `ohm` and `adl` as requirements.
      `ohm` and `ohm-cli` at `v1.1.0`: `MatchResult.Err` gives a parse
      error's line and column. `go.sum` from `GOWORK=off go mod tidy`.
- [x] `engine/adl.cfg.json`: copied, reading `../spec` and writing
      `types/`.
- [x] `spec/calc.adl`: the types of PRD section 1.3.
      The branch `var` is `variable`: goadlc writes a branch name as a
      Go parameter, and `var` does not compile. PRD section 1.3
      follows.
- [x] `engine/Taskfile.calc.yml`: `goadlc`, `adl-ts`, `wasm`,
      `ohm2wasm`, `gen_visitor`, `test`, `grammar-test`, each reading
      `../spec/`. `ohm2wasm` moves `calc.wasm` to `engine/grammar/`.
      `adl-ts` writes `web/packages/client/src/adl/`.
      `adl-ts` and `wasm` are written, not run: `web/` and
      `engine/wasm/` are phase 3's and phase 4's.
- [x] `engine/grammar/grammar.go`, `engine/grammar/calc.wasm`: the
      embed, and the output of `task calc:ohm2wasm`. Check that `Exp`
      is a function; add the description if it is not [1.2].
      `Exp` is a function: it is the first rule, the default start
      rule. `grammar_test.go` checks it; no description was added.
- [x] `engine/visitor/`: the output of `task calc:gen_visitor`.
- [x] `engine/types/calc/`: the output of `task calc:goadlc`.
- [x] `engine/ast/build.go`: the visitor from the parse tree to
      `calc.Exp`, in the shape of the example's evaluator.
- [x] `engine/ast/printer.go`: `Exp` back to text, fully
      parenthesised, as the example's printer.
- [x] `engine/ast/build_test.go`: the example's cases; text to AST to
      text; a parse error's line and column.
      `ohm` 1.1.0 gives `match failed` in place of the expected tokens
      after a complete operand, `(1 + 2`: `recordFailures` overflows
      the wasm stack. The line and the column are right.
- [x] `spec/ohm-cli/tests/calc.txtar`: the example's cases and one
      per operator, as fixtures with their parse trees.
      And two `error` members, `1 +` and `(1 + 2`.
- [x] Not planned: `flake.nix` pins the `ohm-go` input at the tag
      `ohm-cli/v1.1.0`, `39a1186`, with its `vendorHash`. The `main`
      of `ohm-go` is `d905d0e`, so `task nix:update-ohm-cli` alone
      moved nothing, and `OHM_GO_DEV` fails a lone clone. The task's
      `desc`, `nix-custom-dev-tools.md` and `grammar-tests.md` follow.
- [x] Not planned: `workspace:` the `ohm-go` submodule moves from
      `9286319` to `39a1186`, so the workspace builds against the
      `ohm` that `engine/go.mod` requires.

### Done when

- [x] `task calc:test` and `task calc:grammar-test` are green.
- [x] `ast.Parse` of `(x + 3) * y - 10 / 2` printed is
      `(((x + 3) * y) - (10 / 2))`. `TestPrint` holds the case.
- [x] A lone clone in `/tmp`, `GOWORK` unset: `go build ./...` and
      `go test ./...` in `engine/` resolve `ohm` `v1.1.0` and `adl`
      `v1.1.1` from the proxy, and pass. Both generators write the
      files as committed.

### Documentation

- [x] `engine/AGENTS.md`: the table of directories; the generated
      directories that are never hand-edited; the grammar rule; the
      start rule check.
      And "Parse errors", and `CLAUDE.md` beside it.
- [x] `spec/README.md`: what each file is, and which task reads it.
      Three rows at first: `calc.ohm`, `calc.adl` and the fixtures.
      Phase 3 adds `model.adl` and `api.adl`.

## Phase 3 — the evaluator, the engine and the server [1.4, 2, 3, 6]

- [x] `spec/model.adl`, `spec/api.adl`: the types of PRD sections 2.1
      and 2.2.
      Each imports `sys.types.Maybe`, and the default of `notes` is
      `"nothing"`: adlc parses neither a bare `Maybe` nor a bare
      `nothing`. PRD sections 2.1 and 2.2 follow. No field is a Go
      keyword.
- [x] `engine/types/model/`, `engine/types/api/`: the output of `task
      calc:goadlc`.
- [x] `engine/eval/eval.go`: `Eval(exp, env)`; the three errors of
      PRD section 1.4, the divisor printed.
      Each error wraps a sentinel. The message prints each operand,
      not the parenthesised node: `division by zero: 10 / 0`.
- [x] `engine/eval/eval_test.go`: the example's cases; precedence;
      each error.
      And the `Int64` edges: the overflow of each operator.
- [x] `engine/store/store.go`: the `Storage` interface; `MemoryStore`,
      seeded with the three calculations of PRD section 2.3.
      `Seed()` is exported: `bff`'s file store starts from it when
      its file is missing.
- [x] `engine/engine/engine.go`: `New(grammar, storage)`; `Handle`
      over `api.Request`; `HandleJSON`; the single-threaded note.
      `New` loads the store and returns an error too. The engine takes
      a change only when `Save` succeeds. A new id is one more than
      the largest decimal id.
- [x] `engine/engine/engine_test.go`: each request; a `put` with an
      empty id makes one; a `delete` of an unknown id is an `error`;
      an `evaluate` with a missing binding is `unknown variable`.
      And a `Save` that fails, and the wire format.
- [x] `engine/wasm/main.go`: the `js/wasm` entry, `calcRequest` on the
      global, the memory store.
      `task calc:wasm` builds it; a run under node answered an
      `evaluate` and a `list`.
- [x] `clis/go.mod`: `opts`; `engine` through `go.work`.
- [x] `clis/calc/main.go`: the opts CLI: an expression on standard
      input, `-b x=5` per binding, the value and the printed form on
      standard output.
      It calls `ast` and `eval`, with no store. `main_test.go` drives
      `run`.
- [x] `services/bff/go.mod`: `opts`; `engine` through `go.work`.
- [x] `services/bff/main.go`: the flags of PRD section 3, with the
      `go-cli` skill; no `--tailnet`.
      Without `--otlp-url` and `--trace-view-url`: they come with
      `traces.go` in phase 6. `--open` takes a path, so `bff:offline`
      opens `/?offline`; PRD section 3 follows.
- [x] `services/bff/server.go`, `browser.go`: copied, as they are.
- [x] `services/bff/engine.go`: `POST /api/calc`, one engine, one
      mutex, the file store.
- [x] `services/bff/store.go`: `FileStore` over `--store`; `Load` at
      start; `Save` whole on each write.
      A missing file is the seeded store. A save writes a temporary
      file and renames it. PRD section 2.3 now says the first.
- [x] `services/bff/bugreport.go`: copied: the route, `/screenshot`,
      `/audio`, `slug`, the files under `--bugs`.
      Without the recording file, the study tag, `--repo` and the
      `GET` list: the report is one Markdown file.
- [x] `services/bff/config.go`: `GET /api/config`: My Whisper's URL,
      `--bugs`, and whether `--api` is on; `traces` comes in phase 6.
      `{"myw": "", "bugs": true, "api": true}`. The `myw` field is
      phase 5's config bullet, landed early.
- [x] `services/bff/myw.go`: `--myw-url`, and nothing else.
- [x] `services/bff/Taskfile.bff.yml`: `build`, `serve`, `offline`,
      `connected`, `test`.
      `serve`, `offline` and `connected` depend on `:web:build`, which
      phase 4 writes; they do not run before it.
- [x] `services/bff/engine_test.go`, `store_test.go`,
      `bugreport_test.go`: a `put` reaches the file; a second `bff` on
      the same file reads it back; a report lands under `--bugs` with
      its screenshot.
      And `server_test.go`: the fallback, the config, the routes that
      `--api=false` and `--bugs=` turn off.
- [x] Not planned: `Taskfile.yml`: `task test` depends on `calc:test`
      and `bff:test` alone. A dep on `web:test` or `myw:test`, which
      do not exist yet, fails the run. Phases 4 and 5 add them back.
- [x] Not planned: `docs/architecture/AGENTS.md`, `CLAUDE.md`, and a
      row in `docs/README.md`: the directory is new.

### Done when

- [x] `echo '(x + 3) * y' | go run ./clis/calc -b x=5 -b y=1`
      prints `8` and `((x + 3) * y)`.
- [x] `task test` is green: `engine`, `bff`, and no web yet.
- [x] Not planned: a lone clone in `/tmp`, `GOWORK` unset: `go build`
      and `go test` pass in `engine/`, `clis/` and `services/bff/`.
      The clone's own `go.work` names `./engine`, so `clis` and `bff`
      find it; `ohm` `v1.1.0` and `adl` `v1.1.1` come from the proxy.
      In `clis/`, `go build ./...` alone refuses to write the binary
      over the directory `calc/`; `-o /dev/null` builds it.

### Documentation

- [x] `docs/architecture/engine.md`: the map of `engine/`: the grammar
      to the AST, the AST to the value, the store, the two entries.
- [x] `services/bff/AGENTS.md`: the table of files; the single-tenant
      rule; the report route's rules.
      And `CLAUDE.md` beside it. `engine/AGENTS.md` gains the new
      packages and "The engine"; `spec/README.md` gains `model.adl`
      and `api.adl`.

## Phase 4 — the page [4, 6]

- [x] `web/package.json`, `web/pnpm-workspace.yaml`,
      `web/tsconfig.base.json`, `web/vitest.config.ts`: copied, with
      the catalog kept and the members `packages/*`, `apps/*`.
- [x] `web/Taskfile.web.yml`: `install`, `gen`, `test`, `typecheck`,
      `dev`, `build`, `regression`, `audit`; `regression:stack` comes
      in phase 6. `gen` runs `calc:adl-ts` and `calc:wasm`.
      And the internal `playwright`, which turns a scenario's name into
      a `--grep`.
- [x] `web/packages/client/`: the copied engine client's `factory.ts`,
      `worker.ts`, `workerEngine.ts`, `http.ts`, `log.ts` and
      `index.ts`, with the names changed; `engine.ts` with one method
      per request; `src/adl/` from `task calc:adl-ts`.
      And `direct.ts`, `timing.ts`, `protocol.ts` (the ADL JSON
      bindings) and `calculation.ts` (a new record, a value in its
      base). `task calc:adl-ts` named the `.adl` files without their
      path from `engine/`, and adlc found none; it names
      `../spec/*.adl` now. prek leaves the generated `src/adl/` alone:
      a hook's fix showed in the gate's clean tree check.
- [x] `web/packages/client/test/engine.test.ts`: a `put` then a
      `list`; an `evaluate` of each case of PRD section 1.4, against
      the real wasm.
      And an update, a delete, a parse error's `at`, the wire format,
      the log, and `formatValue`.
- [x] `web/packages/ui/src/theme.css`: the tokens of the parts,
      grouped by the glossary.
      `--pw-*`; `ui.css` beside it holds the shapes and reads the
      tokens.
- [x] `web/packages/ui/src/CalculationList.tsx`: the rows, **new**,
      the open row's colour.
      And the store error at the foot, in a fixed height.
- [x] `web/packages/ui/src/CalculationForm.tsx`: the fields of
      `model.Calculation`; **save**, **delete**, **evaluate**; the
      parse error under the text, at its column.
      Enter evaluates. A hidden notes text area keeps its place.
- [x] `web/packages/ui/src/Bindings.tsx`: the bindings table: a name
      and a value per row, the **add** row, a click to remove one.
      The rows scroll in a fixed height; the `×` is **remove**.
- [x] `web/packages/ui/src/Result.tsx`: the value in the record's
      base, the printed form under it, or the error.
- [x] `web/packages/ui/src/BugReportDialog.tsx`, `StatusLine.tsx`:
      copied, with the source's own slots gone.
      Also gone: the narration line and the transcript, the
      screenshot editor, the tutorial kind, the experiment switch. The
      dialog takes a `SavedView`, and its words are in
      `ui/src/feedback.ts`, so `ui` imports nothing of the app. It
      sits at a fixed place from the top. The kinds are `general`,
      `ui`, `engine` and `prompt`.
- [x] `web/packages/ui/test/*.browser.tsx`: one test per component, in
      browser mode.
      `ui/vitest.config.ts` is the browser config; the package has no
      jsdom project.
- [x] `web/packages/ui/test/controlsStayPut.browser.tsx`: the copied
      shape, with a row per control of PRD section 4.2.
      It mounts the whole page in `app.css`'s grid with a fake engine,
      and the dialog on its own: 15 rows. It found two moves, fixed:
      the printed expression had no height when empty, and the dialog
      sat in the middle, so submit moved every control in it.
- [x] `web/apps/app/src/main.tsx`, `App.tsx`, `app.css`: the bar and
      the three parts; the mode from the URL and `GET /api/config`;
      the status line, with `offline: changes are kept until reload`.
      The bar is `ui/src/Bar.tsx`, so controlsStayPut mounts it.
- [x] `web/apps/app/src/bugReport.ts`, `recorder.ts`, `recording.ts`,
      `reportSink.ts`, `screenshot.ts`: copied, recording the `Store`
      at the start and each message after it [6].
      And the `Store` and the form at the end. `recorder.ts` is the
      running recording's glue: the log's tap and the window's errors.
      A recording holds every message whole. The report: the store at
      both ends as `bff --store` writes it, the replay of each `put`
      and `delete`, the answers, the form, the errors, the messages,
      the reading list.
- [x] `web/apps/app/src/engineConfig.ts`, `serverConfig.ts`: copied,
      cut.
      With neither `?offline` nor `?api=`, `api` in the config picks
      the mode. `?myw=` overrides the config's URL.
- [x] `web/apps/app/index.html`, `vite.config.ts`, `tsconfig.json`,
      `vitest.config.ts`: copied, with the names changed.
      No `vitest.browser.config.ts`: the app's tests run in node, and
      the components' in `ui`.
- [x] `web/regression/`: `base.ts`, `player.mjs`, `scenarios.spec.ts`
      and `playwright.config.ts`, copied, with `bff`'s flags of PRD
      section 4.3.
      And `visualDiff.mjs` and `README.md`. A scenario's `server` is
      one server or a list; each server has its baselines under
      `<name>.json-snapshots/<server>/`. The connected store and
      reports are under the temporary directory, or `REGRESSION_DIR`.
      PRD section 4.3 follows.
- [x] `web/regression/scenarios/crud.json`: new, fill the form, save,
      the row appears; open it, change the name, save; delete, the row
      goes. Its baselines, both projects.
- [x] `web/regression/scenarios/evaluate.json`: new, open the first
      seeded calculation, evaluate, the value and the printed form;
      open the third, evaluate, the division error; break the text,
      evaluate, the error under the text. Its baselines, both
      projects.
- [x] `web/regression/scenarios/report.json`: new, record, save a
      calculation, stop, the dialog, send; the report is under
      `--bugs` and names the `put`. Its baselines, the connected
      project.
      The scenario sees the saved view; the file's path holds the
      time, so no shot. The report was read under `REGRESSION_DIR`:
      its replay is the `put`. `app/test/bugReport.test.ts` holds the
      same check.
- [x] `web/AGENTS.md`: the table of packages; "Controls stay put" cut
      to the starter's controls.
      And "Arrow keys are inverses": the page binds no arrow key yet.
- [x] Not planned: `Taskfile.yml`: `task test` runs `web:test`; the
      gate's stack step and `task baselines`' stack run are comments
      until phase 6.
- [x] Not planned: `docs/changes/AGENTS.md` and
      `visual-diff/phase-4-first-baselines/`, with a verdict per shot;
      the baseline path in the root `AGENTS.md`, the
      `regression-scenario` skill and its page; a "Docs that quote the
      code" row for `readingList`; `.bugreports/AGENTS.md` to the
      report as written.

### Done when

- [x] `task web:dev` opens the page offline, with the three seeded
      calculations, and an evaluate shows the value.
      "the example" evaluates to `8`, `((x + 3) * y)`.
- [x] `task bff:connected` opens the page connected, a save reaches
      `calculations.json`, and a reload shows it.
      Checked with the same flags on another port and store: the mode
      `connected`, the store file holds "rent", and the reload has
      four rows.
- [x] A recording of a save, sent, is a file under `.bugreports/` that
      an agent can read as a prompt.
      `report.json` writes it under `--bugs`.
- [x] `task gate` is green, without the stack step.

### Documentation

- [x] `docs/glossary.md`: the bar, the calculation list, the form, the
      bindings, the result, the status line, **record**.
      The skeleton had most; phase 4 adds the store error, a binding,
      remove, the evaluation error and the feedback dialog's parts.
- [x] `docs/architecture/engine.md`: a section for the two transports.
- [x] `docs/product/user_manual/guides/evaluating-an-expression.md`:
      the guide, with one screenshot at 1600 by 900.
      On "the example", evaluated, offline.
- [x] `docs/product/user_manual/changelog.md`: the first entry.
      And the product log's first day.

## Phase 5 — the dictation [5]

- [x] `services/myw/`: a copied transcription service, renamed My
      Whisper: the module `myw`, the binary `myw`, `Taskfile.myw.yml`;
      without its tailnet node, its tasks and its tailnet flags.
      `--origin` lets in a page that is not on `127.0.0.1:8080`; the
      env names are `MYW_*` and `PROTOWX_WHISPER_*`, the cache is
      `protowx/whisper`. The fixture is `testdata/narration.wav`.
- [x] `web/apps/app/src/transcribeClient.ts`, `narrationMic.ts`:
      copied, as they are.
      With `narrationWorklet.ts`, and `narration.ts` cut to its audio:
      `Downsampler` and `wav`. The report's narration is not built:
      no bullet names its line, its transcript or its upload.
- [x] `web/packages/ui/src/CalculationForm.tsx`: the **dictate**
      button beside the text, drawn when the config names a service;
      a second click stops and puts the transcript in the text.
      It sits right of the form's width, out of the flow, so it moves
      nothing. The words go after the text, less a final full stop.
      The app's half is `app/src/dictation.ts`, tested in node.
- [x] `services/bff/config.go`: the service's URL in the config, as
      `--myw-url` gives it.
      Phase 3 landed it; `server_test.go` checks the body.
- [x] `web/packages/ui/test/controlsStayPut.browser.tsx`: a row for
      **dictate**.
      dictate, stop, dictate, stop; the whole page mounts with it.
- [x] `web/regression/scenarios/crud.json`: a step that checks the
      button is absent with no service.
      No baseline changed.
- [x] Not planned: `Taskfile.yml`: `task test` runs `myw:test`, so
      the gate downloads the model once.

### Done when

- [x] `task myw:serve`, then `task bff:connected -- --myw-url
      http://127.0.0.1:8090`: a dictated expression lands in the
      text.
      No microphone here: bff on `127.0.0.1:9000`, myw with that
      `--origin`, and Chromium's fake microphone playing flite's "two
      plus three". The text read `2 + 3`, and evaluate showed `5`.
- [x] `task gate` is green.

### Documentation

- [x] `services/myw/AGENTS.md`, `README.md`: copied, renamed, without
      the tailnet.
- [x] `docs/glossary.md`: **dictate**.
      And **My Whisper**; the three change logs; `web/AGENTS.md`, a
      sixth way to keep controls put.

## Phase 6 — the traces and the stack [7, 8, 9]

The traces wait for the source's traces to reach its `main`. The
stack's bullets do not, and went first.

- [ ] `services/bff/traces.go`: copied, with `tracedRoutes` as
      `/api/calc` alone and the two spans under it.
      Waits for the traces.
- [ ] `services/bff/traces_test.go`: `TestTraces_Spans` over the
      starter's list.
      Waits for the traces.
- [ ] `services/bff/config.go`: `traces: { view }`.
      Waits for the traces.
- [ ] `web/apps/app/src/trace.ts`, `test/trace.test.ts`: the copied
      sender and its list, cut to the starter's spans.
      Waits for the traces.
- [ ] `web/packages/ui/src/BugReportDialog.tsx`: the trace line under
      the title.
      Waits for the traces.
- [~] `deploy/compose/`: `compose.yaml`, `compose.regression.yaml`,
      `Dockerfile`, `jaeger.yaml`, `Taskfile.compose.yml`, copied; the
      node `protowx-<branch>`.
      All but `jaeger.yaml`, with `serve.json` and
      `Dockerfile.dockerignore`. Missing: `jaeger.yaml` and the Jaeger
      service; they wait for the traces. No named contexts: `go.work`
      has no `replace`. `bff`'s calculations are in the volume
      `store`. The regression stack is `bff` alone, on
      `127.0.0.1:8094`.
- [x] `deploy/AGENTS.md`, `deploy/compose/README.md`: copied, with the
      ports of PRD section 8.
      `:8445` is named as the viewer that joins with the traces.
- [x] `web/regression/playwright.stack.config.ts`: copied, with the
      `stack` project alone.
      It greps `@stack` alone, on `8094`.
- [x] `web/Taskfile.web.yml`: `regression:stack`.
- [x] `Taskfile.yml`: the gate's stack step.
      And the stack line of `task baselines`, with
      `--pass-with-no-tests` for a name the stack does not play.
- [ ] `web/regression/scenarios/report.json`: the stack project's
      steps: the trace line links to the viewer, and the viewer has
      the trace. Its baselines.
      Waits for the traces.
- [x] Not planned: `web/regression/scenarios/crud.json`: the `stack`
      server too, with its baselines, so the stack step plays a
      scenario before the traces land.
- [x] Not planned: the pages that named Jaeger in the stack, or other
      ports: `AGENTS.md`, `docs/README.md`, `merging-branches.md`, the
      `regression-scenario` skill, `web/regression/README.md`.

### Done when

- [~] `task compose:up`, then a recording on the page: the report's
      trace line opens the trace in Jaeger on `:8445`.
      Not run: `compose:up` joins a tailnet, and the trace half waits
      for the traces. Run instead: `task compose:check` passes; `task
      compose:build` builds `protowx-main-bff` and `protowx-main-myw`;
      the `myw` image on loopback answers `ok base.en` and transcribes
      the fixture in 1.6 s.
- [x] `task gate` is green, with the stack step.
      `crud` on the stack: `1 passed`, then `gate: green`.

### Documentation

- [~] `docs/product/admin_manual/traces.md`, `running-the-stack.md`.
      `running-the-stack.md` is written from `deploy/compose/README.md`,
      with the admin index `README.md`. Missing: `traces.md`; it waits
      for the traces.
- [x] `docs/product/admin_manual/changelog.md`: the first entry.
      The stack's entry, and `task web:regression:stack`.
- [x] `docs/devtools/compose-tailscale.md`: the node's name.
      `protowx-<branch>`; the Jaeger lines are cut.

## Not in any phase

- **The first tag.** `v0.1.0` is on the commit that the check of
  [../../devtools/fresh-clone.md](../../devtools/fresh-clone.md)
  passed on: both greps print nothing, and `task gate` ends `gate:
  green`. The traces follow it.
- **The iac.** The workspace's `iac/` is a repository of its own, with
  its own plan of work. No bullet here changes it.
- **What follows.** Features 002 to 006 under `docs/features/` are the
  starter's todo, one stub each.
