# Merging branches

## TL;DR

There are three worktrees, each on one branch:

| directory           | branch   | who works there                                      |
|---------------------|----------|------------------------------------------------------|
| `protowx/`          | `main`   | you: start and finish a feature                      |
| `../protowx-<name>` | `<name>` | you: the feature's work and refresh                  |
| `../protowx-merge`  | detached | `feature:finish` only: the merge, its gate, its push |

`feature:finish` makes `../protowx-merge` on its first run and resets it
on each later run. You never run a command there. After a green finish
it stays at the merge commit; after a red one, at `main`.

**Refresh and finish work off the local `main`.** Neither fetches
`origin`, so a `main` on GitHub that differs from yours never reaches a
branch or a merge. Finish pushes only what your `main` already holds.

```sh
# Start. In the main checkout, on main, with no changed tracked file.
# It reserves the next number, writes the todo scenario, commits and pushes main.
# Then it adds the worktree ../protowx-<name> on the new branch <name>.
# The first cd is from the workspace root.
cd protowx
git switch main
task feature:new -- <name>

# Set up the new worktree, once. The command prints these two lines.
cd ../protowx-<name>
direnv allow
prek install

# Work. In the branch's worktree, on the branch <name>.
# Edit, test and commit there as usual. The second line prints <name>.
cd ../protowx-<name>
git branch --show-current

# Refresh. In the branch's worktree, on <name>, with every change committed.
# It merges the local main into <name>, then runs the gate on the result. It does not fetch.
# Do it at each milestone, and always before the finish.
cd ../protowx-<name>
task feature:refresh

# Finish. Back in the main checkout, on main, with no changed tracked file.
# You run it here; it works in ../protowx-merge. It does not fetch.
# 1. It makes ../protowx-merge at the local main, detached. If it exists, it resets it there.
# 2. In ../protowx-merge: git merge --no-ff --no-commit <name>, pnpm install, then the gate.
# 3. Green, in ../protowx-merge: it commits the merge.
#    Then, here in protowx/, it fast-forwards main to the merge and tags merged/<name>-YYYYMMDD.
#    Last, it pushes main and the tag. A refused push leaves origin as it was; the merge stays here.
# 4. Red, in ../protowx-merge: git merge --abort. Main does not move, and nothing is pushed.
# It does not change protowx/ or ../protowx-<name> before the gate is green.
# Do not cd into ../protowx-merge, and do not edit it. Fix a red on the branch, then finish again.
cd ../protowx
git switch main
task feature:finish -- <name>

# Tidy. The finish prints these two lines. It does not run them.
git worktree remove ../protowx-<name>
git branch -d <name>
```

Refresh and finish run the gate for you. Run it alone at any time:
```sh
# every check a merge needs; the last line is the answer
task gate
```

A branch has three moments: start, refresh and finish. Each is one
command, and a merge needs no git command typed by hand. A merge into
`main` passes the gate first. The gate is one command with one answer:
`gate: green` or `gate: red at <step>`.
[feature-workflow.md](feature-workflow.md) is the loop that these
commands are part of.

## Testing

Run each command from the repository root of the worktree you test, in
the dev shell. The gate runs the others, so a green gate means each one
is green.

```sh
# The type check: tsc --noEmit in every web package.
# Writes nothing.
task web:typecheck

# The unit tests: Go test and vet for the engine, bff and myw, and Vitest against the real wasm.
# It regenerates the generated code first; see the table.
task test

# One module only: calc:test, bff:test, myw:test or web:test.
task calc:test

# The regression suite, offline and connected, on a build of dist/.
# A scenario with no baseline writes one; see the table.
task web:regression

# One scenario, by the name of its file.
task web:regression -- crud

# Rewrite the baselines, in both configs, and write the visual diff of each
# changed shot to docs/changes/visual-diff/<descr>/. A person decides this, not an agent.
task baselines -- <descr>

# The regression suite on the docker stack: bff, myw and Jaeger.
# It starts the compose project protowx-regression and stops it after, on green and on red.
task web:regression:stack

# All of the above, then the two hook checks, then the clean tree check.
# The last line is gate: green or gate: red at <step>.
task gate
```

