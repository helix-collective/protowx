# docs

The map of `docs/`. One row per directory, then the compass that says
which directory a new page belongs in. Each directory's `AGENTS.md`
states its reader and its voice.

Start at [devtools/feature-workflow.md](devtools/feature-workflow.md).
It is one feature from its number to its merge: the three commands,
the PRD, the plan, a phase, the scenario, and what each step writes.

| directory                                      | reader                                   | a page is                                           |
|------------------------------------------------|------------------------------------------|-----------------------------------------------------|
| [architecture/](architecture/)                 | an engineer or an agent about to change  | how the whole system works, and where               |
| [devtools/](devtools/)                         | an engineer who sets up or drives a tool | one tool: the command, the gotchas, the experiences |
| [features/](features/)                         | an engineer, a product manager, an agent | one feature: `prd.md`, `plan.md`, `arch.md`         |
| [kb/](kb/)                                     | an agent first, an engineer second       | research into an external source; and `go-style.md` |
| [product/user_manual/](product/user_manual/)   | the user of the page                     | a tutorial, a guide, a reference or an explanation  |
| [product/admin_manual/](product/admin_manual/) | the admin who runs the stack             | a task, a reference, or the change log              |
| [glossary.md](glossary.md)                     | every reader                             | the names of the parts on screen                    |

[changes/](changes/) holds the visual diff that `task baselines --
<descr>` writes, one directory per change of the baselines.
[architecture/engine.md](architecture/engine.md) is the engine: the
grammar to the AST, the AST to the value, the store and its two
entries.

Two tools have their pages elsewhere. `md-table-fmt` and the
`prompt-history` commands live in
[wxio/repo-tools](https://github.com/wxio/repo-tools), and their
pages are in that repository's `docs/`. The flake pins the commit, so
the page and the binary move together.

[devtools/merging-branches.md](devtools/merging-branches.md) is the
merge into `main`: `task feature:refresh`, `task feature:finish` and
`task gate`, the one check before a merge.
[devtools/regression-scenario.md](devtools/regression-scenario.md)
writes one scenario of the regression suite: the `todo` stub, the dev
server loop and the baselines.
[devtools/grammar-tests.md](devtools/grammar-tests.md) runs the
grammar's fixtures with `ohm-cli test txtar`: how a fixture is written,
and how an expectation is renewed.
[devtools/nix-custom-dev-tools.md](devtools/nix-custom-dev-tools.md)
is the flake: the dev shell, the pinned tools, and how to build one
from a local checkout.
[devtools/compose-tailscale.md](devtools/compose-tailscale.md) runs
`bff` and `myw` in docker behind one tailnet node: the
credential, `TS_DOMAIN`, and kernel mode.
[kb/go-style.md](kb/go-style.md) is the house style for Go.

## The compass

For a page in the user manual, two questions decide the directory.

| the page informs | and serves                 | so it is       |
|------------------|----------------------------|----------------|
| action           | the acquisition of a skill | a tutorial     |
| action           | the application of a skill | a how-to guide |
| cognition        | the application of a skill | a reference    |
| cognition        | the acquisition of a skill | an explanation |

For an engineering page: a decision is a feature's `prd.md`, the steps
that land it are its `plan.md`, and how the built feature works is its
`arch.md`. How the whole system works is `architecture/`. Research into
an external source is `kb/`.
