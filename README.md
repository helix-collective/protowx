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

```sh
direnv allow    # enter the dev shell; the first time builds the toolchain
task web:dev    # the page on Vite's dev server
task gate       # every check a merge needs; ends gate: green
```

Read [AGENTS.md](AGENTS.md) for how to work here,
[docs/README.md](docs/README.md) for the map of the docs, and
[docs/devtools/feature-workflow.md](docs/devtools/feature-workflow.md)
for one feature from its number to its merge.
