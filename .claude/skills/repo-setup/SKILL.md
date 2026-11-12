---
name: repo-setup
description: Set up protowx on a Mac, or check a setup, step by step, and hand the person the steps that only they can do. Use this whenever a prompt says "set up the repo", "setup", "set up this Mac", "new machine", "a new clone", "a new worktree needs setting up", or "the dev shell does not load" — even when it never says "skill", "Nix" or "direnv".
---

# repo-setup: check each step, do the repository steps, hand over the rest

This skill is the Mac setup for an agent. A person reads the same steps, command first, in the section "Set up on a Mac" of `README.md`. Both cover macOS on Apple silicon only. Linux is not covered yet.

**The rule.** For each step, in order, run its check. When the check passes, say so and go on. When it fails, do the step, or hand it to the person. Then run the check again.

## Who does each step

- **You do** the steps inside the repository: `direnv allow`, the git config line, `prek install`, `task web:install` and `task gate`.
- **The person does** the Nix installer, in a normal terminal. Give the command and wait. The installer needs `sudo` and a real terminal. Your shell has no terminal, and Claude's `!` prefix gives none either.
- **The person does** each step that installs a program on the Mac: the Xcode Command Line Tools, Homebrew and Docker Desktop.
- **You propose, and the person approves,** each change to a file in the home folder: `~/.zshrc`, `~/.profile`, `~/.envrc`. Show the line to add, change or remove. Make the change only after the person says yes.
- **You propose, and the person approves,** each change to a program that is not protowx. Examples: `brew install direnv`, and stopping a server that holds a port.

## Before you start

- **Say the size.** The checks take a minute. The first `direnv allow` builds the toolchain, several minutes. The gate takes about 10 minutes, and its first run downloads the speech model, 142 MB.
- **Repeat the request back** in one sentence: "Set up `<the checkout path>` on this Mac, and run the gate."
- **Find the checkout.** Use the absolute path of the clone or the worktree in every command.

## Running from your shell

Your Bash shell has no direnv hook, and it can hold a stale environment. Start each call with this line:

```sh
export PATH=/nix/var/nix/profiles/default/bin:$PATH GOPATH=$HOME/go
```

- **Run each repository command through `direnv exec .`,** from the checkout: `cd <checkout> && direnv exec . task web:install`. The Bash tool resets the working directory between calls, so put the `cd` in the same call.
- **`direnv exec .` prints the dev shell's banner first.** It is not an error. Read the lines after it.
- **Outside `direnv exec .`, `task` and `pnpm` can be other copies.** On the first Mac, `which task` printed a shim of another tool manager. Run every `task`, `pnpm`, `go` and `prek` through `direnv exec .`.
- **Run the gate in the background,** with its output in a file: `cd <checkout> && direnv exec . task gate > /tmp/protowx-gate.log 2>&1`. Then read the lines that start `gate:`. The answer is the last of them. The lines above it are the output of the step that failed.
- **Run one gate at a time on the machine.** Its ports and its compose project are fixed.

## The steps

Run the checks in this order. A check passes when it does what the column "passes when" says. Run each check from the checkout.

| #   | step                     | check                                                          | passes when                        | fix                                                  | who                |
|-----|--------------------------|----------------------------------------------------------------|------------------------------------|------------------------------------------------------|--------------------|
| 1   | Xcode Command Line Tools | `xcode-select -p`                                              | it prints a path                   | `xcode-select --install`, then Install in the dialog | the person         |
| 2   | Homebrew                 | `command -v brew`                                              | it prints a path                   | install it from https://brew.sh                      | the person         |
| 3   | direnv                   | `command -v direnv`                                            | it prints a path                   | `brew install direnv`                                | you, once approved |
| 4   | Nix                      | `test -x /nix/var/nix/profiles/default/bin/nix`                | exit 0                             | the Determinate Systems installer, below             | the person         |
| 5   | the direnv hook          | `grep -qF 'eval "$(direnv hook zsh)"' ~/.zshrc`                | exit 0                             | add the line to the end of `~/.zshrc`                | you, once approved |
| 6   | Docker Desktop, running  | `docker info --format '{{.ServerVersion}}'`                    | it prints a version                | start Docker Desktop, or install it                  | the person         |
| 7   | a new terminal           | none from your shell                                           | the person says it opened          | the person opens a new terminal                      | the person         |
| 8   | the dev shell            | `direnv status`                                                | it prints `Found RC allowed 0`     | `direnv allow`                                       | you                |
| 9   | the shared git config    | `git config --local --get include.path`                        | it prints `../.gitshared`          | `git config --local include.path ../.gitshared`      | you                |
| 10  | the git hooks            | `test -f "$(git rev-parse --git-common-dir)/hooks/pre-commit"` | exit 0                             | `direnv exec . prek install`                         | you                |
| 11  | the web packages         | `test -d web/node_modules`                                     | exit 0                             | `direnv exec . task web:install`                     | you                |
| 12  | the gate                 | the last `gate:` line of `/tmp/protowx-gate.log`               | `gate: green`; on a Mac, see below | the step that the line names                         | you                |

