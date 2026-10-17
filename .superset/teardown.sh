#!/usr/bin/env bash
# Runs when Superset deletes a workspace. Stops this workspace's dev server and
# releases its port reservation.
set -uo pipefail
cd "$(dirname "$0")/.."
source .superset/lib.sh

if [ -f "$PORT_FILE" ]; then
  base="$(cat "$PORT_FILE")"
  for ((p = base; p < base + PORT_STEP; p++)); do
    pids="$(workspace_listeners "$p")"
    if [ -n "$pids" ]; then
      log "Stopping process(es) on port $p: $pids"
      for pid in $pids; do
        pkill -TERM -P "$pid" 2>/dev/null
        kill -TERM "$pid" 2>/dev/null
      done
    fi
  done
  rm -f "$PORT_FILE" .superset/ports.json
fi

log "Teardown complete"
exit 0
