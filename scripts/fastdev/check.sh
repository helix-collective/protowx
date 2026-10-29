#!/usr/bin/env bash
# task fastdev — are the tailnet credentials ready?
#
# It checks three things, and names the fix for each:
#
#   .envrc.local  exists at the repository root
#   TS_AUTHKEY    reads tskey-auth-<id>-<secret>
#   TS_DOMAIN     reads as a tailnet name, such as tail1234.ts.net
#
# The two variables come from .envrc.local, which direnv reads. A
# value that the file sets and the environment does not hold means
# the shell has not reloaded, so the check says that too.
#
# The expiry date is task compose:authkey's check, not this one. task
# fastdev runs this script and then task compose:up, which checks the
# expiry before it builds.
#
# docs/devtools/compose-tailscale.md, sections 1 and 2, is the page.
#
# It is a script, not shell in Taskfile.yml, because it is longer than
# twenty lines.
set -uo pipefail

# Run from the repository root, whatever directory the caller is in.
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

local_file=.envrc.local
example=.envrc.local.example
keys_url=https://console.tailscale.com/admin/settings/keys
dns_url=https://console.tailscale.com/admin/dns

problems=""

add() {
  problems+="  - $*"$'\n'
}

# A key is a secret, so print the front of it and no more. The
# placeholder, tskey-auth-xxxx, is short and prints whole.
head_of() {
  if ((${#1} > 20)); then echo "${1:0:20}..."; else echo "$1"; fi
}

# The console gives tskey-auth-<id>-<secret>. The placeholder
# tskey-auth-xxxx has no secret part, so it fails here.
is_key() {
  [[ $1 =~ ^tskey-auth-[A-Za-z0-9]+-[A-Za-z0-9]+$ ]]
}

# A tailnet name is a lower case domain name. The placeholder
# tailbXXXXX.ts.net has upper case, so it fails here.
is_domain() {
  [[ $1 =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]]
}

# True when the file sets the variable and the environment does not
# hold it: direnv has not read the new file.
is_stale() {
  [ -f "$local_file" ] && grep -Eq "^[[:space:]]*export[[:space:]]+$1=" "$local_file"
}

if [ ! -f "$local_file" ]; then
  add "$local_file is missing."
fi

for v in TS_AUTHKEY TS_DOMAIN; do
  value=${!v:-}
  if [ -z "$value" ]; then
    if is_stale "$v"; then
      add "$v is in $local_file and not in this shell; run direnv reload."
    else
      add "$v is not set."
    fi
  fi
done

if [ -n "${TS_AUTHKEY:-}" ] && ! is_key "$TS_AUTHKEY"; then
  add "TS_AUTHKEY is \"$(head_of "$TS_AUTHKEY")\"; a key reads tskey-auth-<id>-<secret>."
fi

if [ -n "${TS_DOMAIN:-}" ] && ! is_domain "$TS_DOMAIN"; then
  add "TS_DOMAIN is \"$TS_DOMAIN\"; a tailnet name reads tail1234.ts.net."
fi

if [ -z "$problems" ]; then
  echo "fastdev: $local_file is there, and TS_AUTHKEY and TS_DOMAIN read right."
  exit 0
fi

cat >&2 <<EOF
fastdev: the tailnet credentials are not ready.

$problems
Make the file, if it is missing, and open it:

  cp $example $local_file
  \$EDITOR $local_file

Set these three lines in it:

  export TS_AUTHKEY=tskey-auth-...     the key the console gives
  export TS_AUTHKEY_EXPIRE=20270127    the expiry the console shows, YYYYMMDD
  export TS_DOMAIN=tail1234.ts.net     your tailnet name

Make the key at the admin console, Settings, Keys:
  $keys_url
  Select Generate auth key. Set Reusable on, Expiration 90 days and
  Ephemeral off. The console shows the key once, with its expiry
  date. Copy both: the key does not carry the date.

Find the domain at the admin console, DNS:
  $dns_url
  It is the "Tailnet name", such as tail1234.ts.net.

Then run direnv reload, and run task fastdev again.

docs/devtools/compose-tailscale.md, sections 1 and 2, is the page.
EOF
exit 1