The Nix installer, for step 4. Give the person this command to run in a normal terminal. It asks for a confirmation, then for the password.

```sh
curl -fsSL https://install.determinate.systems/nix | sh -s -- install
```

The hook line, for step 5. Keep the double quotes.

```sh
eval "$(direnv hook zsh)"
```

`direnv status` prints `Found RC allowed 1` when the `.envrc` is blocked. It also prints `No .envrc or .env loaded` in your shell, because your shell has no hook. That line is not a failure.

**A worktree** made by `task feature:new` needs steps 8, 10 and 11 again. Step 9 holds for every worktree of the clone: the git config is shared.

## The symptoms, and the check that finds each first

Each of these happened on the first Mac. Each check finds its symptom before the gate does.

| symptom                                                 | the check that finds it first                                  | fix                                                 | who                |
|---------------------------------------------------------|----------------------------------------------------------------|-----------------------------------------------------|--------------------|
| the Nix installer prints `Unable to run interactively`  | step 4; never run the installer from your shell                | the person runs it in a normal terminal             | the person         |
| `task` or `pnpm` runs, but the wrong version            | `direnv exec . which task pnpm go`: each path is `/nix/store/` | run the command through `direnv exec .`             | you                |
| `go: could not create module cache: mkdir /golang`      | `direnv exec . sh -c 'mkdir -p "$(go env GOMODCACHE)"'`        | set `GOPATH` to `$HOME/go` in the file that sets it | you, once approved |
| every new shell prints `(eval):1: parse error`          | step 5; the hook line has no double quotes                     | replace the line with the quoted form               | you, once approved |
| every new shell prints `/Users/<you>/.envrc is blocked` | `test ! -e ~/.envrc`                                           | remove `~/.envrc`, or `direnv allow` it             | you, once approved |
| `bind: address already in use` in `web:regression`      | `lsof -nP -iTCP:8098 -iTCP:8099 -iTCP:8094 -sTCP:LISTEN`       | stop the program that holds the port                | you, once approved |
| `A snapshot doesn't exist at ...-darwin.png`            | `uname -s` prints `Darwin`                                     | none yet; report it                                 | nobody             |

- **The `GOPATH` check.** `grep -n GOPATH ~/.profile ~/.zprofile ~/.zshrc ~/.zshenv` finds the file that sets it.
- **The port check.** The check passes when `lsof` prints nothing. Read the output, not the exit status: `lsof` exits 1 when one of the ports is free. When it prints a line, `ps -p <PID> -o command=` names the program. Show the person the program, and ask before you stop it.
- **The `-darwin.png` symptom.** Do not take baselines, and do not commit the `-darwin.png` files that the run writes.

## The gate on a Mac

On a Mac, the gate ends `gate: red at web:regression`. The regression baselines are Linux shots, with names that end `-linux.png`. Playwright on a Mac looks for `-darwin.png` shots, finds none, and fails. This is expected, and it is not a setup fault. The setup is complete when the steps before it, `web:typecheck` and `test`, are green. Mark step 12 not ticked, and say why in its line.

## The end of a run

Report the map: every step, ticked or not, with one line each. Then write one next action. An example, on a Mac:

```text
[x] 1  Xcode Command Line Tools
[x] 2  Homebrew
[x] 3  direnv
[x] 4  Nix
[x] 5  the direnv hook
[x] 6  Docker Desktop, running
[x] 7  a new terminal
[x] 8  the dev shell
[x] 9  the shared git config
[x] 10 the git hooks
[x] 11 the web packages
[ ] 12 the gate: red at web:regression, as expected on a Mac; web:typecheck and test are green
next: nothing to set up; run task web:dev for the page
```

When a step waits for the person, the next action is that step, in their words: the command to run, or the change to approve.