**Which commands change the worktree.** The gate is red at `clean
tree` when one of its steps changes, adds or deletes a file. A step
that writes only an ignored file passes.

| command                                     | what it writes in the worktree                                     |
|---------------------------------------------|--------------------------------------------------------------------|
| `task web:typecheck`                        | nothing                                                            |
| `task test`                                 | the generated code: tracked; no diff unless its source changed     |
| `task web:regression`                       | `dist/`, `results/` and `report/`: all ignored                     |
| `task web:regression`, no baseline yet      | **a new baseline PNG under `web/regression/scenarios/`**           |
| `task web:regression -- --update-snapshots` | **the tracked baseline PNGs**                                      |
| `task baselines -- <descr>`                 | **the baseline PNGs**, and **`docs/changes/visual-diff/<descr>/`** |
| `task web:regression:stack`                 | as `web:regression`; the docker images are outside the tree        |
| `task gate`                                 | what its steps write; red at `clean tree` when the tree changed    |
| `task plan-report`                          | **`docs/features/README.md`**: the fix for a red `plan-report`     |
| `repo-tools md-table-fmt <file>`            | **the file**: the fix for a red `md-table-fmt`                     |
| `task feature:refresh`                      | **a merge commit on the branch**; `node_modules/`; then the gate   |
| `task feature:finish`                       | **`main` in the main checkout**, fast-forward; `../protowx-merge`  |

`task test` regenerates through `task web:gen`: `calc:goadlc` writes
the Go types, `calc:adl-ts` the TypeScript protocol types, and
`calc:wasm` the engine. Each output except the wasm is tracked. When
the `.adl` files in `spec/` have not changed, the output is the same
and `git status` shows no change. When they have changed, commit the
output with them.

A first run of a new scenario is red, and it leaves its baseline in
`web/regression/scenarios/` as an untracked file. The next run is
green against that file, although nobody has looked at it. Look at
each new baseline before you commit it.
[regression-scenario.md](regression-scenario.md) has the steps.

## 1. A branch, from start to merge

### Start: `task feature:new -- <name>`

Run it on `main`, in the main worktree. The name is kebab-case. The
command does these steps:

1. It refuses off `main`, and when a tracked file has changes.
2. It pulls `main`, fast-forward only.
3. It takes the number after the highest in `docs/features/`.
4. It makes `docs/features/NNN-<name>/prd.md`, with the title and a
   status line, and adds the row to `docs/features/README.md`.
5. It writes `web/regression/scenarios/<name>.json`, a `todo`
   scenario.
6. It commits `features/NNN-<name>: reserve the number`, and pushes
   `main`.
7. It adds the worktree `../protowx-<name>`, on the new branch
   `<name>`.
8. It copies `.envrc.local` in, and prints the CAUTION block of the
   root `AGENTS.md`.

Then run the two commands that it prints. They are yours to run:
`direnv allow` is your consent.

```sh
cd ../protowx-<name> && direnv allow
prek install
```

When the push is refused, another person took a number first. The
command undoes its commit. Run it again: it pulls, and takes the next
number.

`task feature:scenario -- <name>` writes the `todo` scenario alone.
Use it for a feature that is older than `feature:new`, or for a second
scenario. It does not overwrite a scenario.

### Refresh: `task feature:refresh`

Run it in the branch's worktree after each phase of a plan, and always
before the finish. The command does these steps:

1. It refuses on `main`, and when a tracked file has changes.
2. It merges the local `main` into the branch. It does not fetch
   `origin`.
3. On a conflict, it lists the files and stops. Section 2 has the
   rules.
4. It runs `pnpm install --frozen-lockfile` in `web/`, then the gate.
5. It prints `scenario: todo <name>` when the branch changes a file
   under `web/`, and its scenario is absent or a `todo`.

