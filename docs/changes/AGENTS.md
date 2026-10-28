# docs/changes

The repo-wide rules are in the root `AGENTS.md`. This file covers
`docs/changes/`.

**Reader.** The person who accepted a change to what the page shows,
and anyone who later asks what changed and when. An agent reads a
page here to see what a baseline looked like before it was taken
again.

**A page is** one generated record of a change, under a directory
named for it. `visual-diff/<descr>/` is the one kind so far: what
`task baselines -- <descr>` wrote when it took the regression baselines
again. `index.html` is the visual diff, to open in a browser: each
changed shot's region zoomed from the old and the new baseline, the
changed pixels in magenta, and the whole pictures swapping on hover.
`README.md` beside it records the commits, lists the shots, and
holds the person's or the agent's verdict on each, one line a shot,
in the words of the `merge-features` skill: intended, regression,
flaky or new.

**The commits.** The `README.md` names the commit of `HEAD` when the
baselines were taken, and of `MERGE_HEAD` in a merge, each with its
full sha. The table's `old commit` column names the commit that wrote
each old baseline. The new baselines have no commit when the page is
written: the commit that adds the directory holds them. So a reader
reads a diff as two commits: the one the page names, and the one that
added the page. `git log -- docs/changes/visual-diff/<descr>` finds
the second.

- The pictures are generated. Do not edit one; take the baselines
  again instead.
- Write the verdicts under "The verdicts" in the `README.md`, after
  the table. The table is generated; the list is yours.
- A directory is kept. It is the record of why a baseline changed, so
  the next changed shot can be read against it.
- `<descr>` is kebab-case, and says what changed: `status-line-one-row`,
  not `fix`. The branch name is a fair default when the branch is the
  change.
