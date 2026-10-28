# The fresh-clone check

A clone of `protowx` in a directory that is beside nothing builds and
passes its gate. This page is that check. Run it before a tag, and
after a change that adds a path, a tool or a dependency.

## TL;DR

```sh
# Clone the local repository into /tmp, beside nothing.
# There is no ../go.work there, so .envrc leaves GOWORK unset.
git clone ~/devel/protowx-workspace/protowx /tmp/protowx-check
cd /tmp/protowx-check

# Nothing names the project the starter came from, a path above the root, or a word of its domain.
# Each pattern has a bracket, so this page does not match itself. Expect no output.
grep -rn 'shea[f]db\|shea[f]\|goo[h]m\|axi[s]' . --exclude-dir=node_modules --exclude-dir=.git

# Nothing climbs three directories. Expect no output.
grep -rn '\.\./\.\./\.\.' . --exclude-dir=node_modules --exclude-dir=.git

# Optional: put the whisper model in place, so the gate does not download 142 MB.
# task myw:model checks its hash, so a wrong file is downloaded again.
mkdir -p services/myw/source/model
cp ~/.cache/protowx/whisper/ggml-*.bin services/myw/source/model/ggml-model.bin

# Enter the dev shell. The first time builds the toolchain.
direnv allow

# Install the git hooks, then the web packages.
prek install
task web:install

# The gate, with docker on the machine. Expect the last line gate: green.
task gate
```

## What it checks

The starter is its own repository. The question is whether it reads
anything it does not hold.

| line               | what a hit means                                                |
|--------------------|-----------------------------------------------------------------|
| the first grep     | a word of the project the starter came from                     |
| the second grep    | a path that can leave the root                                  |
| `direnv allow`     | the flake builds from `flake.lock` alone                        |
| `task web:install` | the web packages resolve from `pnpm-lock.yaml`                  |
| `task gate`        | the Go modules resolve from the proxy, and every suite is green |

The Go modules resolve `ohm` and `adl` from the proxy. In the
workspace, `.envrc` sets `GOWORK` to `../go.work`, and the modules
build against the checkouts beside the starter. The clone in `/tmp`
has no `../go.work`, so the check tests the other way.

## Gotchas

- **The second grep is coarse.** It refuses every path that climbs
  three directories, also one that stays inside the repository. Write
  such a path in a different way. A Markdown link from deep in
  `docs/` starts at the root: `/docs/glossary.md`. The `ui` tests
  reach the app's stylesheet by the alias `@app`, which
  `web/packages/ui/vitest.config.ts` defines.
- **The gate needs docker.** Its step `web:regression:stack` builds
  the `bff` image and runs it as the compose project
  `protowx-regression`, on `127.0.0.1:8094`, with no tailnet. A
  stack of another project on another port does not stop it.
- **`task test` downloads the model once.** `myw:test` needs
  `ggml-base.en`, 142 MB, in `services/myw/source/model/`. The copy
  above takes it from the cache that `myw` writes when it runs.
- **The gate changes no file.** Its last step compares `git status
  --porcelain` before and after. A generator that writes a different
  file, or a new untracked file, turns the gate red at `clean tree`.
- **`go.work.sum` is committed.** A lone clone writes it on its first
  build: the sums that the four modules need together and that no
  `go.sum` holds. In the workspace, Go writes `../go.work.sum` in its
  place, so the committed file does not change there.

## Experiences

- 2026-10-28, Gary Miller with an agent, before the first tag,
  `v0.1.0`. The first grep found the comments of three web files and
  the pages of `services/myw`. The second found two links in
  `docs/product/` and one import in the `ui` tests. All were
  rewritten. The gate was then red at `clean tree`, on a new
  `go.work.sum`; the file is now committed, and the gate is green.
