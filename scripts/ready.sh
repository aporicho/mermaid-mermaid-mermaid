#!/usr/bin/env bash

set -Eeuo pipefail

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-3000}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
LOCK_DIR="$PROJECT_DIR/.next-artifact.lock"
URL="http://$HOST:$PORT"
LOCK_HELD=0

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

parent_pid() {
  ps -p "$1" -o ppid= 2>/dev/null | tr -d '[:space:]' || true
}

process_files() {
  lsof -p "$1" 2>/dev/null || true
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
    result="$(ss -ltnp "sport = :$PORT" 2>/dev/null | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' | sed -n '/^[0-9][0-9]*$/p' | sort -u || true)"
    if [[ -n "$result" ]]; then
      printf '%s\n' "$result"
    fi
  fi
}

command_looks_like_project_dev() {
  local command_line="$1"

  case "$command_line" in
    *"$PROJECT_DIR/node_modules/.bin/next dev"* | \
    *"next dev --hostname $HOST --port $PORT"* | \
    *"next dev"*"$PROJECT_DIR"* | \
    *"npm run dev"* | \
    *"next/dist/bin/next dev"* | \
    *"next-server"* )
      return 0
      ;;
  esac

  return 1
}

is_project_dev_process() {
  local pid="$1"
  local command_line
  command_line="$(process_command "$pid")"

  if command_looks_like_project_dev "$command_line"; then
    return 0
  fi

  local files
  files="$(process_files "$pid")"
  if printf '%s\n' "$files" | grep -Fq "$PROJECT_DIR/.next/trace"; then
    return 0
  fi
  if printf '%s\n' "$files" | grep -Fq "$PROJECT_DIR/node_modules/@next"; then
    return 0
  fi

  return 1
}

ancestor_project_pids() {
  local pid="$1"
  local current="$pid"
  local depth=0

  while [[ -n "$current" && "$current" != "0" && "$depth" -lt 8 ]]; do
    if is_project_dev_process "$current"; then
      printf '%s\n' "$current"
    fi
    current="$(parent_pid "$current")"
    depth=$((depth + 1))
  done
}

project_dev_pids_on_port() {
  local pid
  for pid in $(port_pids); do
    if is_project_dev_process "$pid"; then
      ancestor_project_pids "$pid"
    fi
  done | sed '/^$/d' | sort -ur
}

non_project_port_pids() {
  local pid
  for pid in $(port_pids); do
    if ! is_project_dev_process "$pid"; then
      printf '%s\n' "$pid"
    fi
  done | sed '/^$/d' | sort -u
}

wait_for_port_free() {
  local seconds="${1:-8}"
  local index

  for index in $(seq 1 "$seconds"); do
    if [[ -z "$(port_pids)" ]]; then
      return 0
    fi
    sleep 1
  done

  return 1
}

stop_project_dev_server_if_needed() {
  mapfile -t pids < <(port_pids)
  if [[ "${#pids[@]}" -eq 0 ]]; then
    log "No dev server is listening on $URL."
    return 0
  fi

  mapfile -t blockers < <(non_project_port_pids)
  if [[ "${#blockers[@]}" -gt 0 ]]; then
    log "Port $PORT is used by a non-project process:"
    local blocker
    for blocker in "${blockers[@]}"; do
      log "  pid $blocker: $(process_command "$blocker")"
    done
    die "Stop that process manually or run ready with another PORT."
  fi

  mapfile -t project_pids < <(project_dev_pids_on_port)
  if [[ "${#project_pids[@]}" -eq 0 ]]; then
    die "Port $PORT is active, but the owning project dev process could not be identified."
  fi

  log "Stopping project dev server on $URL: ${project_pids[*]}"
  if ! kill "${project_pids[@]}"; then
    die "Failed to stop project dev server. Re-run the same npm run ready command with permission to stop project processes."
  fi

  if wait_for_port_free 8; then
    return 0
  fi

  log "Project dev server did not stop after SIGTERM; forcing stop."
  if ! kill -9 "${project_pids[@]}"; then
    die "Failed to force-stop project dev server."
  fi
  wait_for_port_free 6 || die "Port $PORT is still occupied after stopping the project dev server."
}

acquire_artifact_lock() {
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    die "Another command is using .next artifacts. Try again after it finishes."
  fi
  LOCK_HELD=1
}

release_artifact_lock() {
  if [[ "$LOCK_HELD" == "1" ]]; then
    rmdir "$LOCK_DIR" 2>/dev/null || true
    LOCK_HELD=0
  fi
}

clear_dev_cache() {
  rm -rf "$PROJECT_DIR/.next/cache" "$PROJECT_DIR/.next/server" "$PROJECT_DIR/.next/static/development"
}

ensure_port_free_for_dev() {
  mapfile -t blockers < <(port_pids)
  if [[ "${#blockers[@]}" -eq 0 ]]; then
    return 0
  fi

  log "Port $PORT is still occupied:"
  local blocker
  for blocker in "${blockers[@]}"; do
    log "  pid $blocker: $(process_command "$blocker")"
  done
  return 1
}

start_dev_server_foreground() {
  ensure_port_free_for_dev || return 1
  clear_dev_cache
  log "Checks passed. Starting frontend dev service on $URL."
  log "Keep this command running; stop it with Ctrl-C when finished."
  exec npm run dev
}

cleanup() {
  trap - EXIT INT TERM
  release_artifact_lock
}

trap cleanup EXIT INT TERM

log "Starting readiness check."
stop_project_dev_server_if_needed

log "Running tests."
npm test

log "Running typecheck."
acquire_artifact_lock
npm run typecheck
release_artifact_lock

log "Running production build."
acquire_artifact_lock
npm run build
release_artifact_lock

log "Readiness checks completed."
start_dev_server_foreground
