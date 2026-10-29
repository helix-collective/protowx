# protowx

`protowx` is said "proto works". It is a starter: a stack and as
little application as shows it working. The application is a
calculator over integers, with a page that creates, reads, updates
and deletes the calculations it evaluates.

`spec/` holds what is written by hand and read by a generator: the
grammar `spec/calc.ohm` and the ADL files `spec/calc.adl`,
`spec/model.adl` and `spec/api.adl`. Every other directory holds code,
generated or written, that uses it. A generator's output lands in the
directory that uses it, never in `spec/`. "The modules" below is the
tree.

## How to work with me

These rules cover your replies, plans, commit messages and code
comments. They do not cover prose in a repo that has its own voice —
there, match the file you are editing.

### Simplified Technical English

Write to the ASD-STE100 writing rules. Use the rules, not the approved
word list: 900 words cannot carry Go, Ohm or ADL, and technical names
and technical verbs are exempt in STE itself.

- One idea per sentence. One instruction per sentence.
- 20 words maximum in an instruction, 25 in a description.
- 6 sentences maximum in a paragraph.
- Active voice. Imperative mood for an instruction.
- Present tense, unless the past is the point.
- One word, one meaning. Repeat a term; do not vary it for style.
- Keep articles and helping verbs. Write "the walk cache", not "walk
  cache".
- 3 words maximum in a noun cluster.
- Use a relative clause where an -ing form is ambiguous.
- Say the thing. Cut the preamble and the hedge.

### Executive function support

I have ADHD. Working memory and task switching are the expensive
parts. Carry that load for me.

- Lead with the answer, or with the next action. Put a blocker in the
  first line, never at the end.
- Give me one next action, not a menu. Where there is a choice, choose
  it, then say what you chose and why in one line.
- Before a long task, repeat my request back in one sentence. I will
  catch a misread there.
- Work in chunks. After each chunk, write one line: what changed, what
  is next. When the chunk lands part of a plan, tick its bullets first
  (`docs/features/AGENTS.md`, "In the same commit").
- When a task runs over several turns, keep a three-line state block:
  done, in flight, next. Three lines, not a report.
- When the work grows past what I asked, stop and name it. Do not
  follow it silently.
- When the work needs a grammar change, stop before the grammar and
  discuss it. See "The grammar is the specification".
- When I go off on a tangent, park the current thread by name and ask
  whether to switch. Hold the parked list and offer it back.
- Do not stage or commit until I say so. Leave the change in the
  working tree and tell me it is ready. "Commit" in my message is the
  signal; "done", "ship" or "looks good" is not. See "The git hooks".
- Avoid an open question. Propose a default and ask me to confirm it.
- Say the size before you start: minutes, or an afternoon.
- Summarise long output. Quote the 5 lines that matter.
- End every turn with one line that starts "YYYYMMDD - HH:MM **Next**:".

## Prompt output

At the end of each prompt, write a copy of your final reply to
`.prompts/output/YYYYMMDD-HHMM__<branch>__<prompt-descr>.md`, relative to this
repository root.

Do not write the file when the prompt is a commit and no other work is
done. If the prompt asks for a commit and other work, write the file as
usual.

- `YYYYMMDD-HHMM` is the local time at the end of the prompt. Get it
  with `date +%Y%m%d-%H%M`.
- `<branch>` is the current branch of the repository that holds
  `.prompts/output/`. Get it with `git branch --show-current`. Replace each
  `/` with `-`, so the name makes no subdirectory.
- `<prompt-descr>` is the request in 2 to 5 words, in kebab-case. An
  example is `tmux-delete-session`.
- Copy the reply as it is. Do not summarise it.
- The file is an edit like any other. Do not stage or commit it until
  told "commit".

## Development environment

`flake.nix` pins the whole toolchain. Enter the shell with `direnv allow`
(`.envrc` is `use flake`) or `nix develop`. A git worktree needs its own
`direnv allow`.

Start a feature's worktree with `task feature:new -- <name>`, on
`main`. It reserves the number, adds `../protowx-<name>`, copies
`.envrc.local` in and prints the block below.
[docs/devtools/feature-workflow.md](docs/devtools/feature-workflow.md)
is the loop, and
[docs/devtools/merging-branches.md](docs/devtools/merging-branches.md)
the three commands. When you start a worktree by hand, copy
`.envrc.local` into it before `direnv allow`. Git ignores the file, so
`git worktree add` does not bring it. Then output this block, so I see
that local settings moved:

