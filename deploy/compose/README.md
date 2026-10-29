# The compose stack

```sh
task compose:authkey   # the days the auth key has left; touches no tailnet
task compose:check     # the files resolve, publish no port, need TS_DOMAIN
task compose:build     # the two images, bff and myw; touches no tailnet
task compose:up        # build and start, as the tailnet node protowx-<branch>
task compose:logs      # follow; task compose:logs -- myw for one service
task compose:closed    # from a tailnet peer: :8080 and :8090 answer nothing
task compose:down      # stop; the volumes stay
task compose:prune     # delete every image no container uses, machine-wide

task compose:regression-up     # the regression stack: no tailnet, one port on loopback
task compose:regression-down   # stop it; the image stays
```

`bff` and My Whisper, `myw`, run in one compose project,
`protowx-<branch>`, behind one tailnet node of the same name. The page
is then at `https://protowx-<branch>.<domain>/`, on HTTPS, with the
engine API, the feedback report and **dictate**.
[docs/devtools/compose-tailscale.md](../../docs/devtools/compose-tailscale.md)
is the credential and the gotchas.
[docs/product/admin_manual/running-the-stack.md](../../docs/product/admin_manual/running-the-stack.md)
is the admin's task page.

**The trace viewer is not here yet.** Jaeger, on `:8445`, and `bff
--otlp-url` join with the traces. Until then the stack has two
services and no viewer.

## Before the first start

Put two lines in `.envrc.local` at the repository root, and run
`direnv reload`:

```sh
export TS_AUTHKEY=tskey-auth-...   # read at the first start only
export TS_AUTHKEY_EXPIRE=20270127  # the key's expiry, YYYYMMDD
export TS_DOMAIN=tail1234.ts.net   # your tailnet's domain
```

The tailnet must have MagicDNS and HTTPS certificates on.
[compose-tailscale.md](../../docs/devtools/compose-tailscale.md),
section 1, makes the auth key.

`TS_AUTHKEY_EXPIRE` is the date you read off the console when you make
the key. `task compose:authkey` counts the days to it. It warns from a
week before, and `task compose:up` refuses to start after it. Leave
the line out and nothing is checked.

## The services

| container | runs                       | listens on       | from the tailnet                         |
|-----------|----------------------------|------------------|------------------------------------------|
| `ts`      | `tailscaled` and Serve     | the tailnet      | the node `protowx-<branch>`              |
| `bff`     | the page, the engine API   | `127.0.0.1:8080` | `https://protowx-<branch>.<domain>/`     |
| `myw`     | the dictation's transcript | `127.0.0.1:8090` | `https://protowx-<branch>.<domain>:8443` |

`bff` and `myw` share the network namespace of `ts`
(`network_mode: service:ts`), so the three have one loopback. No
service publishes a port on the host. Tailscale Serve, from
`serve.json`, ends TLS with the tailnet's certificate and routes `:443`
to `bff` and `:8443` to `myw`. A port, not a path, keeps `myw` on an
origin of its own, and its CORS guard lets the page's origin in.

| service | flags                                                    |
|---------|----------------------------------------------------------|
| `bff`   | `--addr 127.0.0.1:8080`, `--myw-url https://<node>:8443` |
| `myw`   | `--addr 127.0.0.1:8090 --origin https://<node>`          |

`<node>` is `protowx-<branch>.${TS_DOMAIN}`. `bff` also takes `--bugs
/repo/.bugreports`, the repository's `.bugreports`. Its image adds
`--dir /app/dist` and `--store /app/store/calculations.json`.

## TS_DOMAIN

No binary in the stack joins the tailnet, so none learns the domain
from its own node name. The stack is told the domain. Compose refuses
to start without it: `${TS_DOMAIN:?}` stops `docker compose` before it
creates anything. `task compose:check` holds that. Serve's own config
needs no domain: the `tailscale` image writes the node's name into
`${TS_CERT_DOMAIN}`.

## Kernel mode

`ts` runs with `TS_USERSPACE=false`, `/dev/net/tun` and `NET_ADMIN`.
In userspace mode, the image's default, `tailscaled` forwards an
inbound tailnet connection to the same port on loopback, so `bff`
would answer on `protowx-<branch>:8080`, past Serve. In kernel mode
the connection arrives on `tailscale0`, and a socket bound to
`127.0.0.1` never sees it. `task compose:closed`, from another node
of the tailnet, checks that the page answers on `:443` and nothing
answers on `:8080` or `:8090`.

## The state

| mount          | holds                                                     |
|----------------|-----------------------------------------------------------|
| `ts-state`     | the node's identity; `TS_AUTHKEY` is read only without it |
| `store`        | `bff`'s calculations, `calculations.json`                 |
| `.bugreports/` | `bff`'s feedback reports, on the host                     |

