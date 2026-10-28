---
name: merge-features
description: Merge a feature branch into main in protowx, or refresh a branch from main, through the three commands task feature:refresh and task feature:finish and the gate. Use this whenever a prompt says "merge", "merge <branch>", "finish the branch", "land", "land <branch>", "refresh from main", "bring main in", or names a worktree such as ../protowx-<name> as the thing to merge — even when it never says "skill", "feature" or "gate".
---

# merge-features: refresh, pre-screen, draft, ask, finish, report

This skill is the merge process for an agent. A person reads the same
process, command first, in
`docs/devtools/merging-branches.md`.
`docs/devtools/feature-workflow.md`
is the loop that the merge ends.

**The rule.** Code does each step that a command can check. You run
the command and read its output. You do not type `git merge`, `git
push` or `git tag`. You read, judge and draft: a conflict, a red gate,
a changed shot, the merge message. The person makes each step that
cannot be undone: a baseline, a commit, the finish, a removal.

## Before you start

- **Say the size.** A refresh and a finish each run the gate, 3 to 4
  minutes warm. A merge with one changed shot takes about 15 minutes.
- **Run each long command with a 10-minute timeout**, or in the
  background. The Bash tool stops a command at 2 minutes by default.
  The gate, a refresh and a finish each take longer.
- **Write the long output to a file.** A refresh prints about 220
  lines. Send it to a file in `/tmp`, then read the lines that start
  `gate:`, `scenario:` or `feature:`. On red, read the lines above the
  answer in the same file.
- **Run one gate at a time on the machine.** Its ports and its compose
  project are fixed. A second gate at the same time is red at
  `web:regression`.
- **Find two worktrees.** The branch's worktree is
  `../protowx-<branch>`. Main's worktree is the main checkout, on the
  branch `main`. `git worktree list` marks each with its branch. When
  protowx is a submodule of a workspace clone, the list names the main
  checkout by its git dir, `.git/modules/protowx`. Its path is then
  the workspace's `protowx/`.
- **Use an absolute path in each command.** The Bash tool resets the
  working directory between calls. Write `cd <worktree> && task ...`
  in one call.

## The state block

After each step, write three lines, and nothing longer:

```text
done: refresh, gate green, no scenario todo
in flight: pre-screen, 2 changed shots
next: draft the message
```

## The steps

### 1. Say which

```sh
git worktree list && git log -1 --format='%h %s' main
```

Name the branch, its worktree and the tip of the local `main`. Repeat the
request back in one sentence: "Merge `<branch>` from
`../protowx-<branch>` into `main` at `<sha>`." When no worktree holds
the branch, stop and say so. Do not add one: `task feature:new` adds
it, and an old branch needs the person's choice.

### 2. Refresh

```sh
cd <branch worktree> && task feature:refresh
```

The answer is the last line that starts `gate:` or
`feature:refresh:`. `task` adds lines that start `task: Failed` after
it; they are not the answer. `scenario: todo <branch>` can come after
the answer, on green and on red:

- **`gate: green`.** Go on to step 3.
- **`feature:refresh: a conflict in the files above; ...`.** Resolve
  each file by the rules of merging-branches.md section 2. Do not
  resolve a generated file by hand: take a side, then run its
  generator. Run `task gate` in the worktree. Show the person the
  resolution, and wait for "commit". Then run
  `SKIP=prompt-history-guard git merge --continue --no-edit`, and
  refresh again.
- **`gate: red at web:regression`** or **`gate: red at
  web:regression:stack`.** A shot changed. Go to step 3 now: the next
  run deletes the pictures.
- **`gate: red at <another step>`.** Read the lines above the answer;
  they are the output of the step that failed. Do not run the step
  again to see them. Fix the cause on the branch, show the person, and
  wait for "commit". Then refresh again.
- **`feature:refresh: the tree has changes; ...`.** A tracked file in
  the branch's worktree has changes. Stop and ask the person: the
  changes are theirs.
- **`scenario: todo <branch>`.** The branch changes `web/`, and its
  scenario has no steps. Invoke the `regression-scenario` skill. It
  writes the steps and the baselines, then asks the person to say
  commit. After the commit, refresh again: refresh reads the scenario
  from `HEAD`, so the line stays until the commit. Or ask the person
  for a reason to pass `--no-scenario`. Do not write the reason
  yourself.

