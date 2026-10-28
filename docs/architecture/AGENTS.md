# docs/architecture

The repo-wide rules are in the root `AGENTS.md`. This file covers
`docs/architecture/`.

## Who reads a page

An engineer or an agent who must understand a part of the system before
they change it.

The pages here describe the whole system: the engine, the transports
and the server. A feature's own page is
`docs/features/<feature>/arch.md`, under the same rules. An `arch.md`
that two features cite moves here under the feature's name.

## What a page is

A page explains one part of the system from the top down:

1. **The first paragraph** says what the part does. It links the PRD
   that decided the shape.
2. **The map** is a diagram or a table. It names each component and what
   it computes.
3. **The numbered sections** go from the idea to the detail.

`engine.md` is the model.

## Keep it high level

- Explain the idea, the data flow and the invariants. The code holds the
  rest.
- Name a component by its package or directory, for example `eval/` or
  `services/bff`.
- Name a type or a function only where the idea needs it. Do not list
  the functions of each file.
- **Do not link to source code.** A link to a source file goes stale when
  the file moves. A search finds the name.
- Link to other pages under `docs/`, and to a module's `README.md`,
  freely.
- A short code block can show the shape of an idea. Do not copy the
  code.

## Keep the section numbers

Comments in the code cite a section by number, for example
`engine.md section 3`. Do not renumber a section. Put a new section at
the end. If a section must move, update each comment that cites it:

```sh
grep -rn 'docs/architecture/' engine clis services web
```

## Voice

STE. The map first, the detail after.

## What goes elsewhere

| a page about                    | goes in                           |
|---------------------------------|-----------------------------------|
| one feature's built shape       | `docs/features/<feature>/arch.md` |
| a decision still open           | `docs/features/<feature>/prd.md`  |
| a checklist                     | `docs/features/<feature>/plan.md` |
| one tool                        | `docs/devtools/`                  |
| research into an outside source | `docs/kb/`                        |

## In the same commit

- A change to the behaviour that a page describes changes the page.
- A new part on screen gets its name in `docs/glossary.md` first.

## Who writes here

Anyone.
