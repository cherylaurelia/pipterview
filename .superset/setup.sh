#!/usr/bin/env bash
# Runs when Superset creates a workspace. Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/.."
source .superset/lib.sh

# 1. Copy untracked env files from the main checkout (never overwrites).
if [ -n "$ROOT" ] && [ -d "$ROOT" ] && [ "$ROOT" != "$WORKSPACE" ]; then
  # Gitignored files in the main checkout, with ignored dirs (node_modules etc.)
  # collapsed so this stays fast; keep only .env-style files.
  git -C "$ROOT" ls-files --others --ignored --exclude-standard --directory 2>/dev/null \
    | { grep -E '(^|/)\.env($|\.)|(^|/)\.dev\.vars$' || true; } \
    | { grep -vE '/$' || true; } \
    | while IFS= read -r f; do
        if [ ! -e "$f" ]; then
          mkdir -p "$(dirname "$f")"
          cp -p "$ROOT/$f" "$f"
          log "Copied $f from main checkout"
        fi
      done
fi

# Fall back to .env.example templates when no real env file exists.
find . -name node_modules -prune -o -name .git -prune -o -name '.env.example' -print 2>/dev/null \
  | while IFS= read -r ex; do
      target="${ex%.example}"
      if [ ! -e "$target" ]; then
        cp "$ex" "$target"
        log "Created $target from $ex (fill in real values)"
      fi
    done

# 2. Install dependencies.
pm="$(detect_pm)"
case "$pm" in
  bun)  log "bun install";  bun install ;;
  pnpm) log "pnpm install"; pnpm install --prefer-offline ;;
  yarn) log "yarn install"; yarn install ;;
  npm)
    if [ -f package-lock.json ]; then log "npm ci"; npm ci --prefer-offline --no-audit --no-fund
    else log "npm install"; npm install --prefer-offline --no-audit --no-fund; fi ;;
esac

if [ -f uv.lock ]; then
  log "uv sync"; uv sync
elif [ -f requirements.txt ]; then
  log "pip install -r requirements.txt"
  [ -d .venv ] || python3 -m venv .venv
  .venv/bin/pip install -q -r requirements.txt
fi

# 3. Reserve a dev-server port block for this workspace.
port="$(allocate_port)"
write_ports_json "$port"
log "Dev server port for this workspace: $port (block $port-$((port + PORT_STEP - 1)))"

log "Setup complete"
