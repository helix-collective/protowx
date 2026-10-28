# docs/devtools

The repo-wide rules are in the root `AGENTS.md`. This file covers
`docs/devtools/`.

**Reader.** An engineer who sets up the dev shell or drives a tool in
it. An agent that is about to run a tool for the first time: read the
tool's page before you run it.

**A page is** one tool or one workflow. The command first, as it is run
from the dev shell. Then what the tool is for, the gotchas, and the
experiences engineers have had with it, each with a date and a name.
`grammar-tests.md` is the model for a tool page, and
`feature-workflow.md` for a workflow.

**The page starts with `## TL;DR`.** It is one `sh` block of the
commands, in the order they are run. `merging-branches.md` is the
model.

- Put the comment on the lines above its command, not at the end of
  the command line.
- Say in the comment where to run the command: the directory, the
  branch, and the state the command needs.
- Say in the comment what the command does, and what it changes.
- Show the `cd` and the `git switch` that get there.
- Put one blank line between two commands.
- Put a table before the block when the reader moves between places,
  such as worktrees.

The sections after the TL;DR say more about each command: the steps,
the refusals and the gotchas.

**Voice.** STE on. EF support on: the command first, the reasons after.

**Not here.** How the product works goes to `docs/architecture/`. A
decision goes to a feature's `prd.md` in `docs/features/`. The flake pins every tool; name a version
only where the version matters. A page about `md-table-fmt` or the
prompt-history commands goes to `wxio/repo-tools` `docs/`. They are
four programs of their own repository, and a copy here would go stale.

**In the same commit.** A tool added to `flake.nix` gets its row in the
root `AGENTS.md` dev shell table, and a page here if it needs one.

**Who writes here.** Any engineer. An agent adds a page or an experience
note when asked, and links it from `docs/README.md`.
