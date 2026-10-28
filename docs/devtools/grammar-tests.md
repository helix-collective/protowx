# The grammar's fixtures: `ohm-cli test txtar`

## TL;DR

```sh
# Every fixture. In the repository root, in the dev shell, with docker on the machine.
# It changes no file.
task calc:grammar-test

# One fixture. The runner wants a working directory named ohm-cli.
cd spec/ohm-cli
ohm-cli test txtar tests/<name>.txtar
```

The fixtures are `spec/ohm-cli/tests/*.txtar`. Each holds inputs for
`spec/calc.ohm` and the parse tree each input must give. The runner
is `ohm-cli`, from `ohm-go`, which the flake builds from the pinned
source. It compiles the grammar with the `ohmjs/ohm` docker image,
once per run, and parses with the `ohm-go` runtime, as the engine
does. The `calc:` tasks run in `engine/` and read `../spec/`.

| to                                     | do                                                  |
|----------------------------------------|-----------------------------------------------------|
| bump the pin to a newer `ohm-go` tag   | the `ref` in `flake.nix`, `task nix:update-ohm-cli` |
| run an `ohm-cli` from a local checkout | set `OHM_GO_DEV` in `.envrc.local`, `direnv reload` |

**The flake pins `ohm-cli` at the tag `ohm-cli/v1.1.0`, `39a1186`.** The
task runs with `--strict`, and the fixtures have `error` members. Both
need that tag or later. The `main` of `ohm-go` is older, so the flake's
input names the tag. The workspace pins the same commit, and
`engine/go.mod` requires `ohm` and `ohm-cli` `v1.1.0`. The task
refuses an `ohm-cli` with no `--strict`, and names the fix.

[nix-custom-dev-tools.md](nix-custom-dev-tools.md) section 8 has the
local checkout.

## A fixture

A txtar file: free text, then files, each under a `-- name --` line.

```
-- @../../calc.ohm --
-- s1.txt --
1 + 2 * x
-- s1.t.l.b.v.c_and_p --
(Exp 0-9 '1 + 2 * x'
  …
```

- `@path.ohm` names the grammar file, relative to `tests/`. Only one
  per fixture. From `spec/ohm-cli/tests/`, `../../calc.ohm` is
  `spec/calc.ohm`.
- `name.txt` is one input. The runner parses it from the grammar's
  **first rule**, `Exp`, unless the member names another.
- `name.<flags>.c_and_p` is the parse tree the input must give. The
  flags between the name and the extension are `candp`'s: `t` drops
  the terminals, `l` the `_list` nodes, `b` the builtin rules
  (`letter`, `digit`, …), `S` keeps syntactic rules alone, and `v`
  writes each node's span and source text.
- The text before the first file is free. A fixture lists its inputs
  there, one line each, since a `.txt` cannot hold a comment.
- `name.<flags>.error` is the message that an input that must not
  parse gives: the line and column, the line with a caret, and the
  expected text when the runtime has it. Two flags go before `error`:
  `N` drops the newline that ends the `.txt`, and `s` asks for the
  one-line message, which `ast.ParseError` holds.

In a verbose tree the source text is encoded: `(` is `OP`, `)` is `CP`
and `{` is `OC`.

## Renewing an expectation

The runner prints the tree it got under `received:` and fails. Copy
that block into the `c_and_p` file of the fixture, in place of what
was there. There is no `--accept`. A short program over
`github.com/ohmjs/ohm-go/ohm-cli/candp` can fill every `c_and_p` of a
fixture.

## Gotchas

- **The runner wants a directory named `ohm-cli`.** It refuses to run
  unless the working directory's name is `ohm-cli`, and then reads
  `tests/` under it. That is why the fixtures are at
  `spec/ohm-cli/tests/`, and why the task runs in `../spec/ohm-cli`.
- **A refusal is an `error` member, not a `c_and_p` one.** A `.txt`
  whose `c_and_p` does not parse is a processing error, and the task's
  `--strict` fails the run on it. A spelling that parses and that the
  builder refuses is tested in `engine/ast/`.
- **One compile per run.** `ohm-cli` keeps each compiled grammar for
  the length of the run, keyed by its text. The docker compile is
  about half a second.
- **Docker is not in the dev shell.** The task needs it on the machine,
  as `task calc:ohm2wasm` does.
- **A grammar change is discussed first.** The root `AGENTS.md`, "The
  grammar is the specification", is the rule. A fixture follows an
  agreed change; it does not lead one.

## Experiences

Add one, with a date and a name, when the runner surprises you.

- **2026-10-28, `match failed` with no expected tokens.** The fixture
  `e2`, `(1 + 2`, gives `Line 1, col 7: match failed`, not a list of
  the tokens that could come next. `ohm` 1.1.0 overflows the wasm stack
  in `recordFailures` after a complete operand, so it has no list. The
  line and the column are right. The fixture holds the message as it
  is; renew it when `ohm-go` fixes the overflow.
