# deploy

The repo-wide rules are in the root `AGENTS.md`. This file covers
`deploy/`: ways to run this repository's services together.

| directory  | holds                                                                |
|------------|----------------------------------------------------------------------|
| `compose/` | the compose stack on a tailnet, and the regression stack without one |

| part                 | listens on                    | from the tailnet                         |
|----------------------|-------------------------------|------------------------------------------|
| `bff`                | `127.0.0.1:8080`              | `https://protowx-<branch>.<domain>/`     |
| `myw`                | `127.0.0.1:8090`              | `https://protowx-<branch>.<domain>:8443` |
| Jaeger               | joins with the traces         | `https://protowx-<branch>.<domain>:8445` |
| the regression `bff` | `127.0.0.1:8094`, on the host | no tailnet                               |

- **`deploy/` is not an infrastructure project.** It builds from this
  repository's source, in its dev shell, and is part of it.
- **The stack is one person's.** It keeps the engine API on, on that
  person's own tailnet. The root `AGENTS.md` holds the rule; a stack
  that serves anyone else turns `--api` off.
- **No service publishes a port.** `ts` is the stack's only network;
  `bff` and `myw` share its namespace and listen on loopback.
  `task compose:check` fails on a `ports` or `expose` entry.
- **The regression stack is the one exception.**
  `compose/compose.regression.yaml` has no tailnet. Its `bff` publishes
  `8094` on `127.0.0.1` only, for the regression suite. It names no
  `TS_` variable; `task compose:check` holds that.
- **`ts` runs in kernel mode.** In userspace mode `tailscaled` forwards
  a tailnet connection to the same port on loopback, and `bff` and
  `myw` would answer on the tailnet past Serve. `task compose:closed`
  holds it, from a peer.
- **The images build in the flake's `build` shell**, from `nixos/nix`,
  with the tasks a developer runs. Do not add a `golang` or `node`
  image: that is a second toolchain. A tool the build needs goes in
  `mkBuildPackages`, in `flake.nix`.
- **Docker is not in the dev shell.** The `compose:` tasks need it on
  the machine.
- **`task compose:up` with a real `TS_AUTHKEY` makes a node on the
  tailnet.** An agent does not run it, nor `task compose:closed`,
  unless the user asks. `task compose:authkey`,
  `task compose:check`, `task compose:build` and the regression stack
  touch no tailnet.
- **The auth key expires, and only `.envrc.local` knows when.**
  `TS_AUTHKEY_EXPIRE` holds the date, and
  `scripts/compose/authkey.sh` reads it: a warning a week before, an
  error after, and `task compose:up` stops on the error. The script
  counts the days itself, because `date(1)` parses a date one way on
  GNU and another on BSD.
- **The trace viewer is not here yet.** Jaeger and `bff --otlp-url`
  join with the traces. Until then the stack has no `:8445`.

[compose/README.md](compose/README.md) is how to run the stack;
[docs/devtools/compose-tailscale.md](../docs/devtools/compose-tailscale.md)
is the credential and the gotchas;
[docs/product/admin_manual/running-the-stack.md](../docs/product/admin_manual/running-the-stack.md)
is the admin's task page.
