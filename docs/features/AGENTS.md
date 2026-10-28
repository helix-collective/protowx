# docs/features

The repo-wide rules are in the root `AGENTS.md`. This file covers
`docs/features/`: one directory per feature, and the files in it.
[../devtools/feature-workflow.md](../devtools/feature-workflow.md) is
the loop a feature goes through, from its number to its merge.

## The directory

**A feature is** `NNN-<name>/`. `NNN` is a number of three digits,
zero padded: `001-calculator`. A new feature takes the number after
the highest in this directory. The numbers follow the order of each
feature's first commit, so the listing is the timeline. A number is
never used again, even after its feature is merged into another or
removed. The name is kebab-case. Neither changes after the first
commit; a code comment cites the name. Every file in it is optional:

| file               | a page is                                                 |
|--------------------|-----------------------------------------------------------|
| `prd.md`           | the argument: what to build and why                       |
| `prd-<part>.md`    | a second argument in the same feature, with the same plan |
| `plan.md`          | the checklist for the PRD                                 |
| `arch.md`          | how the built feature works, and where                    |
| `mockups.md`       | the page that shows and compares the mockups              |
| `notes-<topic>.md` | an analysis of this feature that decides nothing          |
| `screenshots/`     | the pictures the pages show                               |
| `mockups/`         | an HTML mockup and the script that shot it                |

**The number is reserved on `main` by `task feature:new`.** Run
`task feature:new -- <name>` on `main`. It takes the number after the
highest, makes the directory with its `prd.md`, adds the `README.md`
row, commits, and pushes. A branch never chooses a number, so two
branches do not take the same one.
[merging-branches.md](../devtools/merging-branches.md) is the page.
The renumber rule stays as the fallback: when two branches hold one
number, the branch that merges second renumbers its feature, before
the merge, to the next free number.

**The index.** [README.md](README.md) has one row per feature. A new
feature gets its row in the commit that creates the directory. Its
"Plans" table is written by the `plan-report` prek hook, not by hand.

**A code comment** cites a page by name, kind and section:
`calculator prd section 4`, `calculator arch section 2`.

## `prd.md`

**Reader.** An engineer and a product manager, deciding together.

**A page is** the argument for one thing to build. It opens with what
it specifies, in one paragraph, then **Decisions at a glance**: a table
of concern, decision and runners-up. Sections are numbered so the plan
can cite them. A status paragraph near the top says what is built. Open
decisions are listed, each with the `docs/kb/` page that analyses it.

**Blockers come first.** A finding that must change before the work can
start goes in `## 0. Blockers`, before Decisions at a glance: what is
wrong, what fixes it, the command that checked it, and the date. An item
leaves in the commit that lands it.

**Voice.** STE off; the argument needs room. EF support on.

## `plan.md`

**Reader.** An engineer or an agent that does the work, one phase at a
time.

**A page is** the checklist for the PRD beside it. One paragraph that
links `prd.md`, says "that document is the argument; this one is the
work", and states the tick rule. Then **Legend**, **Before starting**,
one `## Phase N — name [sections]` per phase, each ending with
**Done when** and **Documentation**, and **Not in any phase**. One
bullet names one change in one file, with the file first.

**The last phase is the screenshots.** A plan whose phases change what
a screenshot in `docs/product/` shows ends with a phase named "the
screenshots". It re-shoots every screenshot the phases made stale, once.
No phase before it re-shoots one; a phase lists the screenshots it made
stale, and leaves them for the last phase. Write the last phase when
you write the plan, not when the work ends. The root `AGENTS.md`,
"Screenshots", gives the reason.

**A phase that changes the grammar says so.** A bullet that changes
`spec/calc.ohm` starts with **grammar:** and quotes the rule it
changes. The agent that works the phase stops at that bullet,
discusses the change, and edits the grammar only once it is agreed.
"Implement phase N" does not agree to it. The root `AGENTS.md`, "The
grammar is the specification", holds the rule.

**A phase that changes the page names its scenario.** A phase that
changes what the page shows names the regression scenario that it adds
or changes, `web/regression/scenarios/<name>.json`, as a bullet of that
phase. The scenario's first steps are the phase's **Done when**, as
clicks. `task feature:new` writes the feature's scenario as a `todo`.
`task feature:finish` refuses a branch that changes `web/` while its
scenario is a `todo`.

**Voice.** STE on. EF support on: the next unticked bullet is visible
from the top.

## `arch.md`

The map first, numbered sections that are never renumbered, no links
to source code. A page that two features cite moves to
`docs/architecture/` under the feature's name, and `prd.md` links it
there.

## The other files

`mockups.md` and `notes-<topic>.md` each decide nothing, and say so in
the first paragraph. A page about this repository's own design goes
here, not in `docs/kb/`; `kb/` takes research into external sources
only. A file in `screenshots/` is taken at 1600 by 900 on a named
calculation. It records the decision it was taken for, and is not
re-shot when the page changes later.

## Not here

A tool goes to `docs/devtools/`. Research into an external source goes
to `docs/kb/`. A page for the user goes to `docs/product/user_manual/`.
A page about the whole system goes to `docs/architecture/`.

## In the same commit

A bullet is ticked, and the PRD's status paragraph moves, in the commit
that lands the code. Work on a phase lands in chunks, and a commit can
come after any of them, so tick in the chunk that lands the code. Do
not save the ticks for a closing docs chunk. Tick a bullet that is
partly done as `[~]`, and say what is missing. Add a ticked bullet for
work that landed and that the plan did not name, such as a bug fixed on
the way. A decision that changes `arch.md` or a page in
`docs/architecture/` changes that page too. A new part on screen gets
its name in `docs/glossary.md` first.

## Who writes here

Anyone.
