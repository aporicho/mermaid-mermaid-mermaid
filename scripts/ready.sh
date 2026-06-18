#!/usr/bin/env bash

set -Eeuo pipefail

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-5173}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
URL="http://$HOST:$PORT"

cd "$PROJECT_DIR"

log() {
  printf '[ready] %s\n' "$*"
}

die() {
  log "$*"
  exit 1
}

has_command() {
  command -v "$1" >/dev/null 2>&1
}

process_command() {
  ps -p "$1" -o command= 2>/dev/null || true
}

process_cwd() {
  lsof -p "$1" 2>/dev/null | awk '$4 == "cwd" { print $NF }' || true
}

port_pids() {
  local result=""

  if has_command lsof; then
    result="$(lsof -nP -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | sort -u || true)"
    if [[ -n "$result" ]]; then
      printf '%s\n' "$result"
      return
    fi
  fi

  if has_command fuser; then
    result="$(fuser -n tcp "$PORT" 2>/dev/null | tr ' ' '\n' | sed -n '/^[0-9][0-9]*$/p' | sort -u || true)"
    if [[ -n "$result" ]]; then
      printf '%s\n' "$result"
      return
    fi
  fi

  if has_command ss; then
    ss -ltnp "sport = :$PORT" 2>/dev/null | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' | sed -n '/^[0-9][0-9]*$/p' | sort -u || true
  fi
}

is_project_vite_process() {
  local pid="$1"
  local command_line
  command_line="$(process_command "$pid")"

  case "$command_line" in
    *"vite --host $HOST --port $PORT"* | *"npm run dev"* | *"/node_modules/.bin/vite"* )
      [[ "$(process_cwd "$pid")" == "$PROJECT_DIR" ]]
      return
      ;;
  esac

  return 1
}

stop_project_dev_server_if_needed() {
  mapfile -t pids < <(port_pids)
  if [[ "${#pids[@]}" -eq 0 ]]; then
    log "No dev server is listening on $URL."
    return
  fi

  local project_pids=()
  local pid
  for pid in "${pids[@]}"; do
    if is_project_vite_process "$pid"; then
      project_pids+=("$pid")
    else
      log "Port $PORT is used by a non-project process:"
      log "  pid $pid: $(process_command "$pid")"
      die "Stop that process manually or run ready with another PORT."
    fi
  done

  if [[ "${#project_pids[@]}" -eq 0 ]]; then
    die "Port $PORT is active, but the owning project dev process could not be identified."
  fi

  log "Stopping project dev server on $URL: ${project_pids[*]}"
  kill "${project_pids[@]}" || die "Failed to stop project dev server."
}

wait_for_port_free() {
  local remaining="${1:-8}"
  while [[ "$remaining" -gt 0 ]]; do
    if [[ -z "$(port_pids)" ]]; then
      return 0
    fi
    sleep 1
    remaining=$((remaining - 1))
  done
  return 1
}

start_dev_server_foreground() {
  wait_for_port_free 8 || die "Port $PORT is still occupied."
  log "Checks passed. Starting Vite dev service on $URL."
  log "Keep this command running; stop it with Ctrl-C when finished."
  exec npm run dev
}

log "Starting readiness check."
stop_project_dev_server_if_needed

log "Running tests."
npm test

log "Running typecheck."
npm run typecheck

log "Running production build."
npm run build

log "Readiness checks completed."
start_dev_server_foreground
