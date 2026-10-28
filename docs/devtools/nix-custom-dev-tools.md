# A custom tool in the dev shell

How a Go program in `wxio/repo-tools` becomes a command on your
`PATH` here. Read it before you bump the tools, add a fifth command, or
debug a `command not found` from a git hook.

What the four commands do is not on this page. `md-table-fmt` and the
three `prompt-history` commands are documented in their own repository:

- <https://github.com/wxio/repo-tools/tree/main/docs>, from anywhere;
- `tools/docs/md-table-fmt.md` and `tools/docs/prompt-history.md` in
  a `protowx-workspace` checkout, where `tools/` sits beside this
  repository.

## The commands

```sh
# In this repository, protowx.
nix flake metadata --no-update-lock-file  # what is pinned, and to which commit
nix flake update repo-tools            # move the pin to a newer commit
direnv reload                             # rebuild the shell after a bump
command -v repo-tools                     # proof the commands are on PATH

# In wxio/repo-tools, when you change a tool.
nix build                                 # build the four commands into ./result
nix develop                               # a shell to work on them
```

`nix flake metadata` prints the tree that this page explains:

```
Inputs:
├───nixpkgs: github:NixOS/nixpkgs/aa48d34 (2026-10-05 09:07:57)
├───ohm-go: github:ohmjs/ohm-go/39a1186
└───repo-tools: github:wxio/repo-tools/9440ab2
    └───nixpkgs follows input 'nixpkgs'
```

## 1. The chain, end to end

Four files carry a command from its source to your shell.

| step | file                            | what it does                              |
|------|---------------------------------|-------------------------------------------|
| 1    | `repo-tools/flake.nix`          | builds the four commands into one package |
| 2    | `protowx/flake.nix` inputs      | names the tools repository and its scheme |
| 3    | `protowx/flake.lock`            | pins the commit and the resulting tree    |
| 4    | `protowx/flake.nix` `devShells` | puts the package's `bin` on your `PATH`   |

`prek.toml` and `.claude/settings.json` then name a command and not a
path. Both hooks set `language = "system"`, which tells `prek` to build
no environment of its own and to run the entry from `PATH`. The dev
shell is what supplies it.

## 2. Nix does not detect Go

There is no language detection in Nix. Nothing scans for a `go.mod`. A
person chose a builder, and that builder knows Go. The choice is one
line in `repo-tools/flake.nix`:

```nix
mkTools = pkgs: pkgs.buildGo127Module { ... };
```

`buildGoModule` is an ordinary function in nixpkgs. It returns a
derivation with the Go steps filled in. It puts the compiler in the
build environment, unpacks the source in a sandbox, runs `go build`,
and copies the binaries to `$out/bin`. `buildGo127Module` is the same
function with `go_1_27` bound instead of the nixpkgs default.

**Nix never reads the `go` line in `go.mod`.** That file asks for
1.27.1. A person read it and picked the matching builder by hand. The
two can drift apart, and only a build failure tells you. Bump both in
the same commit.

Go names each binary after its directory, so `cmd/md-table-fmt` makes
`$out/bin/md-table-fmt`. The command names come from Go, not from Nix.

## 3. The attributes the builder takes

| attribute           | what the builder does with it              |
|---------------------|--------------------------------------------|
| `src = ./.`         | copies the whole repository into the store |
| `vendorHash = null` | skips the dependency stage; see section 4  |
| `subPackages`       | builds only these `main` packages          |
| `pname`, `version`  | name the derivation                        |

Without `subPackages` the builder runs `go build ./...`. The list is
there so a new `internal` package does not become a binary.

**A fifth command needs two edits.** Add `cmd/<name>` to `subPackages`,
and add the row to the dev shell `shellHook` banner. Neither is
inferred from the directory.

## 4. Why `vendorHash` is null

A Nix build has no network. A normal Go module needs downloads, so
`buildGoModule` splits the work in two:

1. A fixed-output derivation runs `go mod download`. This stage is
   allowed network, because `vendorHash` pins the exact result.
2. The real build runs offline against that output.

`repo-tools/go.mod` has no `require` block. The four commands depend
on the standard library alone. `null` tells the builder to skip stage 1.
That is the whole reason there is no `vendor` directory to keep current.

