#!/usr/bin/env bash
# Runs from Superset's Run button. Starts the dev server on this workspace's port.
set -euo pipefail
cd "$(dirname "$0")/.."
source .superset/lib.sh

port="$(allocate_port)"
write_ports_json "$port"
export PORT="$port"
log "Starting dev server on http://localhost:$PORT"

pm="$(detect_pm)"
if [ -n "$pm" ]; then
  script=""
  for s in dev start; do
    if jq -e --arg s "$s" '.scripts[$s]' package.json >/dev/null 2>&1; then script="$s"; break; fi
  done
  if [ -z "$script" ]; then
    echo "package.json has no \"dev\" or \"start\" script; edit .superset/run.sh" >&2
    exit 1
  fi
  # Next.js, Nuxt, Remix, CRA and most Node servers read $PORT. Vite and Astro
  # ignore it, so pass the port as a flag for those.
  args=()
  if jq -r --arg s "$script" '.scripts[$s]' package.json | grep -qE '(^|[^a-z])(vite|astro)([^a-z]|$)'; then
    args=(--port "$PORT" --strictPort)
    [ "$pm" = npm ] && args=(-- "${args[@]}")
  fi
  exec "$pm" run "$script" ${args[@]+"${args[@]}"}
elif [ -f manage.py ]; then
  py=python3; [ -x .venv/bin/python ] && py=.venv/bin/python
  exec "$py" manage.py runserver "127.0.0.1:$PORT"
else
  echo "No dev server detected (no package.json or manage.py). Edit .superset/run.sh." >&2
  exit 1
fi
