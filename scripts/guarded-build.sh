#!/usr/bin/env bash

set -Eeuo pipefail

PORT="${PORT:-3000}"
ALLOW_ACTIVE_DEV_BUILD="${ALLOW_ACTIVE_DEV_BUILD:-0}"
GUARDED_BUILD_FAKE_PORT_PIDS="${GUARDED_BUILD_FAKE_PORT_PIDS:-}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

log() {
  printf '[guarded-build] %s\n' "$*"
}

port_pids() {
  if [[ -n "$GUARDED_BUILD_FAKE_PORT_PIDS" ]]; then
    printf '%s\n' "$GUARDED_BUILD_FAKE_PORT_PIDS" | tr ' ' '\n' | sed -n '/^[0-9][0-9]*$/p'
    return
  fi

  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | sort -u || true
    return
  fi

  if command -v fuser >/dev/null 2>&1; then
    fuser -n tcp "$PORT" 2>/dev/null | tr ' ' '\n' | sed -n '/^[0-9][0-9]*$/p' | sort -u || true
  fi
}

if [[ "$ALLOW_ACTIVE_DEV_BUILD" != "1" ]]; then
  mapfile -t pids < <(port_pids)
  if [[ "${#pids[@]}" -gt 0 ]]; then
    log "Port $PORT is active, so a dev server may be using .next."
    log "Stop the dev server before building, or set ALLOW_ACTIVE_DEV_BUILD=1 to override."
    exit 1
  fi
fi

exec bash "$SCRIPT_DIR/with-next-artifact-lock.sh" next build
