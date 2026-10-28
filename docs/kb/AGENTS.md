# docs/kb

The repo-wide rules are in the root `AGENTS.md`. This file covers
`docs/kb/`, the knowledge base.

**Reader.** An agent, before a task that touches an algorithm, a
library or a technique from outside this repository. An engineer who
wants the same fact.

**A page is** research into one external source, or one question about
such sources: an algorithm, a library, a standard, a technique, or a
survey of how other systems do a thing. It opens with the answer, then
the evidence, with each source linked. It states the date it was
written, and the versions it read. It says what the source would cost
here, and decides nothing about this repository.

**Voice.** STE on. Answer first. No status block; a page here has no
work in it.

**Not here.** Anything about this repository's own design. An analysis
of one of our features is `notes-<topic>.md` in that feature, under
`docs/features/`. A mockup page is the feature's `mockups.md`. A
decision is its `prd.md`, a checklist its `plan.md`. A how-to for the
user goes to `docs/product/user_manual/guides/`. A tool goes to
`docs/devtools/`.

**The one exception.** `go-style.md` holds the house conventions an
agent reads before it writes Go. It is not research. It stays here
because the root `CLAUDE.md` imports it by this path.

**In the same commit.** A new page gets its row in `docs/README.md`. A
PRD that takes a decision this page analysed links the page.

**Who writes here.** Anyone. An agent writes here unasked when a task
sends it to read an external source. It says in the first paragraph
what the page decides: nothing.