**The first dependency changes this.** Set `vendorHash` to
`lib.fakeHash`, run the build, and read the right hash off the failure.

## 5. Two Go toolchains, and what `follows` buys

Two toolchains are in play, and they are easy to confuse.

| toolchain      | where it lives                     | what it is for          |
|----------------|------------------------------------|-------------------------|
| build-time Go  | inside the tools derivation        | compiling the commands  |
| dev-shell `go` | the `packages` list in `flake.nix` | your `go build` by hand |

The build-time one is in the derivation's own inputs. It lives in the
build sandbox, which cannot see your shell. A Nix build never reads
`PATH` from the caller.

**Remove `go_1_27` from the dev shell and the tools still build.** What
breaks is your own work: `go.work` uses `engine`, `clis`,
`services/bff` and `services/myw`, and every `task` target that calls
`go` fails. The line is there for the starter's sources, not for the
tools.

The built commands need no Go to run. Go links them, and the toolchain
is not in their runtime closure.

This line is what collapses the two:

```nix
inputs.repo-tools.inputs.nixpkgs.follows = "nixpkgs";
```

Both toolchains exist either way. `follows` makes them the same store
path. Without it the tools flake keeps its own `flake.lock` nixpkgs
revision, which is almost certainly a different one, and you fetch a
second Go toolchain for no gain.

## 6. How Nix fetches the tools

**`wxio/repo-tools` is public, and `flake.nix` names it as
`github:wxio/repo-tools`.** That scheme does not use git. Nix fetches a
tarball of the commit from the GitHub HTTPS API, with no key and no
token. Anyone can evaluate this flake, and so can CI.

The input is still called `repo-tools`. That is the name of the
package and the binary, and `.envrc` overrides the input by that name.
The repository name is in the URL only.

The lock file records the commit and the tree:

```json
"owner":   "wxio",
"repo":    "repo-tools",
"rev":     "d70ad0c7b1e5ebfe967d481cd39a659f8ad0b6ba",
"narHash": "sha256-eZeCn5249JDAkNOz5RySi/ZUNqNKU1eMymXLulsp6sw=",
"type":    "github"
```

`rev` fixes the commit. `narHash` fixes the resulting tree, so a force
push cannot change what you get.

**If the repository goes private again**, `github:` needs a token in
`nix.conf` under `access-tokens`. The other choice is `git+ssh://`. For
that scheme Nix runs the real `git`, which runs `ssh` as you, at
evaluation, so your keys, your agent and your `insteadOf` rules apply.

| fetcher                         | runs as         | a private repo             |
|---------------------------------|-----------------|----------------------------|
| a flake input, `github:`        | you, at eval    | needs `access-tokens`      |
| a flake input, `git+ssh://`     | you, at eval    | works; your keys and agent |
| `pkgs.fetchgit` in a derivation | the daemon user | fails; no keys, no agent   |

### Experience: an `insteadOf` rule that did not match

2026-10-15, Gary Miller. The input was `git+ssh://` then, and the
workspace used one deploy key per repository. A global `insteadOf` rule
sent `git@github.com:wxio/repo-tools` to a host alias with the right
key. Nix asks for `ssh://git@github.com/wxio/repo-tools`, which is
the other URL form, so the rule did not match. `ssh` used the default
key, and GitHub answered `Repository not found`.

`nix flake update` did not fail. It printed `using expired cached ref`
and pinned the commit in its cache, one commit behind `main`. Read the
warnings of a bump, and compare the new `rev` with `git ls-remote`.
An `insteadOf` rule for the `ssh://` form fixes it, and the public
`github:` input makes it go away.

## 7. Bumping the pin

```sh
nix flake update repo-tools
direnv reload
```

The first command moves `flake.lock` to the head of `refs/heads/main`.
The second rebuilds the shell. Commit `flake.lock` with the change that
needs the new commands.

The build happens on demand. `nix develop` finds the derivation is not
in the store and builds it then. After that the store entry is reused
until the lock moves.

## 8. Working on the tools, without a push

A change to a tool reaches this repository through a commit, a push and
`nix flake update`. That is three steps too many while you are still
finding the shape of a fix. `--override-input` points the input at a
checkout instead, for the length of one command.

