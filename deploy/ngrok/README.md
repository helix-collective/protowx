# The ngrok stack

```sh
task fastdev -- ngrok   # check the credentials, then start; the usual way
task ngrok:config       # write ngrok.generated.yml alone; touches no account
task ngrok:check        # the file resolves, publishes no port, needs the two
task ngrok:build        # the two images, bff and myw; touches no account
task ngrok:up           # build and start, behind the agent
task ngrok:logs         # follow; task ngrok:logs -- ngrok for the agent alone
task ngrok:down         # stop; the volume stays
```

`bff` and My Whisper, `myw`, run in one compose project,
`protowx-ngrok-<branch>`, behind one ngrok agent. The page is then at
`https://${NGROK_DOMAIN}/`, on HTTPS, with the engine API, the
feedback report and, with a second domain, **dictate**.

It is [../compose/](../compose/README.md) with ngrok in place of
Tailscale. The two stacks build the same two images from the same
`deploy/compose/Dockerfile`, and they are two compose projects, so
both run at once.
[docs/devtools/compose-ngrok.md](../../docs/devtools/compose-ngrok.md)
is the credential, the domains, SSO and the gotchas.

**This stack is on the public internet.** The tailnet stack's guard
is the tailnet. Here there is none until you set
`NGROK_OAUTH_EMAIL`, and the engine API, the store and the page are
open to anyone who has the URL. `task fastdev -- ngrok` warns at each
start while SSO is off.
[compose-ngrok.md](../../docs/devtools/compose-ngrok.md), section 3,
turns it on.

## Before the first start

Put these lines in `.envrc.local` at the repository root, and run
`direnv reload`:

```sh
export NGROK_AUTHTOKEN=2abc...                    # the agent's token
export NGROK_DOMAIN=protowx.ngrok-free.dev        # the page's domain
export NGROK_MYW_DOMAIN=protowx-myw.ngrok-free.dev  # optional; dictate
export NGROK_OAUTH_EMAIL=you@example.com          # optional; SSO
```

The token is at
<https://dashboard.ngrok.com/get-started/your-authtoken> and the
domains at <https://dashboard.ngrok.com/domains>. A free account has
one domain, so leave `NGROK_MYW_DOMAIN` out there, and the page draws
no dictate button. HTTPS needs nothing: ngrok ends TLS at its edge
with its own certificate.

## The services

| container | runs                        | listens on       | from the internet       |
|-----------|-----------------------------|------------------|-------------------------|
| `ngrok`   | the agent and its endpoints | the ngrok edge   | both domains below      |
| `bff`     | the page, the engine API    | `127.0.0.1:8080` | `https://<domain>/`     |
| `myw`     | the dictation's transcript  | `127.0.0.1:8090` | `https://<myw-domain>/` |

`bff` and `myw` share the network namespace of `ngrok`
(`network_mode: service:ngrok`), so the three have one loopback. No
service publishes a port on the host; `task ngrok:check` fails on a
`ports` entry. The agent dials out to the ngrok edge and forwards
each endpoint to one upstream on that loopback.

| service | flags                                                     |
|---------|-----------------------------------------------------------|
| `bff`   | `--addr 127.0.0.1:8080`, `--myw-url https://<myw-domain>` |
| `myw`   | `--addr 127.0.0.1:8090 --origin https://<domain>`         |

`bff` also takes `--bugs /repo/.bugreports`, the repository's
`.bugreports`. Its image adds `--dir /app/dist` and `--store
/app/store/calculations.json`. With no `NGROK_MYW_DOMAIN`,
`--myw-url` is empty, the `myw` service is left out by its compose
profile, and the page draws no dictate button.

## ngrok.generated.yml

The agent reads its endpoints from a config file, and that file
expands no environment variable: `NGROK_AUTHTOKEN` and
`NGROK_API_KEY` are the only two the agent takes from the
environment, and neither names a domain. So `task ngrok:config`
writes the file, from `.envrc.local`, before each start.
`scripts/ngrok/config.sh` is the generator.

- **git ignores it.** It is `deploy/ngrok/ngrok.generated.yml`.
- **Do not edit it.** The next start overwrites it. Edit the script.
- **The token is not in it.** The agent reads the token from the
  environment, so the written file holds no secret.
- **The SSO policy is in it**, on the page's endpoint, when
  `NGROK_OAUTH_EMAIL` is set.

Check a written file against the agent, without an account:

```sh
docker run --rm --network none \
  -v "$PWD/deploy/ngrok/ngrok.generated.yml:/etc/ngrok.yml:ro" \
  ngrok/ngrok:3.39.13-alpine config check --config /etc/ngrok.yml
```

## SSO

`NGROK_OAUTH_EMAIL` puts a traffic policy on the page's endpoint:
Google OAuth, then a `deny` for every address but the ones it names.
Separate several with commas.
[compose-ngrok.md](../../docs/devtools/compose-ngrok.md), section 3,
is the page: what a visitor sees, a whole domain in place of a list,
your own Google Cloud application, and the other providers.

**The policy guards the page alone.** My Whisper's endpoint carries
none, because the page fetches it with XHR and an XHR cannot follow a
login redirect. A second domain is a second, open endpoint.

## The state

| mount          | holds                                     |
|----------------|-------------------------------------------|
| `store`        | `bff`'s calculations, `calculations.json` |
| `.bugreports/` | `bff`'s feedback reports, on the host     |

The agent keeps no state: it reads the token at each start, so there
is no volume for it, and no `ts-state`. `store` is a named volume of
this project, so the tailnet stack's calculations are not these.
`.bugreports/` is the repository's own directory, bind-mounted, and
both stacks write into it. `bff` runs as the host's uid and gid,
which `task ngrok:up` passes as `PROTOWX_UID` and `PROTOWX_GID`, so
each report belongs to you and not to root. `task ngrok:up` also
makes `.bugreports/` before the stack starts, and stops with a
`chown` when the directory is there but not writable.

`task ngrok:down` keeps the volume; `task ngrok:down -- --volumes`
removes it, and the next start has the three seeded calculations.

## The images

The same two as the tailnet stack, from the same
`deploy/compose/Dockerfile`:
[../compose/README.md](../compose/README.md), "The images", is the
page. The `x-build` block here is a copy of that file's, because YAML
anchors do not cross files; `task ngrok:check` fails when the two
differ. `task ngrok:up` and `task ngrok:build` refuse to start when
Docker's disk has less than 6 GB free, through the same
`task compose:disk`; `MIN_FREE_GB=4` changes the limit.