```
----------------------------------------------
----------------------------------------------
CAUTION .envrc.local copied in to new worktree
It might contains a tailscale auth key
----------------------------------------------
----------------------------------------------
```

| in the shell                                       | why                                                            |
|----------------------------------------------------|----------------------------------------------------------------|
| `go` (1.27)                                        | `engine`, `clis`, `services/bff`, `services/myw`               |
| `task` (go-task)                                   | every command below; `task --list-all` is the index            |
| `node` (24) and `pnpm` (12)                        | `web/`                                                         |
| `prek`                                             | the git hook runner                                            |
| `adlc`                                             | the ADL compiler, for `task calc:adl-ts` only                  |
| `playwright-driver.browsers`                       | the browsers `task web:test` and the regression suite run in   |
| `gh`                                               | the GitHub CLI, for pull requests                              |
| `repo-tools`                                       | the hooks: `md-table-fmt`, `prompt-history-*`                  |
| `md-tmpl`                                          | rewrites the plan table of `docs/features/README.md`           |
| `ohm-cli`                                          | `task calc:grammar-test`: the grammar's fixtures, from ohm-go  |
| `whisper-cpp` without SDL and ffmpeg, and `libffi` | `services/myw`, as `PROTOWX_WHISPER_LIBS` and `PROTOWX_LIBFFI` |

**If `task` or `pnpm` is not found, you are not in the shell.** Enter it
rather than running `go build` or a system `pnpm` by hand; a different
toolchain fails later and further away.

- `adlc` is absent on `x86_64-darwin` and `aarch64-linux`, so
  `task calc:adl-ts` does not run there. Every other generator is a
  `go tool` dependency.
- `docker` is not in the shell. `task calc:ohm2wasm`, the stack and
  the gate's stack step need it on the machine.

**Two `go.work` files, and `GOWORK` picks.** `go.work` here names the
four modules, `./engine`, `./clis`, `./services/bff` and
`./services/myw`, and has no `replace` line. So a clone of this
repository alone resolves `adl-go` and `ohm-go` from the proxy, at the
versions the `go.mod` files require. The workspace,
`protowx-workspace`, has a `go.work` of its own at its root. It names
the same four modules and the library checkouts beside them:
`adl-go/adl`, `adl-go/goadlc`, `ohm-go/ohm` and `ohm-go/ohm-cli`.

- `.envrc` exports `GOWORK` to `../go.work` when that file names this
  checkout. The shell banner says which `go.work` is in use.
- A lone clone has no `../go.work`, so it keeps its own.
- A worktree, `../protowx-<name>`, is not named in the workspace's
  file, so it keeps its own too.
- `GOWORK=off` in `.envrc.local` turns the switch off for one
  checkout.

No tracked file changes between the two modes.

## Go style

Read [docs/kb/go-style.md](docs/kb/go-style.md) before writing Go here: locals
in a `var (...)` block at the top of the scope, assigned with `=` inside
`if`; every struct literal multi-line with a trailing comma.

## The grammar is the specification

**Do not edit a grammar file until I have agreed to the change.** A
grammar file is `spec/calc.ohm` today, and any `.ohm` file added
later. The grammar is the closest code we have to a specification.
Most agent edits to a grammar have needed rework.

When a task, a plan or a phase turns out to need a grammar change:

1. Stop before you edit the grammar. Do the parts of the task that do
   not depend on it.
2. Say which rules change, and what each change parses that the
   current rule does not. Quote the current rule and the proposed
   rule. Say what the AST (`spec/calc.adl`), `engine/ast/build.go`
   and the fixtures under `spec/ohm-cli/tests/` must follow with.
3. Wait for my answer. "Go ahead" on the grammar means that change
   only; the next grammar change needs the next discussion.

The one exception: a prompt that says to modify the grammar, by name.
"Add `Foo` to `calc.ohm`" is such a prompt. "Implement phase 3", where
phase 3 lists a grammar bullet, is not: stop at that bullet and discuss
it.

**A start rule must stay a function.** The Ohm compiler inlines a
rule that is applied in one place and has no description, and an
inlined rule cannot be a start rule. `Exp` is the start rule, and it
is applied in one place, in `PriExp`. After `task calc:ohm2wasm`,
check that the compiler kept it as a function. If it did not, the fix
is the description `Exp (an expression)`, and nothing else changes.

