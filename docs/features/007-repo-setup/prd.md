# repo-setup

This feature writes down how to set up protowx on a Mac, twice: once for a person, as a section of `README.md`, and once for an agent, as a Claude skill that does the setup and checks each step. Both carry the same steps, in the same order, and the same lessons. The steps are the ones that took a fresh Mac to a working dev shell between 2026-11-05 and 2026-11-12.

Status: both phases are built. `README.md` has the section "Set up on a Mac", and `.claude/skills/repo-setup/SKILL.md` is the skill, named in `CLAUDE.md`. No fresh agent has run the skill yet. The gate on a Mac is still red at `web:regression` (section 4).

## Decisions at a glance

Each concern is a heading; the ticked line is the decision, and each unticked line is a runner-up. To change a decision, move the tick and say why in the section the concern cites.

### where the person reads the steps (section 2)

- [x] **A section of `README.md`, "Set up on a Mac".** The README is the first page a new person opens, and today it gives only `direnv allow`.
- [ ] A page in `docs/devtools/`, linked from the README. One more click, and the first page still hides the machine steps.

### what the agent follows (section 3)

- [x] **A skill, `.claude/skills/repo-setup/SKILL.md`, with a line in `CLAUDE.md`** that says when to invoke it, as the three skills there have.
- [ ] A section in `AGENTS.md`. Every agent would load it on every prompt, for a task done once per machine.

### the systems covered (section 1)

- [x] **macOS on Apple silicon (`aarch64-darwin`) only.** It is the one system the steps were run on.
- [ ] macOS and Linux. Nobody has run the Linux steps yet, and a page of untested steps teaches the wrong ones.

### how Nix is installed (section 2.1)

- [x] **The Determinate Systems installer.** It turns on flakes, which `.envrc` needs, and it ships an uninstaller.
- [ ] The official installer from nixos.org. Flakes must then be turned on by hand in `nix.conf`.

### where direnv comes from (section 2.1)

- [x] **Homebrew, `brew install direnv`.** Homebrew is on most Macs, and direnv must exist before the dev shell does.
- [ ] `nix profile install nixpkgs#direnv`. One tool fewer, but a second Nix concept on day one.

### which steps the agent does itself (section 3.2)

- [x] **The agent checks every step, does the steps inside the repository, and hands the rest to the person.** The person installs Nix (it needs `sudo` and a real terminal) and approves every change to a file in their home folder.
- [ ] The agent does every step. It cannot: the Nix installer refuses to run without a terminal, and Claude's `!` prefix gives it none.

### a check script (section 3.3)

- [x] **No script. The skill lists each check as a shell command.**
- [ ] `task setup:check`, which runs every check and prints one line each. The README and the skill would both call it. It is a change to `Taskfile.yml` and `scripts/`, more than this feature was asked for.

### the regression screenshots on a Mac (section 4)

- [x] **Out of this feature. The README and the skill say that the gate is red at `web:regression` on a Mac, and why.** The fix is a separate decision: a Linux container for the browser, a second set of baselines, or a gate that skips the shots on a Mac.
- [ ] Fix it here. It is an afternoon of work on the regression suite, unrelated to the setup steps.

### regression scenarios

- [ ] `repo-setup`, the feature's own: the `todo` that `task feature:new` wrote.
- [x] **none.** The feature changes nothing on the page. The plan deletes the `todo` scenario.

### visual diff

- [ ] yes: the scenarios take shots, and the plan takes their baselines.
- [x] **no.** No scenario, so nothing to shoot.

## 1. Scope

The reader is a person or an agent with a Mac and a clone of protowx. At the end, they are in the dev shell, the git hooks are installed, the web packages are installed, and the gate has run. On a Mac the gate ends `gate: red at web:regression` until section 4 is decided.

Outside the scope: Linux, the tailnet and ngrok stacks (each has its page in `docs/devtools/`), and the workspace layout with `../go.work`.

## 2. The steps for a person

### 2.1 Once per Mac

1. `xcode-select --install`. It installs the Xcode Command Line Tools, which give `git` and the other developer tools. The full Xcode app is not needed.
2. Homebrew. The steps assume it is there.
3. `brew install direnv`.
4. Nix, from the Determinate Systems installer, in a normal terminal: `curl -fsSL https://install.determinate.systems/nix | sh -s -- install`. It asks for a confirmation and for the password.
5. The direnv hook, at the end of `~/.zshrc`: `eval "$(direnv hook zsh)"`. The double quotes matter. Without them, zsh joins the hook's lines into one and every new shell prints `(eval):1: parse error near 'then'`.
6. Docker Desktop, running. The gate builds an image and starts it.
7. Open a new terminal.

