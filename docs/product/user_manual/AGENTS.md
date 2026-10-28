# docs/product/user_manual

The repo-wide rules are in the root `AGENTS.md`. This file covers
`docs/product/user_manual/` and the rules its directories share.

**Reader.** The user: the person who keeps and evaluates calculations
on the page. Not the engineer; the design notes are in
`docs/features/` and `docs/architecture/`.

**A page is** one of four kinds, and says which in its first paragraph:
a tutorial, a guide, a reference or an explanation. The compass in
`docs/README.md` decides. A page links its companions of the other
kinds under **See also**. `README.md` here is the index, and every page
is one row of it.

**Voice.** Per kind. Everywhere: the glossary names the parts on screen,
so use those words.

**Not here.** How the engine is built. A page that is two kinds is
split, and the halves link each other.

**In the same commit.** A page that quotes an error message or the
words of the page is listed under "Docs that quote the code" in the
root `AGENTS.md`; the commit that changes the code changes the page. A
screenshot is replaced in the commit that changes what it shows, or,
in a plan of several phases, in the plan's last phase. The root
`AGENTS.md`, "Screenshots", gives the rule.

**The change log**, `changelog.md`, is the one page that is none of
the four kinds. It takes an entry for every new or changed interaction
a user has with the page: a gesture, a key, a menu item, a button, a
message or a refusal. Not a change the user cannot see. Each entry
gives its kind (added, changed, fixed, removed), what the user does
now, the page that explains it, and the commit. `../AGENTS.md` says
how the three change logs divide the work.

**Screenshots** live in `screenshots/`, named `<page>-<n>.png`, taken
at 1600 by 900 on a named calculation.

**Who writes here.** Anyone.
