# Change log

What changed in how you run protowx, newest first: a new or different
command, flag, subcommand, task, route, file or directory, and any
step an upgrade needs. One section per day; each entry gives its kind
(added, changed, fixed or removed), what you type or do now, and the
commit. The brief product log is [../changelog.md](../changelog.md).

## 2026-10-29

- **Added.** The ngrok stack, `deploy/ngrok/`: the same `bff` and
  `myw` behind an ngrok agent, on the public internet, in place of a
  tailnet node. `task fastdev -- ngrok` starts it;
  `task ngrok:logs` follows it and `task ngrok:down` stops it. Put
  `NGROK_AUTHTOKEN` and `NGROK_DOMAIN` in `.envrc.local`.
  `NGROK_MYW_DOMAIN`, a second domain, turns **dictate** on. HTTPS
  needs nothing: ngrok ends TLS with its own certificate. See
  [running-the-stack.md](running-the-stack.md), "On ngrok instead of
  a tailnet".
- **Added.** `NGROK_OAUTH_EMAIL` in `.envrc.local`, the addresses SSO
  lets into the ngrok stack, separated by commas. A visitor signs in
  with Google, and any other address gets a 403. **Leave it out and
  the ngrok URL is open**: anyone who has the link reaches the page,
  the engine API and your calculations. `task fastdev -- ngrok`
  warns at each start while it is off, and starts anyway. My
  Whisper's endpoint has no SSO either way.
- **Changed.** `task fastdev` takes the stack to start:
  `task fastdev -- tailscale`, the default, or
  `task fastdev -- ngrok`. `task fastdev` alone is unchanged.
- **Added.** `task fastdev`, the one command that starts the stack. It
  checks that `.envrc.local` is there, and that `TS_AUTHKEY` and
  `TS_DOMAIN` read right, then runs `task compose:up`. A line that is
  missing or wrong stops it before docker, and the message names the
  fix: the `cp` of `.envrc.local.example`, the console page for the
  key, and the console page for the tailnet name. See
  [running-the-stack.md](running-the-stack.md), "Before the first
  start".
- **Added.** `TS_AUTHKEY_EXPIRE` in `.envrc.local`, the expiry date of
  your Tailscale auth key, as `YYYYMMDD`. `task compose:authkey` says
  how many days the key has left. It warns from a week before the
  date, and `task compose:up` runs the same check first and refuses to
  start after the date. Leave the variable out and nothing is checked.
  See [running-the-stack.md](running-the-stack.md), "When the auth key
  expires".

## 2026-10-28

- **Added.** The compose stack, `deploy/compose/`: `bff` and `myw`
  behind one tailnet node, `protowx-<branch>`. `task compose:up`
  starts it, with `TS_AUTHKEY` and `TS_DOMAIN` in `.envrc.local`;
  `task compose:down` stops it. The page is on `https://<node>/`, and
  `myw` on `:8443`. Your calculations are in the volume `store`. The
  trace viewer joins later. See
  [running-the-stack.md](running-the-stack.md).
- **Added.** `task web:regression:stack`, the regression suite on the
  `bff` image, with no tailnet, on `127.0.0.1:8094`. `task gate` runs
  it, so the gate needs docker on the machine.
- **Added.** `services/myw`, My Whisper, the transcription service of
  **dictate**. `task myw:model` downloads the model once, 142 MB.
  `task myw:serve` serves on `127.0.0.1:8090`; then `task
  bff:connected -- --myw-url http://127.0.0.1:8090` names it to the
  page. A `bff` on another address needs `myw serve --origin <its
  origin>`. `services/myw/README.md` is the service's page.
- **Changed.** `task test`, and so `task gate`, runs `task myw:test`,
  which downloads the model on its first run.
