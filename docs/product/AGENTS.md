# docs/product

The repo-wide rules are in the root `AGENTS.md`. This file covers
`docs/product/`: the pages for the people who use the product or run
it. Each manual has its own `AGENTS.md` with its reader and its voice.

| directory       | reader                           | a page is                                          |
|-----------------|----------------------------------|----------------------------------------------------|
| `user_manual/`  | the user, who keeps calculations | a tutorial, a guide, a reference or an explanation |
| `admin_manual/` | the admin, who runs the stack    | a task, a reference, or the change log             |

**Three change logs.** One change can have an entry in each, written
for its reader:

| log                         | reader              | an entry is                                                    |
|-----------------------------|---------------------|----------------------------------------------------------------|
| `changelog.md`              | anyone: what is new | a line or two a day, high level; no commit, no detail          |
| `user_manual/changelog.md`  | the user            | a new or changed interaction with the page: gesture, key, menu |
| `admin_manual/changelog.md` | the admin           | a new or changed interaction with the command line: flag, task |

Both detailed logs give each entry its kind, what the reader does now,
and the commit. A change that neither reader sees, such as a refactor,
has no entry. Write the entries by hand.

**Keep the cognitive load low.** The root `AGENTS.md` has the rules.
An annotated screenshot puts the term at the part, with its number,
and not a number alone.

**A page here describes the product as built.** A decision is a
feature's `prd.md` in `docs/features/`; how the code works is
`docs/architecture/`; one developer tool is `docs/devtools/`.

**Who writes here.** Anyone.
