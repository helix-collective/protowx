# docs/product/admin_manual

The repo-wide rules are in the root `AGENTS.md`, and the rules for
both manuals in `../AGENTS.md`. This file covers
`docs/product/admin_manual/`.

**Reader.** The admin: the person who runs protowx for users, or for
themself. The admin starts `bff` and `myw`, runs the compose stack on
a tailnet, reads the traces, and upgrades. Not the user; their pages
are in `../user_manual/`. Not the engineer who changes the code; their
pages are in `docs/devtools/` and `docs/architecture/`.

**A page is** one of three kinds, and says which in its first
paragraph:

| kind           | holds                                                              | model                  |
|----------------|--------------------------------------------------------------------|------------------------|
| a task         | one job: the commands first, then what they do, the gotchas, notes | `running-the-stack.md` |
| a reference    | the exact flags, routes, files or settings of one part             | `traces.md`            |
| the change log | what changed for the admin, newest first                           | `changelog.md`         |

`README.md` is the index, from the first page on; every page is one
row of it.

**Voice.** STE on. EF support on. The voice is half `docs/devtools/`
and half the user manual:

- From devtools: the command first, as it is run, then the reasons. A
  gotcha is stated where it bites. An experience note has a date and a
  name.
- From the user manual: the reader's words, not the code's. One kind
  per page; a page that is two kinds is split. A page links its
  companions under **See also**.

**Names.** A page names the services the admin runs: `bff`, `myw`,
the compose stack. A page does not name packages, types or functions:
those are in `docs/architecture/`.

**The change log.** `changelog.md` takes an entry for every new or
changed interaction an admin has with the command line: a command,
flag, subcommand, task, route, file, directory, service or default; a
fix of lost or wrong data; a step needed to upgrade. Not a refactor
that changes nothing for the admin. Each entry gives its kind (added,
changed, fixed, removed), what the admin types or does now, and the
commit. `../AGENTS.md` says how the three change logs divide the
work. Write the entry by hand under **Unreleased**.

**In the same commit.** A change to a flag, route, file layout or task
of `bff`, `myw` or `deploy/` updates the page that describes it, and
adds a change log entry.

**Not here.** How a tool's code works, a decision, or how a user
uses the page.

**Who writes here.** Anyone. An agent adds a change log entry in the
commit that makes a change an admin sees.
