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

## Set up on a Mac

These steps take a Mac on Apple silicon to a working dev shell. They were run on one Mac between 2026-11-05 and 2026-11-12. Linux is not covered yet. An agent follows the same steps with the `repo-setup` skill.

### Once per Mac

Run these in a normal terminal, not through an agent.

```sh
xcode-select --install       # the Xcode Command Line Tools: git and the other developer tools
command -v brew              # Homebrew; when it prints nothing, install it from https://brew.sh
brew install direnv          # direnv loads the dev shell when you cd into the clone
curl -fsSL https://install.determinate.systems/nix | sh -s -- install   # Nix; it asks you to confirm, then for your password
echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc   # the direnv hook; keep the double quotes
docker info --format '{{.ServerVersion}}'      # Docker Desktop runs; the gate builds an image and starts it
# Now open a new terminal, so it loads Nix and the direnv hook.
```

The full Xcode app is not needed. The Determinate Systems installer turns on flakes, which `.envrc` needs.

### Once per clone

```sh
cd protowx                                      # your clone
direnv allow                                    # the dev shell; the first time, Nix builds the toolchain for several minutes
git config --local include.path ../.gitshared   # the shared git config: the aliases st, ls, lg and co
prek install                                    # the git hooks
task web:install                                # the web packages
task gate                                       # every check a merge needs; the first run downloads the speech model, 142 MB
```

A worktree made by `task feature:new` needs `direnv allow`, `prek install` and `task web:install` again. The git config line holds for every worktree of the clone.

### What went wrong, and its fix

Each of these happened on the first Mac.

| symptom                                                 | cause                                       | fix                                      |
|---------------------------------------------------------|---------------------------------------------|------------------------------------------|
| the Nix installer prints `Unable to run interactively`  | it ran through Claude's `!` prefix          | run it in a normal terminal              |
| `task` or `pnpm` runs, but the wrong version            | outside the dev shell, another tool's copy  | enter the dev shell; check `which task`  |
| `go: could not create module cache: mkdir /golang`      | `GOPATH` names a folder that cannot be made | set `GOPATH` to a folder in your home    |
| every new shell prints `(eval):1: parse error`          | the direnv hook line has no double quotes   | `eval "$(direnv hook zsh)"`              |
| every new shell prints `/Users/<you>/.envrc is blocked` | an `.envrc` in the home folder              | remove it, or `direnv allow` it          |
| `bind: address already in use` in `web:regression`      | another program holds port 8098 or 8099     | stop it while the gate runs              |
| `A snapshot doesn't exist at ...-darwin.png`            | the baselines are Linux shots               | none yet; the gate is red there on a Mac |

### The gate is red on a Mac

On a Mac, `task gate` ends `gate: red at web:regression`. The regression baselines are Linux shots, with names that end `-linux.png`. Playwright on a Mac looks for `-darwin.png` shots, finds none, writes them, and fails. A Linux shot and a Mac shot also draw text differently, so a copy of the Linux files fails too. The steps before `web:regression`, `web:typecheck` and `test`, are green. Do not commit the `-darwin.png` files that the run writes.

### Every day

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
