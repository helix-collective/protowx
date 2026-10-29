#!/usr/bin/env bash
# task compose:authkey — is the tailnet auth key still good?
#
# TS_AUTHKEY and TS_AUTHKEY_EXPIRE come from .envrc.local;
# docs/devtools/compose-tailscale.md section 1 is the page.
# TS_AUTHKEY_EXPIRE is the key's expiry date, YYYYMMDD. You write it
# down by hand when you make the key: the console shows the expiry
# once, the key does not carry it, and the stack cannot ask the
# tailnet. So this check trusts the date you wrote.
#
# It warns from a week before that date, and refuses the start after
# it. task compose:up runs it first.
#
# It is a script, not shell in Taskfile.compose.yml, because it is
# longer than twenty lines. It counts the days itself: date(1) parses
# a date one way on GNU and another on BSD, and this repository builds
# on both.
set -euo pipefail

console=https://console.tailscale.com/admin/settings/keys
warn_days=7

say() {
  echo "compose:authkey: $*" >&2
}

# The days from 1970-01-01 to YYYYMMDD, by Howard Hinnant's
# days_from_civil. Every date here is after 1970, so the division of
# $(( )), which truncates towards zero, is the floor the algorithm
# wants.
to_days() {
  local y=$((10#${1:0:4})) m=$((10#${1:4:2})) d=$((10#${1:6:2}))
  local era yoe doy doe
  y=$((y - (m <= 2)))
  era=$((y / 400))
  yoe=$((y - era * 400))
  doy=$(((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1))
  doe=$((yoe * 365 + yoe / 4 - yoe / 100 + doy))
  echo $((era * 146097 + doe - 719468))
}

# True when the argument is a real date, YYYYMMDD.
is_date() {
  local y m d mdays
  local -a len=(0 31 28 31 30 31 30 31 31 30 31 30 31)
  [[ $1 =~ ^[0-9]{8}$ ]] || return 1
  y=$((10#${1:0:4})) m=$((10#${1:4:2})) d=$((10#${1:6:2}))
  ((y >= 1970 && m >= 1 && m <= 12)) || return 1
  mdays=${len[m]}
  ((m == 2 && (y % 4 == 0 && y % 100 != 0 || y % 400 == 0))) && mdays=29
  ((d >= 1 && d <= mdays))
}

# The date as YYYY-MM-DD, to read.
pretty() {
  echo "${1:0:4}-${1:4:2}-${1:6:2}"
}

# "1 day", or "N days".
days() {
  if (($1 == 1)); then echo "1 day"; else echo "$1 days"; fi
}

new_key() {
  say "make a new key: $console"
  say "put it in .envrc.local, with its expiry date, then run direnv reload."
}

# No key, nothing to check. A node that is already in the volume
# ts-state starts without one.
[ -n "${TS_AUTHKEY:-}" ] || exit 0

expire=${TS_AUTHKEY_EXPIRE:-}

if [ -z "$expire" ]; then
  say "TS_AUTHKEY is set and TS_AUTHKEY_EXPIRE is not."
  say "the expiry is unknown, so it is not checked."
  say 'add the expiry date to .envrc.local: export TS_AUTHKEY_EXPIRE=YYYYMMDD'
  exit 0
fi

if ! is_date "$expire"; then
  say "TS_AUTHKEY_EXPIRE is \"$expire\"."
  say "it must be a date, YYYYMMDD, such as 20260131."
  say "the expiry is not checked."
  exit 0
fi

left=$(($(to_days "$expire") - $(to_days "$(date +%Y%m%d)")))

if ((left < 0)); then
  say "TS_AUTHKEY expired on $(pretty "$expire"), $(days $((-left))) ago."
  new_key
  say "the node keeps its identity in the volume ts-state."
  say "unset TS_AUTHKEY to start that node without a key."
  exit 1
fi

if ((left == 0)); then
  say "TS_AUTHKEY expires today, $(pretty "$expire")."
  new_key
  exit 0
fi

if ((left <= warn_days)); then
  say "TS_AUTHKEY expires in $(days $left), on $(pretty "$expire")."
  new_key
  exit 0
fi

say "TS_AUTHKEY is good for $(days $left) more, to $(pretty "$expire")."