### 2.2 Once per clone

1. `cd` into the clone and run `direnv allow`. The first time, Nix builds the whole toolchain; it takes several minutes.
2. `git config --local include.path ../.gitshared`. The dev shell's banner asks for it; it adds the aliases `st`, `ls`, `lg` and `co`.
3. `prek install`, for the git hooks.
4. `task web:install`, for the web packages.
5. `task gate`. The first run downloads the speech model, 142 MB.

A worktree made by `task feature:new` needs steps 1, 3 and 4 again. Step 2 holds for every worktree of the clone. The web packages are a folder in the worktree, `web/node_modules`; the worktree of this feature had none.

### 2.3 What went wrong, and its fix

Each of these happened on the first Mac. The README lists them as a table: the symptom, the cause, the fix.

| symptom                                                 | cause                                       | fix                                      |
|---------------------------------------------------------|---------------------------------------------|------------------------------------------|
| the Nix installer prints `Unable to run interactively`  | it ran through Claude's `!` prefix          | run it in a normal terminal              |
| `task` or `pnpm` runs, but the wrong version            | outside the dev shell, another tool's copy  | enter the dev shell; check `which task`  |
| `go: could not create module cache: mkdir /golang`      | `GOPATH` names a folder that cannot be made | set `GOPATH` to a folder in your home    |
| every new shell prints `(eval):1: parse error`          | the direnv hook line has no double quotes   | `eval "$(direnv hook zsh)"`              |
| every new shell prints `/Users/<you>/.envrc is blocked` | an `.envrc` in the home folder              | remove it, or `direnv allow` it          |
| `bind: address already in use` in `web:regression`      | another program holds port 8098 or 8099     | stop it while the gate runs              |
| `A snapshot doesn't exist at ...-darwin.png`            | the baselines are Linux shots (section 4)   | none yet; the gate is red there on a Mac |

## 3. The skill for an agent

### 3.1 When it runs

A prompt says "set up the repo", "setup", "set up this Mac", "new machine", or "the dev shell does not load". The `CLAUDE.md` line names it, as it names the other three skills.

### 3.2 What it does

For each step of section 2, in order: run its check; when the check passes, say so and go on; when it fails, do the step or hand it over.

- **The agent does:** `direnv allow`, the git config line, `prek install`, `task web:install`, `task gate`. It runs each through `direnv exec .` when its own shell has no hook, and the gate in the background with its output in a file under `/tmp`.
- **The person does:** the Nix installer, in a normal terminal. The agent gives the command and waits.
- **The agent proposes, and the person approves:** each change to a file in the home folder: `~/.zshrc`, `~/.profile`, `~/.envrc`. Each change to a program that is not protowx, such as stopping a server that holds a port.

The skill ends with the map: each step, ticked or not, and the one next action.

### 3.3 The checks

Each check is one shell command with a clear yes or no. Examples: `command -v direnv`; `test -x /nix/var/nix/profiles/default/bin/nix`; `grep -qF 'eval "$(direnv hook zsh)"' ~/.zshrc` (without `-F`, the grep of macOS does not match the line); `go env GOMODCACHE` names a folder that can be made; `lsof -iTCP:8098 -iTCP:8099 -sTCP:LISTEN` prints nothing. The skill lists them; the plan writes them.

## 4. The regression screenshots on a Mac

The baselines in `web/regression/scenarios/` are `-linux.png` files. Playwright names a shot after the system, so on a Mac it looks for `-darwin.png` files, finds none, writes new ones, and fails. A Linux and a Mac shot also differ in how they draw text, so a copy of the Linux files would fail too. The gate is therefore red at `web:regression` on every Mac, before and after this feature.

This feature documents that. The fix is its own decision, with three options:

- A Linux container that runs the browser, so one set of baselines serves every machine. The `adlc` compiler has no ARM Linux build, so on a Mac the container runs x86 Linux under emulation.
- A second set of baselines, `-darwin.png`. A page change made on Linux leaves that set stale, and the Mac gate goes red.
- A gate that skips the shots on a Mac and says so in its last line. A page change that breaks a shot then passes on a Mac without notice.