Prefer a change that leaves the grammar alone. A function's name is
not in the grammar: it is a name in a registry of the evaluator. Look
for that shape first, and say when it does not fit.

## Controls stay put

A click that changes the page must not move a control: a button, a
checkbox, a chip, a select, an input, a toggle or a clickable row. The
user clicks, sees the change, and clicks the same place again. They do
not move the mouse, and they do not search for the control.

This holds for every part of `web/`. `web/AGENTS.md`, "Controls stay
put", gives the ways to keep the rule and its exceptions. A browser
test in `web/packages/ui/` enforces it. Give each new control, and
each new gesture on a control, a row in its table.

## Keep the cognitive load low

A reader of the docs and a user of the page hold little in working
memory. Each look-up, each eye jump and each thing to remember costs
them. Dyslexia and ADHD raise that cost. Remove the cost where you can.

**Put the word at the thing.** This is the main rule. Do not number a
part and explain the number in a list elsewhere.

- An annotated screenshot labels each part with its number and its
  term, together, at the part. The number links the label to a table
  row; the term means the reader needs no table to read the shot.
- A diagram or a mockup writes the name on or beside each part. A
  legend is for a colour or a line style only.
- A number alone is the fallback, when no label fits. Say so on the
  page.

In the docs:

- Write in STE: short sentences, one idea in each.
- Put an example next to the rule it shows, not in a later section.
- Repeat a term at each use. A pronoun or "the above" sends the reader
  back to find it.
- Emphasise with bold. Do not use italics, underlining or capitals for
  emphasis. Align text left; do not justify it.
- Give every image alt text that names what the image shows.

In the product (`web/`):

- Give each control a visible word. An icon alone needs a word beside
  it, or a tooltip where space is too small. The glossary names the
  word.
- Show a message beside the part that it is about, not in a far
  panel.
- Let the user recognise, not recall. Show the choices. Do not make the
  user carry an id, a code or a value from one part of the page to
  another.
- Keep text at 4.5 to 1 contrast or more, WCAG 2.2 AA. A size or a
  colour is a token in `theme.css`, so one change fixes every use.
- Keep a control and its label in the same place each time; see
  "Controls stay put".

## Markdown style

A page is read in the raw file as often as in a viewer. `gofmt` decides
Go, and nothing decides Markdown, so these rules are written down.

**Align every table.** Pad each cell with spaces to the width of the
widest cell in its column. Fill the separator row with dashes to the
same width. Every row of one table is then the same length.

```markdown
| file         | what it computes                      |
|--------------|---------------------------------------|
| `build.go`   | the parse tree to the AST             |
| `printer.go` | an `Exp` as text, fully parenthesised |
```

Three rules follow from it:

- **Keep a cell short.** A cell cannot wrap, so one long cell makes
  every row long. Cut a cell that runs past about 70 characters, or
  split the row.
- **Do not put a pipe in a cell, even as `\|`.** It is two characters in
  the file and one on screen, so no padding lines up in both.
- **Re-align after an edit.** A new row that is wider re-pads the whole
  table.

Do not do this by hand. `repo-tools md-table-fmt` does it, and a prek
hook runs it over the Markdown files a commit stages:

```sh
repo-tools md-table-fmt docs/devtools/feature-workflow.md
repo-tools md-table-fmt -n $(git ls-files '*.md')   # report only
```