```sh
nix develop --override-input repo-tools "path:$PWD/../tools"
```

`.envrc` does it for you, from one environment variable. There is a
file to copy:

```sh
cp .envrc.local.example .envrc.local
direnv reload
```

`.envrc.local` is one `export REPO_TOOLS_DEV=...` line, and
`.gitignore` holds it. The shell banner then reads `LOCAL, from
REPO_TOOLS_DEV` where it read `pinned d70ad0c`. Delete the file and
reload to go back.

### ohm-cli, from OHM_GO_DEV

`ohm-cli` works the same way, through a second variable. The flake
builds it from the `ohm-go` input, so the override names that input:

| variable         | input        | checkout    | builds                             |
|------------------|--------------|-------------|------------------------------------|
| `REPO_TOOLS_DEV` | `repo-tools` | `../tools`  | the four git hook tools            |
| `OHM_GO_DEV`     | `ohm-go`     | `../ohm-go` | `ohm-cli`, the grammar test runner |

Set either, or both. The banner names the mode of each. The bump task
of `ohm-cli` is `task nix:update-ohm-cli`. It also writes the new
`vendorHash` into `flake.nix`, since `ohm-cli`'s `go.sum` moves with
the input.

**The `ohm-go` input follows a tag, not `main`.** Its URL is
`github:ohmjs/ohm-go?ref=ohm-cli/v1.1.0`. The `main` of `ohm-go` is
older than that tag: it has no `--strict` and no `error` kind, and
`task calc:grammar-test` uses both. To move the pin, change the `ref`
in `flake.nix` to the newer tag, then run `task nix:update-ohm-cli`.

**The local `ohm-cli` is not a nix build.** The pinned one is: nix
vendors `ohm-cli`'s modules under `GOWORK=off`, so it builds against
the `ohm` module that `ohm-cli/go.mod` requires, from the proxy. A
checkout whose `ohm/` has a change that `ohm-cli` uses then fails with
`undefined: ohm.X`, and a vendor of the whole workspace would need a
`vendorHash` that moves with every `go.sum` of the checkout. So, in
local mode, the shellHook builds the checkout with the shell's Go,
through the checkout's own `go.work`, which joins `ohm-cli` to `ohm/`.
There is no hash to keep. The binary is
`~/.cache/protowx/ohm-cli/ohm-cli`, first on `PATH`; `direnv reload`
builds the working tree again. Go's module cache serves the build, so
a module the checkout newly requires is fetched once, by Go.

### A relative path works, under direnv

The example ships `../tools`, which is the sibling checkout of a
`protowx-workspace` clone. It works from any directory of this
repository, because direnv reads `.envrc` from beside itself and
resolves the path from there.

**Typing `nix develop` yourself is the other case.** Nix resolves a
relative `path:` from your working directory, not from the flake:

```sh
cd protowx      && nix develop --override-input repo-tools "path:../tools"   # works
cd protowx/web  && nix develop .. --override-input repo-tools "path:../tools"
# error: path '.../protowx/tools/flake.nix' does not exist
```

So: relative in `.envrc.local`, absolute when you type the flag.

### What it does, and does not, touch

| it changes          | it leaves alone                        |
|---------------------|----------------------------------------|
| the input, this run | `flake.lock`, on disk and in the index |
| the store path      | every tracked file                     |

**Nothing in the worktree changes.** `--override-input` is a flag, not
an edit. The lock file keeps the pinned `rev` and `narHash`, so the
switch is invisible to `git status` and a commit made in either mode is
the same commit. `.envrc.local.example` is tracked, and `.envrc.local`
is not.

**It builds your working tree, not your last commit.** The `path:`
scheme copies the directory as it stands, so an uncommitted edit is in
the build. There is no commit and no push in the loop.

**It fetches nothing.** A `path:` input is read from disk, so nix needs
no network, and section 6 does not apply.

### The explicit build step

`--override-input` is nix, so every reload is a real build:
`buildGo127Module` in a sandbox, not `go build` in your cache. Tens of
seconds, not one.

Nothing watches the Go sources either. `.envrc` watches the tools
`flake.nix` alone, because a reload per keystroke would be a rebuild per
keystroke. So the loop has a step you type:

