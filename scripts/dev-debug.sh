#!/usr/bin/env bash

set -Eeuo pipefail

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-3000}"
LOG_FILE="${LOG_FILE:-/tmp/mermaid-dev.log}"
START_TIMEOUT="${START_TIMEOUT:-30}"
FOREGROUND="${FOREGROUND:-0}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

log() {
  printf '[dev-debug] %s\n' "$*"
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

is_project_next_process() {
  local pid="$1"
  local current="$pid"
  local depth=0

  while [[ -n "$current" && "$current" != "0" && "$depth" -lt 8 ]]; do
    local command_line
    command_line="$(process_command "$current")"

    if [[ "$command_line" == *"$PROJECT_DIR/node_modules/.bin/next dev"* ]]; then
      return 0
    fi

    if [[ "$command_line" == *"next-server"* && "$depth" -eq 0 ]]; then
      local parent
      parent="$(parent_pid "$current")"
      local parent_command
      parent_command="$(process_command "$parent")"
      if [[ "$parent_command" == *"$PROJECT_DIR/node_modules/.bin/next dev"* ]]; then
        return 0
      fi
    fi

    current="$(parent_pid "$current")"
    depth=$((depth + 1))
  done

  return 1
}

ancestor_dev_pids() {
  local pid="$1"
  local current="$pid"
  local depth=0

  while [[ -n "$current" && "$current" != "0" && "$depth" -lt 8 ]]; do
    local command_line
    command_line="$(process_command "$current")"

    if [[ "$command_line" == *"next-server"* || "$command_line" == *"$PROJECT_DIR/node_modules/.bin/next dev"* || "$command_line" == *"next dev"* || "$command_line" == *"npm run dev"* ]]; then
      printf '%s\n' "$current"
    fi

    current="$(parent_pid "$current")"
    depth=$((depth + 1))
  done
}

wait_for_port_free() {
  local seconds="${1:-6}"
  local index

  for index in $(seq 1 "$seconds"); do
    if [[ -z "$(port_pids)" ]]; then
      return 0
    fi
    sleep 1
  done

  return 1
}

stop_existing_project_server() {
  mapfile -t pids < <(port_pids)
  if [[ "${#pids[@]}" -eq 0 ]]; then
    return 0
  fi

  local project_pids=()
  local blockers=()
  local pid

  for pid in "${pids[@]}"; do
    if is_project_next_process "$pid"; then
      while IFS= read -r ancestor; do
        project_pids+=("$ancestor")
      done < <(ancestor_dev_pids "$pid")
    else
      blockers+=("$pid")
    fi
  done

  if [[ "${#blockers[@]}" -gt 0 ]]; then
    log "Port $PORT is already used by a non-project process:"
    for pid in "${blockers[@]}"; do
      log "  pid $pid: $(process_command "$pid")"
    done
    die "Choose another PORT or stop that process manually."
  fi

  mapfile -t project_pids < <(printf '%s\n' "${project_pids[@]}" | sed '/^$/d' | sort -ur)
  if [[ "${#project_pids[@]}" -eq 0 ]]; then
    die "Port $PORT is occupied, but the owning project dev process could not be identified."
  fi

  log "Stopping existing project dev server on port $PORT: ${project_pids[*]}"
  kill "${project_pids[@]}" 2>/dev/null || true

  if wait_for_port_free 6; then
    return 0
  fi

  log "Existing server did not exit after SIGTERM; forcing stop."
  kill -9 "${project_pids[@]}" 2>/dev/null || true
  wait_for_port_free 4 || die "Port $PORT is still occupied after stopping the old dev server."
}

clear_dev_cache() {
  log "Clearing Next dev cache."
  rm -rf "$PROJECT_DIR/.next/cache" "$PROJECT_DIR/.next/server" "$PROJECT_DIR/.next/static/development"
}

wait_for_server() {
  local pid="$1"
  local index

  for index in $(seq 1 "$START_TIMEOUT"); do
    if ! kill -0 "$pid" 2>/dev/null; then
      log "Dev server process exited early."
      tail -80 "$LOG_FILE" || true
      return 1
    fi

    if has_command curl && curl -fsS "http://$HOST:$PORT" >/dev/null 2>&1; then
      return 0
    fi

    if ! has_command curl && grep -q "Ready in" "$LOG_FILE" 2>/dev/null; then
      return 0
    fi

    sleep 1
  done

  log "Timed out waiting for http://$HOST:$PORT."
  tail -80 "$LOG_FILE" || true
  return 1
}

start_server() {
  if [[ "$FOREGROUND" == "1" ]]; then
    log "Starting foreground Next dev server on http://$HOST:$PORT"
    exec npm run dev -- --hostname "$HOST" --port "$PORT"
  fi

  mkdir -p "$(dirname -- "$LOG_FILE")"
  : >"$LOG_FILE"

  log "Starting Next dev server on http://$HOST:$PORT"
  nohup npm run dev -- --hostname "$HOST" --port "$PORT" >"$LOG_FILE" 2>&1 &
  local pid="$!"

  if wait_for_server "$pid"; then
    log "Ready: http://$HOST:$PORT"
    log "PID: $pid"
    log "Log: $LOG_FILE"
    log "Tail logs with: tail -f $LOG_FILE"
  else
    return 1
  fi
}

stop_existing_project_server
clear_dev_cache
start_server