Fix a red gate on the branch, in normal commits. Do not amend the
merge commit. Write the scenario's steps when refresh prints `scenario:
todo`; [web/regression/README.md](../../web/regression/README.md) has
the step table.

### Finish: `task feature:finish -- <branch>`

```sh
task feature:finish -- <branch>
task feature:finish -- <branch> --no-scenario "<reason>"
task feature:finish -- <branch> --message-file <path>
```

Run it from `main`'s worktree. It does not touch the branch's
worktree. It refuses in these cases:

- It does not run on `main`.
- A tracked file in `main`'s worktree has changes. On green, `main`
  moves there, so the tree must be clean.
- The branch does not hold the local `main`. It says "run `task
  feature:refresh` in the branch first".
- The branch changes `web/`, and its scenario is absent or a `todo`.
  `--no-scenario "<reason>"` lets the merge go on. The reason goes in
  the merge message, as the line `No scenario: <reason>`.
- The branch has nothing that `main` lacks.
- The tag `merged/<branch>-YYYYMMDD` of today exists.
- The merge message is absent or empty.

**The merge message is a file.** Write it before the finish. The
default path is `<git common dir>/feature-merge/<branch>.msg`. `git
rev-parse --path-format=absolute --git-common-dir` gives the directory.
The `merge-features` skill writes the file there. `--message-file
<path>` names another file. After a green merge, the command deletes the
file at the default path. It does not delete a file that the flag
names.

Then the command does these steps. It does not fetch `origin`.

1. It adds `../protowx-merge` at the local `main`, or resets that
   worktree to `main`.
2. It runs `git merge --no-ff --no-commit <branch>` there.
3. It runs `pnpm install --frozen-lockfile` in `web/`, then the gate.
4. Green: it commits with the message in `../protowx-merge`. Then it
   moves `main` here to the merge commit, fast-forward only, and tags
   it `merged/<branch>-YYYYMMDD`.
5. Green: it pushes `main` and the tag in one atomic push. A plain
   push never forces. When `origin/main` has commits that `main`
   lacks, origin refuses the push and stays as it was. The merge and
   the tag stay on `main` here, and the last line says
   `the push was refused`, with the command to push later.
6. Red: it runs `git merge --abort`. `main` does not move, and
   nothing is pushed. Its last line is
   `feature:finish: gate: red at <step>`, and what to do next.

After a green merge, pushed or not, it prints the two commands that remove the
branch's worktree and the branch. It does not run them. Removing them
is yours.

```sh
git worktree remove ../protowx-<branch>
git branch -d <branch>
```

`git log --graph --oneline main` shows the merge as a loop, with its
`merged/` tag. `git revert -m 1 <merge>` undoes the feature as one
step.

## 2. Conflicts

A conflict is resolved in the branch, at a refresh. The merge worktree
never sees one. These are the rules:

- **Resolve, then run the gate.** Do not commit a resolution without
  it. Then run `SKIP=prompt-history-guard git merge --continue`, and
  `task feature:refresh` again.
- **Do not resolve a generated file by hand.** Take either side, run
  its generator, and commit the output.

  | the generated files            | the generator           |
  |--------------------------------|-------------------------|
  | `web/packages/client/src/adl/` | `task calc:adl-ts`      |
  | `engine/types/`                | `task calc:goadlc`      |
  | `engine/visitor/`              | `task calc:gen_visitor` |

- **`docs/features/README.md` and a `plan.md`** are the usual conflict.
  Keep both sides. `md-table-fmt` aligns the table again; the prek
  hook runs it.
- **`.prompts/history/` and `.prompt-history/`**: keep both sides.

**Skip the transcripts guard on a merge commit.** The guard hook takes
the transcripts out of a commit that holds code too. On a merge commit,
it drops the transcripts that the merge brings, and the commit passes.
The branch's own commits kept them apart already. So `git merge
--continue` runs with `SKIP=prompt-history-guard`, and finish commits
with it. A clean `git merge` runs no `pre-commit` hook.

## 3. The gate

The gate runs these steps in this order. It stops at the first step
that fails.

| step                   | what it runs                                                    | what it catches                               |
|------------------------|-----------------------------------------------------------------|-----------------------------------------------|
| `web:typecheck`        | `task web:typecheck`                                            | a type error that no test reaches             |
| `test`                 | `task test`                                                     | Go, the engine as wasm, jsdom and the browser |
| `web:regression`       | `task web:regression`                                           | a page that looks or acts other than before   |
| `web:regression:stack` | `task web:regression:stack`, on docker                          | the same, for the report's traces in Jaeger   |
| `md-table-fmt`         | `repo-tools md-table-fmt -n -q` over the tracked Markdown files | a table the commit hook would refuse          |
| `plan-report`          | `md-tmpl` over a copy of `docs/features/README.md`, compared    | a plan table the commit hook would rewrite    |
| `clean tree`           | `git status --porcelain`, before and after, compared            | a step that changed, added or deleted a file  |

The last line is the answer:

```text
gate: green
gate: red at test
```

The gate prints `gate: <step>` as it starts each step. On red, the
lines above the last one are the output of the step that failed. Read
them there; do not run the step again to see them.

## 4. The regression suite

```sh
task web:regression                         # every scenario, on dist/
task web:regression -- crud                 # one scenario
task web:regression -- --update-snapshots   # take the baselines again, this config
task baselines -- <descr>                   # both configs, and the visual diff
```

A scenario clicks through the page as it ships, `dist/`, and takes
shots. Each shot is compared with its baseline, to 10 pixels. The gate
runs the suite after `test`. [web/regression/README.md](../../web/regression/README.md)
is the page: the steps, the projects, the report, and the rules that
keep a shot the same on each run.

A red `web:regression` is one of three things:

- **The page broke.** Fix the page on the branch.
- **The page changed on purpose.** Take the baselines again with
  `task baselines -- <descr>`. It runs both configs with
  `--update-snapshots`, then writes `docs/changes/visual-diff/<descr>/`:
  `index.html`, the visual diff of each changed shot, and a `README.md`
  that lists them and records the commit shas: `HEAD`, `MERGE_HEAD` in
  a merge, and the commit that wrote each old baseline. Open the page,
  write a verdict a shot under its table, and commit the directory
  with the baselines and the change that made them.
  `docs/changes/AGENTS.md` has the rules.
- **The run is flaky.** Remove the scenario, and write its cause in the
  plan. Do not raise the threshold to hide it.

The stack's scenarios run in a second config, on the docker images of
`deploy/compose`, with `myw` and Jaeger beside `bff` and no tailnet:

```sh
task web:regression:stack                   # build, start, play, stop
task web:regression:stack -- report         # one scenario
```

The gate runs it after `web:regression`. It needs docker on the
machine. Without docker, the gate prints `docker is not in the dev
shell` and then `gate: red at web:regression:stack`. The stack stops
after the run, on green and on red.

Open `web/regression/report/index.html` to see the expected shot, the
actual shot and their diff side by side. The suite writes the report
and `results/` under `web/regression/`; git ignores both, so the
`clean tree` step stays green.

## 5. Gotchas

- **On red, `task` adds one line after the answer.** It is
  `task: Failed to run task "gate": exit status 1`, on stderr. The exit
  status is not zero, so a script can test the gate without reading
  the line.
- **The two hook steps check; they do not fix.** `md-table-fmt -n`
  writes nothing, and the plan step runs `md-tmpl` on a copy. To fix a
  red `md-table-fmt`, run `repo-tools md-table-fmt <file>`. To fix a
  red `plan-report`, run `task plan-report`.
- **The hook steps use the hooks' excludes.** `.prompts/`,
  `.prompt-history/` and `iac/` are not checked, as `prek.toml` does
  not check them.
- **A dirty tree is allowed.** The `clean tree` step compares the tree
  before the gate with the tree after it. It does not ask for a clean
  tree at the start.
- **Ticking a plan bullet makes `plan-report` red.** The plan table
  in `docs/features/README.md` counts the ticks. Run `task plan-report`
  after you tick, then run the gate.
- **A new step is one line.** Each step is a `run <name> <command>`
  line in the `gate` task of `Taskfile.yml`. Add the line in the order
  of the table above.

- **A worktree builds from its own `go.work`.** `go.work` names the
  four modules and has no `replace`, so a worktree anywhere resolves
  `adl-go` and `ohm-go` from the proxy. In the workspace, `.envrc`
  sets `GOWORK` to `../go.work` only when that file names this
  checkout. The workspace's file names the primary checkout, so a
  worktree at `../protowx-<name>` or `../protowx-merge` keeps its
  own. `feature:new` and `feature:finish` put both beside the main
  checkout, in the workspace.
- **Refresh and finish install the web packages.** Each runs `pnpm
  install --frozen-lockfile` in `web/` before the gate. A new worktree
  has no `node_modules`, and a merge of `main` can bring a new
  package. A lockfile that does not match a `package.json` stops the
  command there.
- **Refresh refuses a change to a tracked file.** Commit or stash it
  first. Git refuses a merge over a changed file, and the merge
  commit must hold the merge only. An untracked file does not count.
- **Origin reaches `main` only when you pull it.** Refresh and finish
  never fetch. To take in work from GitHub, run `git pull --ff-only`
  on `main` yourself, when you decide to. A pull that cannot
  fast-forward means `main` and `origin/main` have diverged; settle
  that by hand before the next finish pushes.
- **The merge worktree holds one merge at a time.** Finish resets
  `../protowx-merge` at the start of each run. The gate's ports allow
  one gate on the machine at a time in any case.

- **The suite's ports are fixed.** The offline project uses
  `127.0.0.1:8098`, and the connected project `8099`. A second gate on
  the same machine at the same time is red at `web:regression`. The
  stack uses `8097` and `8096`, and the compose project
  `protowx-regression`, so it is red at `web:regression:stack` too.

## 6. With an agent

Say "merge `<branch>`" to Claude Code. The `merge-features` skill,
[.claude/skills/merge-features/SKILL.md](../../.claude/skills/merge-features/SKILL.md),
runs the process of section 1 in seven steps:

1. **Say which.** The agent names the branch, its worktree and the tip
   of the local `main`.
2. **Refresh.** It runs `task feature:refresh` in the branch's
   worktree. It resolves a conflict by section 2, and reads a red gate.
3. **Pre-screen.** It opens the expected, actual and diff picture of
   each changed shot. It writes one line for each: intended, a
   regression, flaky, or new, with the reason.
4. **Draft.** It writes the merge message to the file that finish
   reads, and checks the two change logs.
5. **Ask.** It shows you the message and the lines, and asks you to
   say commit.
6. **Finish.** It runs `task feature:finish -- <branch>` from `main`'s
   worktree.
7. **Report.** It gives the merge commit, the tag, and the two
   removal commands.

The agent stops and asks you at four points:

- **A changed shot.** You accept a new baseline. The agent runs
  `task baselines -- <descr>` only when you tell it to, and shows you
  the visual diff it wrote.
- **A commit on the branch.** A resolution, a fix, a change log entry
  or a baseline waits for "commit".
- **The finish.** It waits for "commit".
- **A `todo` scenario.** It writes the steps with the
  `regression-scenario` skill, and waits for "commit";
  [regression-scenario.md](regression-scenario.md) is the process.
  Or you give the reason for `--no-scenario`; the agent does not
  write one.

It does not remove the worktree or the branch. It gives you the two
commands.

## Experiences

None in this repository yet. Add one, with a date and a name, when a
command surprises you.

Two faults that the commands fixed before they came here:

- `md-table-fmt` exits 1 when it rewrites a file. The hook then fails
  the commit, so stage the file and commit again.
- The transcripts guard dropped a branch's transcripts from a merge
  commit with no error. Refresh and finish skip it on the merge
  commit, `SKIP=prompt-history-guard`.
