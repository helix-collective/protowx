# protowx

`protowx` is said "proto works".

A starter repository: a stack, and as little application as shows it
working. A nix shell pins every tool. ADL types generate both ends of
the protocol. An Ohm grammar is compiled to WebAssembly and read by a
generated visitor. A Go engine runs as a native binary behind HTTP and
as WebAssembly in a Web Worker, under a SolidJS page. Around them are
a Playwright regression suite, prek hooks, a Taskfile, a model in the
process through kronk, a feedback report, traces, a compose stack on a
tailnet, and two manuals. The application is a calculator over
integers, and a page that creates, reads, updates and deletes the
calculations it evaluates.

| part                 | what it is                                         | where             |
|----------------------|----------------------------------------------------|-------------------|
| the dev shell        | nix pins Go, node, pnpm, task, prek, adlc, ohm-cli | `flake.nix`       |
| the specification    | the grammar and the ADL types, written by hand     | `spec/`           |
| the engine           | the parser, the AST, the evaluator, the store      | `engine/`         |
| the command          | an expression in, the value out                    | `clis/calc/`      |
| the server           | the page, `/api/calc`, the feedback report         | `services/bff/`   |
| My Whisper           | speech to text for **dictate**, through kronk      | `services/myw/`   |
| the page             | SolidJS over a typed client: a worker or HTTP      | `web/`            |
| the regression suite | Playwright scenarios and their baselines           | `web/regression/` |
| the compose stack    | `bff` and `myw` behind one tailnet node            | `deploy/compose/` |
| the git hooks        | prek: the transcripts, the tables, the plan table  | `prek.toml`       |
| the docs             | the features, the manuals, the tool pages          | `docs/`           |

```sh
direnv allow    # enter the dev shell; the first time builds the toolchain
task web:dev    # the page on Vite's dev server
task gate       # every check a merge needs; ends gate: green
```

Read [AGENTS.md](AGENTS.md) for how to work here,
[docs/README.md](docs/README.md) for the map of the docs, and
[docs/devtools/feature-workflow.md](docs/devtools/feature-workflow.md)
for one feature from its number to its merge.
[docs/devtools/fresh-clone.md](docs/devtools/fresh-clone.md) checks
that a clone of this repository alone builds and passes its gate.
