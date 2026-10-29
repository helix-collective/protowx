#!/usr/bin/env bash
# task ngrok:config — write deploy/ngrok/ngrok.generated.yml.
#
# The ngrok agent reads its endpoints from a config file, and that
# file expands no environment variable. NGROK_AUTHTOKEN and
# NGROK_API_KEY are the only two the agent itself reads, and neither
# names a domain. So this script writes the file before each start,
# from the variables of .envrc.local. git ignores the output.
#
#   NGROK_DOMAIN       the page's host name; the one endpoint always made
#   NGROK_MYW_DOMAIN   My Whisper's host name; no value, no endpoint
#   NGROK_OAUTH_EMAIL  one address, or several with commas; no value, no SSO
#
# The SSO policy guards the page's endpoint alone. The page fetches
# My Whisper with XHR, and an XHR cannot follow a login redirect, so a
# policy there would break the dictation. docs/devtools/compose-ngrok.md
# section 4 is the gotcha.
#
# It is a script, not shell in Taskfile.ngrok.yml, because it is past
# twenty lines, and because the heredoc below is the file it writes.
set -euo pipefail

# Run from the repository root, whatever directory the caller is in.
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

out=deploy/ngrok/ngrok.generated.yml
domain=${NGROK_DOMAIN:-}
myw_domain=${NGROK_MYW_DOMAIN:-}
emails=${NGROK_OAUTH_EMAIL:-}

say() {
  echo "ngrok:config: $*" >&2
}

if [ -z "$domain" ]; then
  say "set NGROK_DOMAIN in .envrc.local, your ngrok domain,"
  say "such as protowx.ngrok-free.dev. task fastdev -- ngrok checks it."
  exit 1
fi

# The CEL list of the allowed addresses: a@x.io,b@y.io becomes
# 'a@x.io','b@y.io'. A space around a comma is dropped.
cel_list() {
  local out="" addr
  local IFS=,
  for addr in $1; do
    addr=$(echo "$addr" | tr -d '[:space:]')
    [ -n "$addr" ] || continue
    [ -z "$out" ] || out+=","
    out+="'$addr'"
  done
  echo "$out"
}

# The traffic policy of the page's endpoint, indented to sit under the
# endpoint: Google OAuth, then a deny for every address but the ones
# NGROK_OAUTH_EMAIL names. No address, no policy, and the page is open
# to anyone who has the URL.
policy() {
  [ -n "$emails" ] || return 0
  cat <<POLICY
    traffic_policy:
      on_http_request:
        - actions:
            - type: oauth
              config:
                provider: google
        - expressions:
            - "!(actions.ngrok.oauth.identity.email in [$(cel_list "$emails")])"
          actions:
            - type: deny
              config:
                status_code: 403
POLICY
}

# My Whisper's endpoint, or nothing. bff and myw share the agent's
# network namespace, so each upstream is the agent's own loopback.
myw_endpoint() {
  [ -n "$myw_domain" ] || return 0
  cat <<MYW
  - name: myw
    description: My Whisper, the dictation's transcript; no SSO, see section 4
    url: https://$myw_domain
    upstream:
      url: http://localhost:8090
MYW
}

cat > "$out" <<CONFIG
# Written by task ngrok:config, from .envrc.local. Do not edit: the
# next start overwrites it, and git ignores it.
#
# scripts/ngrok/config.sh is the generator, and
# docs/devtools/compose-ngrok.md the page.
version: 3

agent:
  # NGROK_AUTHTOKEN, from the environment, is the credential. It is
  # not written here: this file is readable, and the token is not.
  log: stdout
  log_level: info

endpoints:
  - name: bff
    description: the calculator's page, the engine API and the feedback report
    url: https://$domain
    upstream:
      url: http://localhost:8080
$(policy)
$(myw_endpoint)
CONFIG

# A heredoc of an empty function leaves a blank line; drop a run of
# them, so the file reads as it would by hand.
awk 'NF == 0 { blank = 1; next } { if (blank && NR > 1) print ""; blank = 0; print }' "$out" > "$out.tmp"
mv "$out.tmp" "$out"

say "wrote $out"
say "the page: https://$domain"
if [ -n "$myw_domain" ]; then
  say "My Whisper: https://$myw_domain, with no SSO"
else
  say "no NGROK_MYW_DOMAIN, so no My Whisper and no dictate button"
fi
if [ -n "$emails" ]; then
  say "SSO: Google, and only $emails"
else
  say "SSO: off. Anyone who has the URL reaches the page, the engine"
  say "API and the store. Set NGROK_OAUTH_EMAIL to ask for a Google login."
fi
