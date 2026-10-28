# The feature workflow

One feature, from its number to its merge. Three commands move the
branch; between them, the work is a PRD, a plan, and one phase at a
time. This page is the loop, end to end. Each step links the page
that has the detail.

## TL;DR

There are three worktrees, each on one branch:

| directory           | branch   | who works there                                      |
|---------------------|----------|------------------------------------------------------|
| `protowx/`          | `main`   | you: start and finish a feature                      |
| `../protowx-<name>` | `<name>` | you and the agent: the feature's work and refresh    |
| `../protowx-merge`  | detached | `feature:finish` only: the merge, its gate, its push |

```sh
# 1. Start. In the main checkout, on main, with no changed tracked file.
# It reserves the next number, writes the todo scenario, commits and pushes main,
# then adds the worktree ../protowx-<name> on the branch <name>.
cd protowx
git switch main
task feature:new -- <name>

# 2. Enter the worktree, once. The command prints these two lines; they are yours to run.
cd ../protowx-<name>
direnv allow
prek install

# 3. Write the PRD, then the plan. docs/features/NNN-<name>/prd.md and plan.md.
# A prompt to the agent: "write a prd and plan for <the feature>". Read both before phase 1.

# 4. Work one phase. A prompt: "implement phase N". The agent edits, tests and reports.
# It ticks the phase's bullets in the same change, and writes its reply to .prompts/output/.
# It does not stage or commit; say "commit" when the chunk is right.

# 5. The scenario and its baselines, when the phase changes the page.
# The stub is already there; write its steps, then take the baselines and look at each one.
task web:regression -- <name>                       # red once; writes the first baseline
task web:regression -- <name>                       # green against it
task baselines -- <descr>                           # a changed shot: both configs, and the visual diff

# 6. Refresh after each phase, and always before the finish. Every change committed.
# It merges the local main into <name>, then runs the gate.
task feature:refresh

# 7. Finish. Back in the main checkout, on main. It merges in ../protowx-merge behind the
# gate, fast-forwards main, tags merged/<name>-YYYYMMDD, and pushes.
cd ../protowx
git switch main
task feature:finish -- <name>

# 8. Tidy. The finish prints these two lines. It does not run them.
git worktree remove ../protowx-<name>
git branch -d <name>
```

The gate is one command with one answer, `gate: green` or `gate: red
at <step>`. Refresh and finish run it; run it alone at any time:

```sh
task gate
```

## 1. Start: the number and the worktree

`task feature:new -- <name>` reserves the number on `main`, so two
branches never take the same one. It writes
`docs/features/NNN-<name>/prd.md` with a status line, the row in
`docs/features/README.md`, and `web/regression/scenarios/<name>.json`
as a `todo`. It commits, pushes `main`, and adds the worktree.
[merging-branches.md](merging-branches.md) section 1 has each step
and each refusal.

The worktree needs its own `direnv allow` and `prek install`. The
command copies `.envrc.local` in, and prints the CAUTION block: the
file may hold a tailscale key.

## 2. The PRD, then the plan

The PRD is the argument: what to build and why. It opens with one
paragraph that says what it specifies, then **Decisions at a glance**,
a table of concern, decision and runners-up. Its sections are
numbered, so the plan can cite them. A status paragraph near the top
says what is built, and moves as phases land. A finding that must
change first goes in `## 0. Blockers`, before the decisions.

The plan is the checklist: one `## Phase N — name [sections]` per
phase, one bullet per change in one file, the file first. Each phase
ends with **Done when** and **Documentation**. The last phase is
"the screenshots" when the phases change a screenshot in
`docs/product/`. A bullet that
changes the grammar starts with **grammar:**.

[../features/AGENTS.md](../features/AGENTS.md) is the page: the
directory, each file, the model to copy
(`001-calculator/prd.md`). Read both pages before
the first phase, and catch a misread there: a phase is cheaper to
change on the page than in the code.

## 3. A phase

A phase is one prompt: "implement phase N". The agent reads the
phase, says the size, and works in chunks. After each chunk it writes
one line: what changed, what is next.

