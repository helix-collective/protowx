#!/usr/bin/env bash
# task fastdev — are one stack's credentials ready?
#
#   check.sh tailscale   .envrc.local, TS_AUTHKEY, TS_DOMAIN
#   check.sh ngrok       .envrc.local, NGROK_AUTHTOKEN, NGROK_DOMAIN
#
# It checks that the file is there and that each value reads right,
# and it names the fix for each one that does not. task fastdev runs
# it, then task compose:up or task ngrok:up. A problem here exits 1,
# so no stack starts on a bad credential.
#
# The variables come from .envrc.local, which direnv reads. A value
# that the file sets and the environment does not hold means the shell
# has not reloaded, so the check says that too.
#
# It checks the shape only. Whether an auth key works is the tailnet's
# answer, and whether a token works is ngrok's.
#
# The tailscale key's expiry is task compose:authkey's check, which
# task compose:up runs before it builds. ngrok's token does not expire.
#
# docs/devtools/compose-tailscale.md and
# docs/devtools/compose-ngrok.md are the pages.
#
# It is a script, not shell in Taskfile.yml, because it is past twenty
# lines.
set -uo pipefail

# Run from the repository root, whatever directory the caller is in.
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

kind=${1:-tailscale}
local_file=.envrc.local
example=.envrc.local.example
ts_keys_url=https://console.tailscale.com/admin/settings/keys
ts_dns_url=https://console.tailscale.com/admin/dns
ngrok_token_url=https://dashboard.ngrok.com/get-started/your-authtoken
ngrok_domain_url=https://dashboard.ngrok.com/domains

problems=""

add() {
  problems+="  - $*"$'\n'
}

note() {
  echo "fastdev: $*" >&2
}