A red gate after a clean merge leaves the merge commit on the branch.
Fix the cause in a new commit. Do not amend the merge commit.

### 3. Pre-screen the pictures

```sh
cd <branch worktree> && find web/regression/results -name '*-actual.png' && git diff --name-status main HEAD -- 'web/regression/scenarios/*.png'
```

A changed shot is one of three kinds:

- **A red shot** of this run. Playwright writes three files for it in
  `web/regression/results/<test>-<project>/<scenario>.json-snapshots/`.
  `<test>` is a short form of the test's title with a hash, so use
  the `find`. `<shot>-expected.png` is the baseline,
  `<shot>-actual.png` is the page now, and `<shot>-diff.png` shows the
  different pixels in red.
- **A shot with no baseline.** A new scenario's first run is red
  once, by design. It writes `<shot>-actual.png` under `results/`, and
  the same picture as an untracked baseline,
  `web/regression/scenarios/<scenario>.json-snapshots/<shot>-linux.png`.
  The next run is green on that untracked file. Do not judge it here:
  the `regression-scenario` skill takes the baseline again from
  `dist/`, and shows it to the person.
- **A baseline that the branch changes or adds.** It is in the `git
  diff` list: `M` for a changed one, `A` for a new one. The file is the
  new picture. To see the old one of an `M`, write it to `/tmp` with
  `git show main:<path> > /tmp/<shot>-old.png`.

Open each picture with the Read tool: Read shows a PNG as an image.
Read the expected, the actual and the diff, in that order. Then write
one line per changed shot, in this format:

```text
settings/open: intended — the heading gained a word, as plan phase 2 says
editing/end: regression — the insert point is gone from the second row
tabs/tab-added: flaky — a caret at the field's end; two runs before were green
tab-rename/field: new — the rename field, the branch's new scenario
```

Each line is `<scenario>/<shot>: <verdict> — <the reason>`. The verdict
is one of four words: **intended**, **regression**, **flaky**, or
**new** for a baseline that the branch adds. Name the plan bullet or
the commit that makes a shot intended. With no changed shot, write
`no changed shots`.

**Stop. Show the person the lines, and ask.** Do not run
`--update-snapshots` yourself. The person accepts a baseline: a wrong baseline hides a
regression for good.

- **The person says the shots are intended, and to take them.** The
  person runs this, or tells you to run it, with a kebab-case
  description of the change and, when they name some, the scenarios:

  ```sh
  cd <branch worktree> && task baselines -- <descr> [<scenario>...]
  ```

  It runs both configs with `--update-snapshots`, then writes
  `docs/changes/visual-diff/<descr>/`: `index.html`, the visual diff of
  each changed shot, and a `README.md` with their table and the commit
  shas: `HEAD`, `MERGE_HEAD` in a merge, and the commit that wrote each
  old baseline. Leave the shas as written. Read each new
  baseline. Write your pre-screen lines under "The verdicts" in that
  `README.md`, and give the person the path of `index.html` to open.
  Wait for "commit", then commit the baselines and the directory on the
  branch, and name the commit that changed the page. Then go to
  step 2.
- **A regression.** Fix the page on the branch, wait for "commit",
  then go to step 2.
- **Flaky.** Do not raise the threshold. Write the cause in the
  feature's `plan.md`, and ask the person.

### 4. Draft the message

```sh
cd <branch worktree> && git log --no-merges --format='%h %s' main..HEAD && git diff --stat main HEAD -- docs/product/
```

Read the commits. Write the merge message to the file that finish
reads, `<git common dir>/feature-merge/<branch>.msg`. `git rev-parse
--path-format=absolute --git-common-dir` gives the directory. Make
the `feature-merge/` directory if it is absent. The format:

```text
Merge <branch>: <what the branch does, in under 60 characters>

For the user: <what changed on the page, in STE; or "nothing">.

For the admin: <what changed in a command, flag, task, file or
service; or "nothing">.

Feature: docs/features/NNN-<name>/

Co-Authored-By: <the attribution line of this session>
```

Write the message in STE: one idea in each sentence, active voice, no
more than 25 words in a sentence. `finish` adds the line `No scenario:
<reason>` when you pass `--no-scenario`; do not write it yourself.