`ts-state` and `store` are named volumes. `.bugreports/` is the
repository's own directory, bind-mounted, so a report sent to the
stack lands beside the ones `task bff:connected` writes. `bff` runs as
the host's uid and gid, which `task compose:up` passes as
`PROTOWX_UID` and `PROTOWX_GID`, so each report belongs to you and not
to root. `task compose:up` also makes `.bugreports/` before the stack
starts. Docker would make it as root, and `bff` could then write no
report. When the directory is there but not writable, the task stops
and prints the `chown`.

The `store` volume starts from the image's `/app/store`, which any uid
can write. The model of `myw` is in its binary, `-tags embedmodel`.
`task compose:down` keeps both volumes; `task compose:down --
--volumes` removes them. The next start is then a new node that needs
`TS_AUTHKEY` again, and the three seeded calculations. Neither touches
`.bugreports/`.

## The images

`Dockerfile` has one build stage and one target per service. The
shell stage starts from `nixos/nix` and realises the flake's `build`
shell from `flake.nix` and `flake.lock` alone. The workspace stage adds
`go.work`, each module's `go.mod` and `go.sum`, and each Taskfile. Each
build stage then copies only the source that its service reads, and
runs its tasks with `CGO_ENABLED=0`. A change to one service builds
that service alone:

| build stage | copies                                  | runs                                                   |
|-------------|-----------------------------------------|--------------------------------------------------------|
| `build-bff` | `spec`, `engine`, `services/bff`, `web` | `task web:install`, `task web:build`, `task bff:build` |
| `build-myw` | `services/myw`                          | `task myw:build`                                       |

The model of `myw` is in a cache mount, so a rebuild of `build-myw`
does not download it again. The shell's `adlc`, which `task
calc:adl-ts` calls, is an upstream binary: it needs
`/lib64/ld-linux-x86-64.so.2` and `libgmp`, which `nixos/nix` does
not have. The shell stage links both in, from the flake's nixpkgs.
The `build` shell has the tools that these tasks call and no browsers.
`task compose:up` and `task compose:build` refuse to start when
Docker's disk has less than 6 GB free; `MIN_FREE_GB=4` changes the
limit. `task compose:prune` frees space: it runs `docker image prune
-a`, which deletes every image on the machine that no container uses,
the old builds of the stack and the base images too. Docker asks
before it deletes; `task compose:prune -- -f` does not ask.

Each target starts from `scratch`:

| target | holds                                                                 |
|--------|-----------------------------------------------------------------------|
| `bff`  | the static binary, the page's `dist/`, and `store/`                   |
| `myw`  | the binary, its Nix loader, whisper.cpp and libffi with their closure |

`myw` stays dynamic: kronk's bindings open whisper.cpp and libffi at
run time. Its image sets `PROTOWX_WHISPER_LIBS`, which its `--libs`
flag reads, `LD_LIBRARY_PATH` for libffi, and `XDG_CACHE_HOME`, where
it writes the model at the first request.

The context is the repository root, and nothing beside it. `go.work`
has no `replace`, so the build takes `adl-go` and `ohm-go` from the
proxy. `Dockerfile.dockerignore` keeps `node_modules`, the build
outputs, the model, `.git` and `.envrc.local` out of the context.

## The regression stack

```sh
task web:regression:stack      # up, the stack's scenarios, down
task compose:regression-up     # build and start it alone
task compose:regression-down   # stop it, and remove its container
```

`compose.regression.yaml` is a second file beside `compose.yaml`. It
builds the `bff` image from the same `Dockerfile`, with no tailnet.
The regression suite plays its `stack` scenarios against it;
[web/regression/README.md](../../web/regression/README.md) is the
suite.

| container | runs                                        | published on     |
|-----------|---------------------------------------------|------------------|
| `bff`     | the page and the engine API, from the image | `127.0.0.1:8094` |

- **No tailnet.** The file has no `ts` service, no `network_mode` and
  no `user`, and names no `TS_` variable. `task
  compose:regression-up` unsets each `TS_` variable before it builds,
  so it needs no credential.
- **One port, on loopback only.** `bff` publishes `8094` on
  `127.0.0.1`. Nothing on the network reaches it. `compose.yaml` still
  publishes no port.
- **One project name.** The project is `protowx-regression`, not
  `protowx-<branch>`. The port and the name are fixed, so run one
  regression stack at a time on a machine.
- **The same build.** YAML anchors do not cross files, so the file
  holds a copy of the `x-build` block of `compose.yaml`. `task
  compose:check` fails when the two copies differ, and when the file
  names a `TS_` variable.
- **No `myw` and no feedback reports.** `bff` has `--myw-url ''` and
  `--bugs ''`. The page then has no **dictate** button, the same on
  each run.
- **A new store on each run.** The store is in the container, and
  `task compose:regression-down` removes the container. Each run
  starts from the three seeded calculations.
- **The image stays.** `task compose:regression-down` removes the
  container and the network. The image, `protowx-regression-bff`,
  stays, so the next start builds only what changed.
- **The traces join later.** With them come Jaeger in this file, and
  the report scenario's trace line on the `stack` server.
