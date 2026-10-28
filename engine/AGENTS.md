# engine

The repo-wide rules are in the root `AGENTS.md`: the writing rules, the
dev shell, the Go style and the commands. This file covers the Go
module `engine`.

The hand-written inputs are in `../spec/`. Two generators read them,
and the hand-written packages here are visitors over the output. The
`calc:` tasks run in this directory and read `../spec/`.

| path                    | what it is                                                    |
|-------------------------|---------------------------------------------------------------|
| `adl.cfg.json`          | goadlc's config: reads `../spec/*.adl`, writes `types/`       |
| `Taskfile.calc.yml`     | the `calc:` tasks                                             |
| `grammar/grammar.go`    | `grammar.New(ctx)`: the one embed of `calc.wasm`; `StartRule` |
| `grammar/calc.wasm`     | generated from `spec/calc.ohm` by `task calc:ohm2wasm`        |
| `visitor/`              | generated from `spec/calc.ohm` by `task calc:gen_visitor`     |
| `types/calc/`           | generated from `spec/calc.adl` by `task calc:goadlc`          |
| `ast/build.go`          | `Parse`, `Build`: the parse tree to `calc.Exp`; `ParseError`  |
| `ast/printer.go`        | `Print`: a `calc.Exp` as text, fully parenthesised; `OpText`  |
| `../spec/ohm-cli/tests` | the grammar's fixtures, run by `task calc:grammar-test`       |

## Generated directories

Never hand-edit `visitor/`, `types/` or `grammar/calc.wasm`. Change
the `.ohm` or the `.adl` in `../spec/` and regenerate.

- `grammar/calc.wasm` and `visitor/` come from two separate tasks.
  They drift apart silently if you run only one. Run both, then
  `task calc:grammar-test`, whose fixtures hold the parse trees.
- A change to an `.adl` file means `task calc:goadlc` and
  `task calc:adl-ts`. Then fix `ast/build.go` where a `Make_*`
  function changed.
- goadlc writes a union branch's name as a Go parameter name. A
  branch named for a Go keyword, such as `var`, makes Go that does
  not compile. `calc.Exp` names its branch `variable` for that reason.

## The grammar

**Do not edit `../spec/calc.ohm` until the change is agreed.** The
root `AGENTS.md`, "The grammar is the specification", holds the rule:
stop before the grammar, quote the current rule and the proposed
rule, and say what `spec/calc.adl`, `ast/build.go` and the fixtures
must follow with. Then wait.

Prefer a change that leaves the grammar alone. A function's name is
a name in a registry of the evaluator, not a rule of the grammar.

## The start rule

**A start rule must stay a function.** `ast.Parse` enters the grammar
at `Exp`, `grammar.StartRule`. The Ohm compiler inlines a rule that
is applied in one place and has no description. A match from an
inlined rule fails, because its function is a stub. `Exp` is applied
in one place, in `PriExp`, but it is the grammar's first rule, the
default start rule, and the compiler keeps it.

Check it after each `task calc:ohm2wasm`:

```sh
go test ./grammar/ -run TestStartRuleIsAFunction
```

The test looks for `Exp` in `GetRuleNames` and matches a text from
it. If it fails, the fix is the description `Exp (an expression)` in
`calc.ohm`, and nothing else changes. That is a grammar change, so it
is discussed first.

## Parse errors

`ast.Parse` gives a `*ast.ParseError` for a text that does not match.
It holds the line and the column, both from 1, and the one-line
message of the runtime, such as
`Line 1, col 4: expected "(", an identifier, or a number`.

The message names the expected tokens when the runtime finds them.
`ohm` 1.1.0 does not find them after a complete operand, as in
`(1 + 2`: its `recordFailures` overflows the wasm stack. The message
is then `Line 1, col 7: match failed`. The line and the column are
right in each case.

A number past `Int64` matches the grammar, and the builder refuses it
under `ast.ErrNumber`.