# A credential is a secret, so print the front of it and no more. A
# placeholder is short and prints whole.
head_of() {
  if ((${#1} > 20)); then echo "${1:0:20}..."; else echo "$1"; fi
}

# The console gives tskey-auth-<id>-<secret>. The placeholder
# tskey-auth-xxxx has no secret part, so it fails here.
is_ts_key() {
  [[ $1 =~ ^tskey-auth-[A-Za-z0-9]+-[A-Za-z0-9]+$ ]]
}

# An ngrok authtoken is one long opaque run of base62 and underscores.
# The placeholder xxx is far too short, so it fails here.
is_ngrok_token() {
  [[ $1 =~ ^[A-Za-z0-9_]{20,}$ ]]
}

# A tailnet name and an ngrok domain are both lower case domain names.
# A scheme, a port or a path is not one, and nor is a placeholder with
# upper case, such as tailbXXXXX.ts.net or XXXX.ngrok-free.dev.
is_domain() {
  [[ $1 =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]]
}

is_email() {
  [[ $1 =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]
}

# True when the file sets the variable and the environment does not
# hold it: direnv has not read the new file.
is_stale() {
  [ -f "$local_file" ] && grep -Eq "^[[:space:]]*export[[:space:]]+$1=" "$local_file"
}

# Each variable the stack needs: set, and not only in the file.
require_set() {
  local v
  for v in "$@"; do
    [ -z "${!v:-}" ] || continue
    if is_stale "$v"; then
      add "$v is in $local_file and not in this shell; run direnv reload."
    else
      add "$v is not set."
    fi
  done
}

case "$kind" in
  tailscale | ngrok) ;;
  *)
    note "unknown stack \"$kind\"."
    note "run task fastdev -- tailscale, or task fastdev -- ngrok."
    exit 1
    ;;
esac

if [ ! -f "$local_file" ]; then
  add "$local_file is missing."
fi

if [ "$kind" = tailscale ]; then
  require_set TS_AUTHKEY TS_DOMAIN
  if [ -n "${TS_AUTHKEY:-}" ] && ! is_ts_key "$TS_AUTHKEY"; then
    add "TS_AUTHKEY is \"$(head_of "$TS_AUTHKEY")\"; a key reads tskey-auth-<id>-<secret>."
  fi
  if [ -n "${TS_DOMAIN:-}" ] && ! is_domain "$TS_DOMAIN"; then
    add "TS_DOMAIN is \"$TS_DOMAIN\"; a tailnet name reads tail1234.ts.net."
  fi
else
  require_set NGROK_AUTHTOKEN NGROK_DOMAIN
  if [ -n "${NGROK_AUTHTOKEN:-}" ] && ! is_ngrok_token "$NGROK_AUTHTOKEN"; then
    add "NGROK_AUTHTOKEN is \"$(head_of "$NGROK_AUTHTOKEN")\"; a token is one long run of letters, digits and underscores."
  fi
  if [ -n "${NGROK_DOMAIN:-}" ] && ! is_domain "$NGROK_DOMAIN"; then
    add "NGROK_DOMAIN is \"$NGROK_DOMAIN\"; a domain reads protowx.ngrok-free.dev, with no https:// and no path."
  fi
  # The two optional variables. Each is checked only when it is set.
  if [ -n "${NGROK_MYW_DOMAIN:-}" ]; then
    if ! is_domain "$NGROK_MYW_DOMAIN"; then
      add "NGROK_MYW_DOMAIN is \"$NGROK_MYW_DOMAIN\"; a domain reads protowx-myw.ngrok-free.dev."
    elif [ "$NGROK_MYW_DOMAIN" = "${NGROK_DOMAIN:-}" ]; then
      add "NGROK_MYW_DOMAIN is NGROK_DOMAIN; My Whisper needs a domain of its own."
    fi
  fi
  if [ -n "${NGROK_OAUTH_EMAIL:-}" ]; then
    while IFS= read -r addr; do
      [ -n "$addr" ] || continue
      is_email "$addr" || add "NGROK_OAUTH_EMAIL holds \"$addr\", which is not an address."
    done < <(echo "${NGROK_OAUTH_EMAIL}" | tr ',' '\n' | tr -d '[:blank:]')
  fi
fi

if [ -z "$problems" ]; then
  note "$local_file is there, and $kind's credentials read right."
  # The ngrok stack is on the public internet, so say what is open.
  # It is a warning and not a problem: the start goes on.
  if [ "$kind" = ngrok ] && [ -z "${NGROK_OAUTH_EMAIL:-}" ]; then
    note "WARNING: no NGROK_OAUTH_EMAIL, so the page has no SSO."
    note "Anyone who has the URL reaches the page, the engine API and"
    note "your calculations. Set NGROK_OAUTH_EMAIL in $local_file to ask"
    note "for a Google login; docs/devtools/compose-ngrok.md section 3."
  fi
  exit 0
fi

{
  echo "fastdev: the $kind credentials are not ready."
  echo
  printf '%s' "$problems"
  echo
  echo "Make the file, if it is missing, and open it:"
  echo
  echo "  cp $example $local_file"
  echo "  \$EDITOR $local_file"
  echo
} >&2

if [ "$kind" = tailscale ]; then
  cat >&2 <<EOF
Set these three lines in it:

  export TS_AUTHKEY=tskey-auth-...     the key the console gives
  export TS_AUTHKEY_EXPIRE=20270127    the expiry the console shows, YYYYMMDD
  export TS_DOMAIN=tail1234.ts.net     your tailnet name

Make the key at the admin console, Settings, Keys:
  $ts_keys_url
  Select Generate auth key. Set Reusable on, Expiration 90 days and
  Ephemeral off. The console shows the key once, with its expiry
  date. Copy both: the key does not carry the date.

Find the domain at the admin console, DNS:
  $ts_dns_url
  It is the "Tailnet name", such as tail1234.ts.net.

Then run direnv reload, and run task fastdev again.

docs/devtools/compose-tailscale.md, sections 1 and 2, is the page.
EOF
else
  cat >&2 <<EOF
Set these lines in it. The first two are needed; the other two are not:

  export NGROK_AUTHTOKEN=2abc...                  your agent's token
  export NGROK_DOMAIN=protowx.ngrok-free.dev      the page's domain
  export NGROK_MYW_DOMAIN=protowx-myw.ngrok.app   a second domain, for dictate
  export NGROK_OAUTH_EMAIL=you@example.com        SSO; without it the page is open

Copy the token from the dashboard, Getting Started, Your Authtoken:
  $ngrok_token_url
  One token serves every endpoint of your account. It does not expire.

Claim the domain at the dashboard, Universal Gateway, Domains:
  $ngrok_domain_url
  A free account has one domain, on ngrok-free.dev. Select Start a
  Domain, or copy the one the account already has. Leave off the
  https:// and any path.

HTTPS needs nothing: ngrok ends TLS at its edge with its own
certificate, for every domain it gives you.

A second domain, NGROK_MYW_DOMAIN, turns the dictate button on. A
free account has one domain, so leave the line out there.

Then run direnv reload, and run task fastdev -- ngrok again.

docs/devtools/compose-ngrok.md, sections 1 to 3, is the page.
EOF
fi
exit 1
