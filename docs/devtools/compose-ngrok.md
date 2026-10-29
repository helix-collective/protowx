# The compose stack on ngrok

## TL;DR

```sh
# In the repository root, in the dev shell, with docker on the machine.
# The one command: check NGROK_AUTHTOKEN and NGROK_DOMAIN, then start.
# A missing or wrong one stops it, and names its fix.
task fastdev -- ngrok

# Write ngrok.generated.yml, the agent's endpoints, and start nothing.
task ngrok:config

# Check the file: it resolves, publishes no port, needs the two
# variables. No ngrok account is touched.
task ngrok:check

# Build the two images: bff and myw. No ngrok account is touched.
task ngrok:build

# Build and start, behind the agent.
task ngrok:up

# Follow the logs; task ngrok:logs -- ngrok for the agent alone.
task ngrok:logs

# Stop. The volume stays.
task ngrok:down
```

`task ngrok:up` runs `bff` and `myw` in docker, behind one ngrok
agent. It is [the tailnet stack](compose-tailscale.md) with ngrok in
place of Tailscale: the same two images, the same `Dockerfile`, and
one agent in place of the `ts` node. Open
`https://<your-domain>/`.
[deploy/ngrok/README.md](../../deploy/ngrok/README.md) is the stack:
the services, the endpoints and the images.

**The ngrok stack is on the public internet.** The tailnet stack is
on one person's tailnet, and that is its guard. An ngrok URL has no
such guard: anyone who has the link reaches the page, the engine API
and your calculations. Section 3 turns SSO on, and it is the only
guard here. `task fastdev -- ngrok` warns, each start, when SSO is
off.

Docker is not in the dev shell. Install it on the machine, and run
the tasks from the dev shell, which has `task` and loads
`.envrc.local`.

## Which stack to use

| you want                                | use                              |
|-----------------------------------------|----------------------------------|
| the page on your own devices only       | tailscale; `task fastdev`        |
| to show the page to someone with a link | ngrok; `task fastdev -- ngrok`   |
| a webhook from a service to reach `bff` | ngrok: a tailnet has no ingress  |
| the lowest latency and no third party   | tailscale: the traffic is direct |

The two are separate compose projects, `protowx-<branch>` and
`protowx-ngrok-<branch>`, so both run at once. Each has its own
`store` volume, so the calculations of one are not the other's. Both
write a feedback report to the repository's `.bugreports/`.

## 1. The credential

The agent is `ngrok`, the `ngrok/ngrok:3.39.13-alpine` image. It
reads `NGROK_AUTHTOKEN` from the environment at each start. One token
serves every endpoint of your account, and it does not expire, so
there is no `TS_AUTHKEY_EXPIRE` here and no expiry check.

**Copy the token.** Open the dashboard,
<https://dashboard.ngrok.com/get-started/your-authtoken>. Copy the
token and put it in `.envrc.local` at the repository root:

```sh
export NGROK_AUTHTOKEN=2abc...
export NGROK_DOMAIN=protowx.ngrok-free.dev
```

Then run `direnv reload`. `.envrc.local.example` has every line.

The token is a secret. `task ngrok:config` keeps it out of the file
it writes: the agent reads it from the environment, so
`ngrok.generated.yml` never holds it.

## 2. The domains, and HTTPS

**HTTPS needs nothing from you.** ngrok ends TLS at its own edge,
with its own certificate, for every domain it gives you. There is no
certificate to make, to renew or to mount, and the stack serves plain
HTTP behind the agent. This is the one part that is simpler than the
tailnet stack, where Tailscale Serve makes the certificate.

Two things follow:

- **The page is HTTPS, so the dictation's microphone works.** A
  browser gives `getUserMedia` to a secure origin only.
- **`bff` and `myw` never see TLS.** They listen on the agent's
  loopback, on `:8080` and `:8090`, and the agent forwards plain
  HTTP to them.

**Claim a domain.** Open the dashboard, **Universal Gateway**,
**Domains**, <https://dashboard.ngrok.com/domains>. A free account
has one domain, on `ngrok-free.dev`, and the dashboard shows it.
Select **Start a Domain** when the account has none yet. Put it in
`NGROK_DOMAIN`, with no `https://` and no path:

```sh
export NGROK_DOMAIN=protowx.ngrok-free.dev   # right
export NGROK_DOMAIN=https://protowx.ngrok-free.dev/   # wrong
```

`task fastdev -- ngrok` refuses the second form and says so.

**A second domain turns the dictation on.** `myw` needs an origin of
its own, because the page fetches it from another origin and its CORS
guard names that origin. A path on the page's domain would need the
agent to route by path, which an agent endpoint does not do. So:

| `NGROK_MYW_DOMAIN` | what runs                                     |
|--------------------|-----------------------------------------------|
| not set            | `bff` alone; the page draws no dictate button |
| a second domain    | `bff` and `myw`; the page draws the button    |

A free account has one domain, so leave the line out there. The page
still calculates, keeps calculations and sends a feedback report; it
only loses **dictate**.

## 3. SSO

**Set `NGROK_OAUTH_EMAIL` and the page asks for a Google login.**
Leave it out and the page is open to anyone who has the URL.

```sh
export NGROK_OAUTH_EMAIL=you@example.com
export NGROK_OAUTH_EMAIL=you@example.com,mate@example.com   # several
```

Then `direnv reload` and `task fastdev -- ngrok`. There is nothing to
make on Google's side: ngrok has its own OAuth application, and the
login uses it.

**What a visitor sees.** The first request is sent to Google. The
visitor signs in, Google sends them back to
`https://idp.ngrok.com/oauth2/callback`, and ngrok sets a session
cookie on your domain. An address on your list reaches the page. Any
other address gets a 403, after the login.

**How it is built.** `task ngrok:config` writes the policy into the
page's endpoint, in `ngrok.generated.yml`:

```yaml
    traffic_policy:
      on_http_request:
        - actions:
            - type: oauth
              config:
                provider: google
        - expressions:
            - "!(actions.ngrok.oauth.identity.email in ['you@example.com'])"
          actions:
            - type: deny
              config:
                status_code: 403
```

The first rule is the login. The second reads the address the login
proved and denies every address but yours. A free account allows 5
rules in one policy, and this is 2.

**A whole domain, not a list of addresses.** Change the expression to
end with the domain, and edit `scripts/ngrok/config.sh`:

```yaml
            - "!actions.ngrok.oauth.identity.email.endsWith('@example.com')"
```

**Your own Google Cloud application.** Use it when you want your own
consent screen, your own scopes or your own audit trail. Make an
OAuth **Web application** client in a Google Cloud project, set its
authorised redirect URI to `https://idp.ngrok.com/oauth2/callback`,
and copy the client id and the secret; Google shows the secret once.
Then add `client_id` and `client_secret` to the `oauth` action in
`scripts/ngrok/config.sh`:

```yaml
            - type: oauth
              config:
                provider: google
                client_id: "..."
                client_secret: "..."
                scopes:
                  - https://www.googleapis.com/auth/userinfo.profile
                  - https://www.googleapis.com/auth/userinfo.email
```

Read the two from the environment, as the script reads the domains,
so no secret is written to a file. ngrok makes a visitor accept every
scope before it completes the login.

**Another provider, or a real IdP.** The `oauth` action also takes
`github`, `gitlab`, `linkedin`, `microsoft` and `twitch`, each with
ngrok's own application. For an IdP of your own, use the
`openid-connect` action with `issuer_url`, `client_id`,
`client_secret` and the scopes `openid`, `profile` and `email`.
There are `basic-auth`, `jwt`, `restrict-ips` and `saml` actions too,
and a rule may stack them.

## 4. Gotchas

- **SSO guards the page, and not My Whisper.** The dictation's
  endpoint carries no policy, on purpose: the page fetches it with
  XHR, and an XHR cannot follow a login redirect to Google. So a
  second domain is a second, open endpoint. Leave
  `NGROK_MYW_DOMAIN` out unless you want **dictate**, and know that
  the transcription is then open to anyone who finds the URL.
- **The agent's config file expands no variable.** `NGROK_AUTHTOKEN`
  and `NGROK_API_KEY` are the only two the agent reads from the
  environment, and neither names a domain. So
  `scripts/ngrok/config.sh` writes `deploy/ngrok/ngrok.generated.yml`
  before each start, and git ignores it. Do not edit it: the next
  start overwrites it. Edit the script.
- **A free account allows 3 endpoints and 3 agents at once.** This
  stack uses 1 endpoint, or 2 with the dictation. Two branches'
  stacks at once are 2 or 4.
- **An interstitial page comes first on a free account.** A visitor
  sees ngrok's warning page and selects through it, before yours. A
  paid account removes it.
- **The project is `protowx-ngrok-<branch>`.** The tailnet stack is
  `protowx-<branch>`. Two projects, two `store` volumes: a
  calculation you make on ngrok is not in the tailnet stack's list.
- **`task ngrok:down -- --volumes` forgets the calculations.** The
  agent has no state volume, so nothing else is lost. The next start
  is the three seeded calculations.
- **The gotchas of the images are the tailnet stack's.**
  [compose-tailscale.md](compose-tailscale.md), section 4, holds
  them: the `build` shell, the long first build, the full disk that
  reads as a network fault, and `adlc`. Both stacks build the same
  `deploy/compose/Dockerfile`.

## Experiences

None in this repository yet. Add one, with a date and a name, when
the stack surprises you.
