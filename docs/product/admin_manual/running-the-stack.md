# Running the stack

A task page: run `bff` and My Whisper, `myw`, together in docker,
behind one tailnet node, so the page is on HTTPS for you on any of
your devices.

```sh
# In the repository root, in the dev shell, with docker on the machine.
task compose:authkey   # the days your auth key has left; no tailnet
task compose:check     # the files are good; no tailnet
task compose:build     # the two images; no tailnet
task compose:up        # start, as the node protowx-<branch>
task compose:logs      # follow; task compose:logs -- myw for one service
task compose:down      # stop; your calculations and the node stay
```

Then open `https://protowx-<branch>.<domain>/`. `<branch>` is the
branch of your checkout, in lower case. `<domain>` is your tailnet's
domain, such as `tail1234.ts.net`.

## Before the first start

1. Install docker on the machine. The dev shell does not have it.
2. Make a Tailscale auth key.
   [compose-tailscale.md](../../devtools/compose-tailscale.md),
   section 1, gives the options. Note the expiry date the console
   shows beside the key.
3. Put three lines in `.envrc.local`, at the repository root:

   ```sh
   export TS_AUTHKEY=tskey-auth-...
   export TS_AUTHKEY_EXPIRE=20270127
   export TS_DOMAIN=tail1234.ts.net
   ```

4. Run `direnv reload`.

The tailnet must have MagicDNS and HTTPS certificates on.

## When the auth key expires

A key lasts 90 days at most, and the key itself does not carry its
expiry. `TS_AUTHKEY_EXPIRE`, the date you wrote in `.envrc.local`, is
the only record of it.

`task compose:authkey` reads that date and says how many days are
left. `task compose:up` runs the same check before it builds:

- **A week before the date**, both start to warn, and print the link
  to the console.
- **After the date**, `task compose:up` stops and starts nothing.

Make a new key at
<https://console.tailscale.com/admin/settings/keys>, put it and its
new expiry date in `.envrc.local`, then run `direnv reload`.

A node that is already on your tailnet needs no key: its identity is
in the volume `ts-state`. To start such a node with an expired key
still in your shell, delete the two `TS_AUTHKEY` lines and run
`direnv reload`.

Leave `TS_AUTHKEY_EXPIRE` out and nothing is checked. The task then
says the expiry is unknown.

## What runs

| service | what it does                      | on the tailnet                           |
|---------|-----------------------------------|------------------------------------------|
| `bff`   | the page, the engine, the reports | `https://protowx-<branch>.<domain>/`     |
| `myw`   | the transcript for **dictate**    | `https://protowx-<branch>.<domain>:8443` |

Nothing else answers on the node. `bff` and `myw` listen on the
node's loopback only, and Tailscale Serve brings the two HTTPS ports
to them. `task compose:closed`, run on another device of the
tailnet, checks this.

The trace viewer, Jaeger on `:8445`, is not in the stack yet. It
joins with the traces.

## Where your data is

| data                 | where                                         |
|----------------------|-----------------------------------------------|
| your calculations    | the docker volume `store`                     |
| the feedback reports | `.bugreports/` in the repository, on the host |
| the node's identity  | the docker volume `ts-state`                  |

`task compose:down` keeps all three. `task compose:down -- --volumes`
deletes the two volumes. The next start is then a new node, which
reads `TS_AUTHKEY` again, and the three seeded calculations.

## Gotchas

- **The first build is long.** The build makes whisper.cpp from
  source, once. Later builds reuse it until `flake.nix` or
  `flake.lock` changes.
- **The build needs 6 GB free on docker's disk.** The tasks refuse
  with less. `task compose:prune` deletes every image that no
  container uses, on the whole machine; docker asks first.
- **The engine is single-tenant.** Each device that your tailnet
  lets in can read, change and delete every calculation. The stack
  is for one person.
- **`.bugreports/` must be yours.** `bff` runs as your user. When
  the directory belongs to root, `task compose:up` stops and prints
  the `chown`.
- **One branch, one node.** A second worktree on another branch is a
  second stack and a second node.

## See also

- `deploy/compose/README.md`, in the repository: the stack's files,
  images and flags.
- [../../devtools/compose-tailscale.md](../../devtools/compose-tailscale.md):
  the credential, `TS_DOMAIN`, kernel mode.
- [changelog.md](changelog.md): what changed for the admin.
