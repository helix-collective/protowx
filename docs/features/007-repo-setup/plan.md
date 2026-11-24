# repo-setup: implementation plan

The checklist for [prd.md](prd.md). That document is the argument; this one is the work. Tick a bullet in the commit that lands it. Section numbers in brackets point into `prd.md`.

## Legend

- `[ ]` not started
- `[~]` in progress — the bullet says what is missing
- `[x]` done and tested

## Before starting

- [x] Read [prd.md](prd.md).
- [x] Read `docs/devtools/fresh-clone.md`. The README section links it; do not copy it.
- [x] Read `.claude/skills/merge-features/SKILL.md` for the shape of a skill in this repository.

## Phase 1 — the README section [1, 2]

- [x] `README.md`: a section "Set up on a Mac", after the parts table. It holds the steps of section 2.1, then the steps of section 2.2, each as a command block with a comment on each line.
- [x] `README.md`: in the same section, the table of section 2.3: symptom, cause, fix.
- [x] `README.md`: one paragraph on the gate on a Mac. It ends `gate: red at web:regression` until section 4 is decided; the steps before that are green.
- [x] `README.md`: the existing three-line block (`direnv allow`, `task web:dev`, `task gate`) stays, after the new section, as the daily commands.
- [x] `web/regression/scenarios/repo-setup.json`: delete the `todo` scenario. The PRD decision is "none".
- [x] `docs/features/README.md`: the row `007-repo-setup` gets an `x` under `plan`.
- [x] `README.md` and `prd.md` section 2.2: a worktree needs `task web:install` again. The web packages are a folder in the worktree, and this feature's worktree had none. The PRD had said that they hold for every worktree.
- [x] `prd.md` section 3.3: the hook check is `grep -qF`. Without `-F`, the grep of macOS does not match the quoted line.

### Done when

- [~] Each command in the section was run on this Mac, and its output matches what the section says. Missing: the checks of every step and `task web:install` ran here, and matched. The installers ran on this Mac between 2026-11-05 and 2026-11-12, and were not run again. `task gate` was not run for this change; it is known red at `web:regression` on a Mac.
- [x] `repo-tools md-table-fmt -n README.md` reports nothing.

### Documentation

- [x] `docs/product/changelog.md`: a line for the day: the README tells a new person how to set up a Mac.

## Phase 2 — the skill [3]

- [x] `.claude/skills/repo-setup/SKILL.md`: the front matter. `name: repo-setup`. The description names the trigger phrases of section 3.1.
- [x] `.claude/skills/repo-setup/SKILL.md`: the rule of section 3.2: who does each step. The agent does the repository steps. The person runs the Nix installer. The person approves each change to a home-folder file and to another program.
- [x] `.claude/skills/repo-setup/SKILL.md`: one table row per step of section 2: the step, its check command, the fix, and who does it.
- [x] `.claude/skills/repo-setup/SKILL.md`: the symptoms of section 2.3, each with the check that finds it before the gate does.
- [x] `.claude/skills/repo-setup/SKILL.md`: how to run in the agent's shell: `direnv exec .` when the shell has no hook; the gate in the background, its output in `/tmp/protowx-gate.log`; read the lines that start `gate:`.
- [x] `.claude/skills/repo-setup/SKILL.md`: the end of a run: the map of every step, ticked or not, and one next action.
- [x] `CLAUDE.md`: a line under "Claude Code specifics": invoke the `repo-setup` skill when a prompt asks to set up the repository, a new Mac or a new clone.

### Done when

- [~] Each check command in the skill runs on this Mac and gives the answer the skill says it gives. Missing: step 12, the gate, which this change did not run. The port check found port 8099 held by another program, as the skill says it does.
- [~] A fresh agent, given the prompt "set up the repo", loads the skill and reports the map with every step ticked except the gate. Missing: the run itself. The skill loads at the start of a session, so the session that wrote it cannot test it.

### Documentation

- [x] None beyond the skill and the `CLAUDE.md` line.

## Not in any phase

- The fix for the regression screenshots on a Mac (section 4). It is its own decision and its own change.
- `task setup:check`, the check script. The PRD has it as a runner-up.
- Linux. Nobody has run the steps there.
- The screenshots. The feature changes no page, so no screenshot goes stale.
