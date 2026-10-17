#!/usr/bin/env bash
# Shared helpers for the Superset setup/run/teardown scripts.

WORKSPACE="${SUPERSET_WORKSPACE_PATH:-$(git rev-parse --show-toplevel)}"
ROOT="${SUPERSET_ROOT_PATH:-}"
PORT_FILE="$WORKSPACE/.superset/port"

# Each workspace reserves a block of 10 ports starting at PORT (PORT..PORT+9),
# so a project can add extra services at PORT+1, PORT+2, ... without colliding.
PORT_START=3000
PORT_STEP=10
PORT_MAX=9990

log() { printf '\033[1;34m[superset]\033[0m %s\n' "$*"; }

port_listening() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$1" -sTCP:LISTEN -t >/dev/null 2>&1
  else
    nc -z 127.0.0.1 "$1" >/dev/null 2>&1
  fi
}

# Ports already reserved by other worktrees of this repo (whether or not their
# dev server is running right now).
reserved_ports() {
  git -C "$WORKSPACE" worktree list --porcelain 2>/dev/null \
    | sed -n 's/^worktree //p' \
    | while IFS= read -r wt; do
        [ "$wt" = "$WORKSPACE" ] && continue
        [ -f "$wt/.superset/port" ] && cat "$wt/.superset/port"
      done
}

# Pick a free port block for this workspace and record it in .superset/port.
# Keeps the existing reservation if it is still usable. A lock in the shared
# git dir stops workspaces created in parallel from picking the same block.
allocate_port() {
  local common lock p tries=0 status=0
  common="$(cd "$WORKSPACE" && cd "$(git rev-parse --git-common-dir)" && pwd)"
  lock="$common/superset-port.lock"
  until mkdir "$lock" 2>/dev/null; do
    tries=$((tries + 1))
    # Break a stale lock left by a killed script (~10s).
    if [ "$tries" -gt 100 ]; then rmdir "$lock" 2>/dev/null; tries=0; fi
    sleep 0.1
  done
  p="$(_pick_port)" || status=$?
  rmdir "$lock" 2>/dev/null
  [ "$status" -eq 0 ] && echo "$p"
  return "$status"
}

_pick_port() {
  local reserved p
  reserved="$(reserved_ports)"

  if [ -f "$PORT_FILE" ]; then
    p="$(cat "$PORT_FILE")"
    if [ -n "$p" ] && ! grep -qx "$p" <<<"$reserved" \
       && { ! port_listening "$p" || port_owned_by_workspace "$p"; }; then
      echo "$p"; return 0
    fi
  fi

  # Leave PORT_START itself for the main checkout's default dev port.
  for ((p = PORT_START + PORT_STEP; p <= PORT_MAX; p += PORT_STEP)); do
    if ! grep -qx "$p" <<<"$reserved" && ! port_listening "$p"; then
      mkdir -p "$(dirname "$PORT_FILE")"
      echo "$p" > "$PORT_FILE"
      echo "$p"; return 0
    fi
  done
  echo "No free port block between $PORT_START and $PORT_MAX" >&2
  return 1
}

# PIDs listening on the given port whose working directory is inside this workspace.
workspace_listeners() {
  local pid cwd
  command -v lsof >/dev/null 2>&1 || return 0
  for pid in $(lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null); do
    cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')"
    case "$cwd" in "$WORKSPACE"|"$WORKSPACE"/*) echo "$pid" ;; esac
  done
}

port_owned_by_workspace() { [ -n "$(workspace_listeners "$1")" ]; }

# Writes .superset/ports.json so the Ports panel labels this workspace's port.
write_ports_json() {
  cat > "$WORKSPACE/.superset/ports.json" <<JSON
{
  "ports": [
    { "port": $1, "label": "Dev server" }
  ]
}
JSON
}

detect_pm() {
  if [ -f bun.lock ] || [ -f bun.lockb ]; then echo bun
  elif [ -f pnpm-lock.yaml ]; then echo pnpm
  elif [ -f yarn.lock ]; then echo yarn
  elif [ -f package.json ]; then echo npm
  fi
}
