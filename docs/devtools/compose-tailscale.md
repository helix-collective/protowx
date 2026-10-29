# The compose stack on a tailnet

## TL;DR

```sh
# In the repository root, in the dev shell, with docker on the machine.
# Check the file: it resolves, publishes no port, and needs TS_DOMAIN. No tailnet.
task compose:check

# Build the two images: bff and myw. No tailnet.
task compose:build

# The days the auth key has left. No tailnet.
task compose:authkey

# Build and start, as the node protowx-<branch>. Needs TS_AUTHKEY and TS_DOMAIN.
task compose:up

# Follow the logs.
task compose:logs

# From another node of the tailnet: bff's and myw's own ports are closed.
task compose:closed

# Stop. The volumes stay.
task compose:down
```

`task compose:up` runs `bff` and `myw` in docker, behind one tailnet
node, `protowx-<branch>`. It is the one-node way to run both: one
credential, one state volume, one name, and HTTPS from Tailscale
Serve. Open `https://protowx-<branch>.<domain>/`. The transcription
is on `:8443`. The trace viewer, Jaeger on `:8445`, joins with the
traces.
[deploy/compose/README.md](../../deploy/compose/README.md) is the stack:
the services, the routes and the images. This page is the credential,
`TS_DOMAIN`, kernel mode and the gotchas.

Docker is not in the dev shell. Install it on the machine, and run the
tasks from the dev shell, which has `task` and loads `.envrc.local`.

The regression stack, `task compose:regression-up`, needs none of the
credentials on this page: it has no tailnet node, and it unsets each
`TS_` variable before it builds.

## 1. The credential

The node is `ts`, the `tailscale/tailscale` image. It reads
`TS_AUTHKEY` at its first start and keeps its identity in the volume
`ts-state`. Later starts need no key.

**Make a key.** Open the admin console,
<https://console.tailscale.com/admin/settings/keys>. Select **Generate
auth key**. Set these options:

| option       | set | why                                                    |
|--------------|-----|--------------------------------------------------------|
| Reusable     | on  | one key for all your branches                          |
| Expiration   | 90  | the maximum; the key, not the node, expires            |
| Ephemeral    | off | an ephemeral node is deleted when it goes offline      |
| Pre-approved | on  | needed only when device approval is on for the tailnet |
| Tags         | any | optional; a key with tags makes a tagged node          |

Copy the key. The console shows it once. Put it in `.envrc.local` at
the repository root, beside the domain:

```sh
export TS_AUTHKEY=tskey-auth-...
export TS_AUTHKEY_EXPIRE=20270127   # the key's expiry, YYYYMMDD
export TS_DOMAIN=tail1234.ts.net
```

Then run `direnv reload`. Pass other `tailscale up` flags in
`TS_EXTRA_ARGS`. `.envrc.local.example` has all three lines.

**Write the expiry date down.** The console shows the expiry with the
key, and the key itself does not carry it. Nothing in the stack can
ask the tailnet, so `TS_AUTHKEY_EXPIRE` is the one record. A key
made today with the maximum 90 days expires on the date the console
gives; copy it in as `YYYYMMDD`.

`task compose:authkey` then counts the days left:

| days left     | what happens                                       |
|---------------|----------------------------------------------------|
| more than 7   | one line: the days left and the date               |
| 7 to 0        | a warning, with the link to the console            |
| past the date | an error; `task compose:up` stops before it builds |

`task compose:up` runs the check first, so an expired key stops the
start and names its fix. Three things turn the check off:

- **No `TS_AUTHKEY`.** The check exits at once. `task compose:build`
  and the regression stack, which need no key, never see it.
- **No `TS_AUTHKEY_EXPIRE`.** The check says the expiry is unknown and
  passes.
- **A value that is not a date.** The check says so and passes. The
  placeholder `YYYYMMDD`, from `.envrc.local.example`, is such a
  value.

A node that is already on the tailnet keeps its identity in the volume
`ts-state` and needs no key. Unset `TS_AUTHKEY` to start that node
with an expired key still in your shell.

## 2. TS_DOMAIN

The stack's binaries do not join the tailnet, so none can read the
domain from its own node name. The stack is told it, for two flags:
`bff`'s `--myw-url https://protowx-<branch>.<domain>:8443`, and
`myw`'s `--origin`. Compose refuses to start without it, and names the
variable.

Find the domain in the admin console, **DNS**, "Tailnet name". Serve
itself needs no domain: the image writes the node's name into
`${TS_CERT_DOMAIN}` in `serve.json`.

## 3. Kernel mode

`ts` runs with `TS_USERSPACE=false`, the device `/dev/net/tun` and the
capability `NET_ADMIN`. Keep it so.

- **Userspace mode opens the services' own ports.** There,
  `tailscaled` takes a tailnet connection itself and dials the same
  port on loopback. `bff` listens on `127.0.0.1:8080`, so it would
  answer `protowx-<branch>:8080`, past Serve, and so would `myw`.
- **Kernel mode keeps them closed.** The connection arrives on
  `tailscale0`, and a socket bound to `127.0.0.1` never takes it.
- **The runner-up** was userspace mode with an ACL that grants the
  Serve ports alone. That guard is in the admin console, and this
  repository cannot test it.

`task compose:closed` is the test. Run it on another node of the
tailnet, with `TS_DOMAIN` set. It asks `https://<node>/healthz` first,
so a closed port is told from a node that is not there.

## 4. Gotchas

- **The node name is the branch.** `feature/X` is
  `protowx-feature-x`. A detached HEAD is `protowx`.
- **A second stack on the same branch is the same project.** Two
  worktrees on two branches are two stacks and two nodes.
- **`task compose:down -- --volumes` forgets the node.** The next start
  is a new node and reads `TS_AUTHKEY` again. Delete the old node in
  the admin console, **Machines**, first.
- **The images build in the `build` shell, not the default one.** The
  flake's `devShells.build` has the tools the build tasks call: Go,
  `task`, Node, pnpm, `adlc`, whisper.cpp and libffi. The default
  shell adds the Playwright browsers and the hooks. A tool that the
  build needs goes in `mkBuildPackages`, in `flake.nix`.
- **The first build is long.** The shell stage builds whisper.cpp
  without SDL from source, because `cache.nixos.org` does not hold it.
  Later builds reuse the layer until `flake.nix` or `flake.lock`
  changes.
- **A full disk looks like a network fault.** Nix writes `No space left
  on device`, then `some substitutes ... failed (usually happens due to
  networking issues)`. The second line is wrong; read the first.
  `task compose:up` and `task compose:build` refuse to start when
  Docker's disk has less than 6 GB free. `MIN_FREE_GB=4` changes the
  limit. `docker builder prune` frees the build cache. On Docker
  Desktop the disk is in the VM, so the check passes and does nothing.
- **`adlc` is not a Nix build.** The shell's `adlc` is the upstream
  binary release. It names `/lib64/ld-linux-x86-64.so.2` and links the
  host's `libgmp`, and `nixos/nix` has neither, so `goadlc` fails with
  `fork/exec .../adlc: no such file or directory`. The shell stage
  links the loader and `libgmp` in from the flake's nixpkgs.
- **The build needs nothing beside the repository.** `go.work` has no
  `replace`, so the images take `adl-go` and `ohm-go` from the proxy.
  `GOWORK` from the workspace does not reach the build.
- **The engine API is on.** Each node that your policy lets in can use
  it. The stack is for one person, on their own tailnet.

## Experiences

None in this repository yet. Add one, with a date and a name, when the
stack surprises you.