**Check the change logs.** The `git diff --stat` above lists the files
under `docs/product/` that the branch changes. A change for the
user needs an entry in `docs/product/user_manual/changelog.md`. A
change for the admin needs one in
`docs/product/admin_manual/changelog.md`. `docs/product/AGENTS.md`
says what each holds. A new word in a heading is not an entry; a new
gesture, key, menu item, tab or message is. When an entry is missing,
write it on the branch, show the person, and wait for "commit".

**Check the docs that quote the code.** The root `AGENTS.md`, "Docs
that quote the code", lists each page that quotes a file verbatim.
For each file in `git diff --name-only main HEAD` that the table
names, `git grep` the old words under `docs/product/`. A page that
still quotes the old words is fixed on the branch, in the same way.

### 5. Ask

Show the person the message, the pre-screen lines, and the command of
step 6. Then ask, in these words:

> Ready to finish `<branch>`; say commit.

Wait. "Commit" in the person's message is the signal. "Done", "ship"
and "looks good" are not.

### 6. Finish

```sh
cd <main worktree> && task feature:finish -- <branch>
```

Add `--no-scenario "<reason>"` only with the person's words as the
reason. It runs the gate, so write its output to a file. The answer is
the last line that starts `feature:finish:`. On green, the two removal
lines come after it. Read it:

- **`feature:finish: <branch> is merged as <sha>, tagged <tag>, and
  pushed`**, then the two removal lines. Go to step 7.
- **`feature:finish: <branch> is merged as <sha> and tagged <tag> on
  main here; the push was refused, so origin is unchanged; ...`**,
  then the two removal lines. The merge is done on the local `main`.
  `origin/main` has commits that `main` lacks. Do not pull, and do not
  push again. Go to step 7, and tell the person that origin is
  unchanged.
- **A refusal.** Each starts with `feature:finish:` and says what to
  do. Expect the three that guard the merge:
  - `<branch> does not hold main; run task feature:refresh in the
    branch first`. `main` moved. Go to step 2.
  - `gate: red at <step>; the merge is aborted; ...`. The merged tree
    is red, and nothing is pushed. Read the lines above, then go to
    step 2.
  - `scenario: todo <branch>; write its steps, or give --no-scenario
    "<reason>"`. Go to step 2, the `scenario: todo` case.

  The others: `no merge message` (go to step 4), `the tag ... exists`
  (a merge of this branch today; ask the person), `main's worktree has
  changes` (ask the person), `main moved during the finish` (finish
  again), and `a commit hook refused the merge commit`
  (fix the file it names on the branch, then step 2).

Do not fix anything in `../protowx-merge`. Finish resets it on each
run, and a fix there is lost.

### 7. Report

```sh
cd <main worktree> && git log -1 --format='%h %s' main && git tag --points-at main
```

Report the merge commit, the tag, and the two lines that finish
printed, for the person to run:

```sh
git worktree remove ../protowx-<branch>
git branch -d <branch>
```

## Traps

- **Do not run `--update-snapshots` or `task baselines` without the
  person.** The person accepts each changed baseline, after your
  pre-screen lines. A wrong
  baseline hides a regression for good. The one exception is the
  `regression-scenario` skill: it takes the first baselines of the new
  scenario that it writes, by that scenario's name, and the person
  looks before the commit.
- **Do not amend the merge commit.** Not the one that refresh makes,
  and not the one that finish makes. A fix is a new commit on the
  branch.
- **Do not resolve a generated file by hand.** Take either side, run
  the generator (merging-branches.md section 2 has the table), and
  commit its output.
- **Do not remove a worktree or a branch.** Finish prints the two
  commands; the person runs them.
- **Do not pass `--no-scenario` without the person's reason.** Use the
  person's words, in quotes. "The skill was absent" is not a reason.
- **Do not type `git merge`, `git push` or `git tag`.** Refresh merges
  the local `main`, and finish merges, tags and pushes. The one exception
  is `SKIP=prompt-history-guard git merge --continue` after you
  resolve a conflict.
- **Do not commit without "commit".** A resolution, a fix, a change log
  entry and a baseline each wait for the person's word, as the root
  `AGENTS.md` says. The commits that refresh and finish make are the
  person's request to merge.
- **Read the pictures before the next run.** Playwright empties
  `web/regression/results/` at the start of each run, and the gate
  runs it.
- **Read the answer, not the tail.** On red, `task` adds one or two
  lines `task: Failed to run task ...` after the answer. On a green
  finish, the removal lines come after it. The answer is the last line
  that starts `gate:`, `feature:refresh:` or `feature:finish:`.