```sh
# edit ../tools/mdtablefmt/
direnv reload
repo-tools md-table-fmt -n docs/devtools/nix-custom-dev-tools.md
```

Use `go run . md-table-fmt` inside the tools checkout for the fast
inner loop, and this mode to check the thing the hooks will actually
run.

### What it reaches

Both hooks resolve a bare command name through `PATH`, and `PATH` is
what the shell sets. So the override reaches them with no further
wiring:

| caller                              | gets the override                         |
|-------------------------------------|-------------------------------------------|
| `repo-tools md-table-fmt` by hand   | yes                                       |
| `prek run`, and the pre-commit hook | yes                                       |
| the Claude Code `Stop` hook         | yes, if Claude Code started in this shell |

The last row is the one to watch. A hook inherits the environment of the
process that spawned it, so a Claude Code started outside the dev shell
has neither mode on its `PATH`.

### Landing the change

The override is a local state and nobody else sees it. Land the work the
ordinary way:

```sh
# in the tools checkout
git commit && git push
# here
nix flake update repo-tools
direnv reload
```

Then unset `REPO_TOOLS_DEV`, reload once more, and check the banner
reads `pinned <rev>` again. Section 7 is the page for the bump.

## 9. Which `go.work` is in use

The Go switch is not a flake input. It is `GOWORK`, which `.envrc`
sets before it loads the flake. The starter has two `go.work` files,
and neither has a `replace` line:

| file                    | its `use` lines                             | when it is in use           |
|-------------------------|---------------------------------------------|-----------------------------|
| `go.work`, here         | the four modules of the starter             | by default                  |
| `../go.work`, workspace | the four, and `adl-go`'s and `ohm-go`'s two | when it names this checkout |

`.envrc` exports `GOWORK` as the workspace's file when `../go.work`
exists and names `./<this directory>/engine`. A lone clone has no
`../go.work`, and a worktree at `../protowx-<name>` is not named in it,
so each builds from its own file. The banner says which file is in
use. `GOWORK=off` in `.envrc.local` turns the switch off for one
checkout.

With the workspace's file, the starter imports `adl-go/adl` and
`ohm-go/ohm` from the checkouts beside it, and `go tool goadlc` runs
the checkout's generator. With its own file, each comes from the
proxy, at the version the `go.mod` files require. No tracked file
changes between the two.

## When something goes wrong

- **`repo-tools: command not found` in a git hook**: you are not in
  the dev shell, or the shell predates the tool. Run `direnv allow` in
  this directory, then `direnv reload`. A git worktree needs its own
  `direnv allow`.
- **`Permission denied (publickey)` while evaluating**: `ssh` picked the
  wrong key. With no `Host github.com` block in `~/.ssh/config`, it uses
  the default identity. Add a block, or load the right key with
  `ssh-add`. Test it with `ssh -T git@github.com`.
- **An `insteadOf` rule does not fire**: Nix normalises a flake URL to
  `ssh://git@github.com/owner/repo`, as the lock file shows. Git matches
  `insteadOf` on a literal prefix, so a rule written in the scp-style
  `git@github.com:owner/` form never matches. Write a second rule in the
  `ssh://` form.
- **The build fails on a Go version**: `go.mod` and the builder have
  drifted apart. Read section 2.
- **The build cannot reach the network**: a dependency was added without
  a `vendorHash`. Read section 4.
- **An edit in the tools checkout does not show up**: `direnv` caches
  the shell and watches no Go source. Run `direnv reload`. Read section
  8.
- **`REPO_TOOLS_DEV` is set and the banner still says `pinned`**:
  `direnv` read `.envrc` before the variable existed. Export it, then
  `direnv reload`. Under plain `nix develop` the variable does nothing:
  that path needs the `--override-input` flag typed out.
- **`path '.../flake.nix' does not exist` from `nix develop`**: a
  relative `path:` resolves from your working directory, and you are
  not in the repository root. Type the absolute path. Read section 8.
- **`directory not in go.work`, or a library change is not seen**:
  the wrong `go.work` is in use. Read the banner, then section 9.

Next: the root `AGENTS.md`, "Development environment", for the rest
of the shell, or the tools repository docs above for what the four
commands do.