It aligns, reports a cell past 70 runes, and refuses a cell holding an
escaped pipe.
[wxio/repo-tools `docs/md-table-fmt.md`](https://github.com/wxio/repo-tools/blob/main/docs/md-table-fmt.md)
is the page.

This applies to every `.md` in the repository, this file included.

## The modules

Each module has its own `AGENTS.md`, beside a `CLAUDE.md` that imports
it, from the phase that fills the module. Claude Code loads the pair
when it first reads a file under that directory. Read it before
editing there.

| directory       | what it holds                                                     |
|-----------------|-------------------------------------------------------------------|
| `spec/`         | the grammar, the three ADL files, the grammar's fixtures          |
| `engine/`       | Go module `engine`: the grammar, the AST, the evaluator, the wasm |
| `clis/`         | Go module `clis`: one `main` package per command; `calc` first    |
| `services/bff/` | Go module `bff`: the page, `/api/calc`, the report, the traces    |
| `services/myw/` | Go module `myw`: My Whisper, whisper.cpp through kronk            |
| `web/`          | the pnpm workspace: `client`, `ui`, the app, the regression suite |
| `deploy/`       | the compose stack: `bff` and `myw` behind one tailnet node        |
| `scripts/`      | the body of a task too long for a Taskfile; one per directory     |

`engine/` imports no service and no CLI, so the wasm build cannot link
one. `services/bff` imports `engine`. `services/myw` imports kronk,
which opens `libffi` in an `init`; nothing else does.

These rules cross a module boundary, so they live here:

- **Any Go change under `engine/` means rebuilding `calc.wasm`**
  (`task calc:wasm`); the `web:` tasks depend on all of it.
- **A change to `spec/calc.ohm` is discussed before it is made.**
  "The grammar is the specification" above holds the rule. Once
  agreed, it means both generators, `task calc:ohm2wasm` and
  `task calc:gen_visitor`, then `task calc:grammar-test`.
- **`spec/api.adl` is the protocol between the engine and `web/`.**
  A change to it, or to `spec/calc.adl` or `spec/model.adl`, means
  both generators, `task calc:goadlc` and `task calc:adl-ts`; never
  hand-edit either output.
- **The engine API in `services/bff` is single-tenant and only
  correct on loopback.** Anything that deploys it must turn it off.
  The compose stack, `deploy/compose/`, is not such a deploy: it is
  one person's own stack on their own tailnet, so it keeps `--api`
  on. A stack that serves anyone else turns it off.

## docs

Each directory under `docs/` has its own `AGENTS.md`, beside a
`CLAUDE.md` that imports it, stating who reads the pages there and in
what voice they are written. [docs/README.md](docs/README.md) is the
map and the compass; read it before adding a page.

| directory                    | a page is                                                   |
|------------------------------|-------------------------------------------------------------|
| `docs/architecture/`         | how the whole system works, and where                       |
| `docs/devtools/`             | one tool: the command, the gotchas, the experiences         |
| `docs/features/`             | one feature: `prd.md`, `plan.md`, `arch.md`, screenshots    |
| `docs/kb/`                   | research into an external source, and `go-style.md`         |
| `.bugreports/`               | a feedback report the page wrote, to be read as a prompt    |
| `docs/product/user_manual/`  | tutorials, guides, references and explanations for the user |
| `docs/product/admin_manual/` | a task, a reference or the change log, for the admin        |

`docs/glossary.md` has no directory `AGENTS.md`, so its rules are here.
It names the parts on screen, for the user, the engineer and the
agent alike. It stays at the docs root, so there is one copy at one
path. Write it in STE, like every page under `docs/`. A new part on
screen gets its glossary entry first, then its `theme.css` tokens, in
the commit that adds the part. Anyone writes here.

**The change logs.** A commit that changes how a user or an admin
works adds an entry to the change log of that reader:
[the user's](docs/product/user_manual/changelog.md) for a new or
changed interaction with the page, and
[the admin's](docs/product/admin_manual/changelog.md) for one with the
command line (a flag, route, file, service, task or default of `bff`,
`myw` or `deploy/`), and a fix of lost or wrong data in either.
[The product log](docs/product/changelog.md) takes a line or two a
day. `docs/product/AGENTS.md` says what each holds.

## Docs that quote the code

Update these in the same commit as the code they quote. A page is
under `docs/product/` unless its row names a path, and each quotes
names, messages or paths verbatim.

| page                                             | quotes                                              |
|--------------------------------------------------|-----------------------------------------------------|
| `user_manual/guides/evaluating-an-expression.md` | the errors of `engine/eval/`; the words of the form |
| `admin_manual/traces.md`                         | the span names of `services/bff/traces.go`          |
| `readingList` in `web/apps/app/src/bugReport.ts` | the path of every file it names                     |

## Screenshots

**Keep the screenshots true.** A screenshot in `docs/product/` shows
the page as it is now: the user manual's in
`docs/product/user_manual/screenshots/`. A change that alters what a
screenshot shows re-shoots it. A stale picture teaches the wrong page.

- **One change, one commit.** A change that is not part of a plan
  re-shoots its screenshots in its own commit.
- **A plan of several phases re-shoots once, at the end.** Do not
  re-shoot in each phase: the next phase changes the page again, and
  the work is done twice. When you write the plan, make its last phase
  "the screenshots". That phase re-shoots every screenshot the phases
  before it made stale. A phase before it lists the screenshots it
  made stale, and leaves them.
- **The user manual's shots** are taken at 1600 by 900 on a named
  calculation. Change a shot's alt text with its picture.
- **The shots and mockups under `docs/features/`** record a decision.
  Leave them as they were taken.
- **The regression baselines change with the page.** A baseline is
  `web/regression/scenarios/<name>.json-snapshots/<server>/<shot>-linux.png`.
  A change that alters what a baseline shows takes it again, with
  `task baselines -- <descr>`, in the same commit, as a manual
  screenshot is. It runs both configs with `--update-snapshots` and
  writes the visual diff to `docs/changes/visual-diff/<descr>/`; commit
  that too. Look at each new baseline first.
  `web/regression/README.md` is the page.

[docs/features/AGENTS.md](docs/features/AGENTS.md), "`plan.md`", holds
the rule for the last phase.

## The git hooks

**Do not run `git add` or `git commit` until I say "commit".** Edit,
test and report. When I say "commit", stage only the files you changed
for the task, then commit. One request is one commit; the next commit
needs the next request.

The hooks are commands from
[wxio/repo-tools](https://github.com/wxio/repo-tools), pinned in
`flake.lock` and on `PATH` in the dev shell.
`nix flake update repo-tools` bumps them. A change to a hook is a
change in that repository, not this one.

`prek.toml` wires two of them up. A third hook, `plan-report`, runs
`md-tmpl` over `docs/features/README.md`.
[prek](https://github.com/j178/prek) runs them all. Install once per clone
and per worktree:

```sh
prek install           # writes .git/hooks/pre-commit
prek run               # over what is staged
prek run --all-files
```

The guard unstages the transcripts from a commit of anything else, and
refuses the commit if the mix is still there. By hand: `git restore
--staged .prompts`, commit the code, then commit the transcripts.

## Commands

Run from the repo root, inside the dev shell (`task --list-all` for
everything):

| task                              | regenerates                                                            | then fix                                              |
|-----------------------------------|------------------------------------------------------------------------|-------------------------------------------------------|
| `task calc:ohm2wasm`              | `engine/grammar/calc.wasm` (needs docker)                              | —                                                     |
| `task calc:gen_visitor`           | `engine/visitor/`                                                      | `engine/ast/build.go` where field lists moved         |
| `task calc:goadlc`                | `engine/types/calc/`, `model/`, `api/`                                 | `engine/ast/build.go` where `Make_*` changed          |
| `task calc:adl-ts`                | `web/packages/client/src/adl/`                                         | the typed client in `client/src/engine.ts`            |
| `task calc:wasm`                  | `web/packages/client/wasm/`                                            | —                                                     |
| `task gen`                        | all four of the generators above                                       | —                                                     |
| `task fastdev`                    | nothing; it checks the credentials, then runs `task compose:up`        | the line it names; `compose-tailscale.md`             |
| `task gate`                       | nothing; it checks, and ends `gate: green` or `gate: red at <step>`    | the step it names; `merging-branches.md`              |
| `task web:regression`             | nothing; it builds `dist/`, plays the scenarios, compares the shots    | the page, or its baseline; `web/regression/README.md` |
| `task web:regression:stack`       | nothing; it builds the docker images, plays the stack's scenarios      | the page, or its baseline; `web/regression/README.md` |
| `task baselines -- <descr>`       | the baselines of both configs, and `docs/changes/visual-diff/<descr>/` | a shot's verdict in its `README.md`                   |
| `task feature:new -- <name>`      | on `main`: the number, `prd.md`, the `todo` scenario, the worktree     | the name it refuses; `feature-workflow.md`            |
| `task feature:scenario -- <name>` | `web/regression/scenarios/<name>.json`, as a `todo`                    | its steps; `web/regression/README.md`                 |
| `task feature:refresh`            | in a branch: merges the local `main`, then runs the gate               | a conflict, or the step the gate names                |
| `task feature:finish -- <branch>` | on `main`: the merge in `../protowx-merge`, the gate, push, tag        | the refusal, which names its fix                      |

```sh
cd engine && go test ./... && go vet ./...
cd clis && go test ./... && go vet ./...
echo '(x + 3) * y' | go run ./clis/calc -b x=5 -b y=1
cd services/bff && go test ./... && go vet ./...
cd services/myw && go test ./... && go vet ./...

task web:install            # once
task web:test               # regenerates both sides, then Vitest
task web:dev                # the page on Vite's dev server
task web:regression         # the scenarios on dist/, each shot against its baseline
task web:regression:stack   # the stack's scenarios, on docker
```