In the same change, it:

- ticks the phase's bullets, `[x]` done, `[~]` partly done with what
  is missing, and adds a ticked bullet for work the plan did not name;
- moves the PRD's status paragraph;
- adds the glossary entry and the `theme.css` tokens for a new part on
  screen, and the change log entry for a changed interaction;
- updates a page that quotes the code it changed; the root
  `AGENTS.md`, "Docs that quote the code", is the table;
- writes a copy of its reply to
  `.prompts/output/YYYYMMDD-HHMM__<branch>__<descr>.md`.

It does not stage or commit. "Commit" in your message is the signal;
one request is one commit. The `Stop` hook writes the transcript to
`.prompts/history/<branch>/` after each turn, and the
`prompt-history-guard` hook keeps those transcripts out of a code
commit: commit the code, then the transcripts.

A phase that changes the grammar stops at its **grammar:** bullet and
discusses the change first. The root `AGENTS.md`, "The grammar is
the specification", is the rule.

## 4. The scenario and the baselines

A phase that changes what the page shows names its scenario. The
`todo` stub from the start is `web/regression/scenarios/<name>.json`;
write its steps, with the phase's **Done when** as its first clicks.
A first run is red and leaves the baseline as an untracked file; look
at it, then the next run is green. A changed shot takes its baseline
again with `task baselines -- <descr>`, which runs both configs and
writes the visual diff to `docs/changes/visual-diff/<descr>/`. A
person decides a baseline, not an agent.
[regression-scenario.md](regression-scenario.md) is the page: the
stub, the dev server loop, the baselines.
[../../web/regression/README.md](../../web/regression/README.md) is
the runner and the step table.

`task feature:refresh` prints `scenario: todo <name>` when the branch
changes `web/` and the scenario still has no steps, and
`task feature:finish` refuses such a branch. A branch that changes
`web/` for a reason no scenario can show finishes with
`--no-scenario "<reason>"`.

## 5. Refresh

`task feature:refresh`, in the branch's worktree, with every change
committed. It merges the local `main` into the branch and runs the
gate on the result. It does not fetch `origin`. A conflict lists its
files and stops; [merging-branches.md](merging-branches.md) section 2
has the rules. Run it after each phase, so a conflict is small, and
always before the finish.

## 6. Finish and tidy

`task feature:finish -- <name>`, in the main checkout, on `main`. It
works in `../protowx-merge`: `git merge --no-ff --no-commit`, `pnpm
install`, the gate. Green: it commits the merge, fast-forwards `main`,
tags `merged/<name>-YYYYMMDD`, and pushes `main` and the tag. Red: it
aborts, and `main` does not move. Fix a red on the branch, refresh,
and finish again. Do not `cd` into `../protowx-merge`.
[merging-branches.md](merging-branches.md) section 3 has each step.

The finish prints the two tidy commands, `git worktree remove` and
`git branch -d`, and does not run them.

## 7. What each step writes

| step                   | writes                                                      |
|------------------------|-------------------------------------------------------------|
| `task feature:new`     | `prd.md`, the README row, the `todo` scenario; a commit     |
| the PRD and the plan   | `prd.md`, `plan.md`; the README's plan table, by the hook   |
| a phase                | the code, the ticks, the status, the docs it quotes         |
| each turn              | `.prompts/output/`; `.prompts/history/`, by the `Stop` hook |
| a scenario             | `scenarios/<name>.json` and its `-snapshots/`               |
| `task baselines`       | the baselines, `docs/changes/visual-diff/<descr>/`          |
| `task feature:refresh` | a merge commit on the branch                                |
| `task feature:finish`  | the merge, `main`, the tag; a push                          |

Three hooks run in a commit, from `prek.toml`: `md-table-fmt` aligns
the tables of the staged Markdown and fails the commit so you stage
the result; `plan-report` rewrites the plan table of
`docs/features/README.md` the same way; `prompt-history-guard`
unstages the transcripts from a commit of anything else. The root
`AGENTS.md`, "The git hooks", is the rule.
