#!/usr/bin/env bash

set -Eeuo pipefail

APP_NAME="Mermaid Canvas Editor"

log() {
  printf '[install:arch] %s\n' "$*"
}

fail() {
  log "$*" >&2
  exit 1
}

project_dir() {
  local source_path="${BASH_SOURCE[0]:-}"

  if [[ -n "$source_path" && -f "$source_path" ]]; then
    local script_dir
    script_dir="$(cd -- "$(dirname -- "$source_path")" && pwd)"
    cd -- "$script_dir/.." && pwd
    return
  fi

  pwd
}

is_project_dir() {
  local directory="$1"
  local manifest="$directory/package.json"

  [[ -f "$manifest" ]] \
    && grep -Eq '"name"[[:space:]]*:[[:space:]]*"mermaid-canvas-editor"' "$manifest" \
    && [[ -f "$directory/scripts/electron-ship.mjs" ]]
}

require_supported_system() {
  [[ "$(uname -s)" == "Linux" ]] || fail "This installer supports Arch Linux only."
  [[ "$(uname -m)" == "x86_64" ]] || fail "This installer supports x86_64 only."
  [[ -r /etc/os-release ]] || fail "Could not identify the Linux distribution."

  # shellcheck disable=SC1091
  source /etc/os-release
  [[ "${ID:-}" == "arch" ]] || fail "This installer supports Arch Linux only (detected: ${PRETTY_NAME:-unknown})."
  command -v pacman >/dev/null 2>&1 || fail "pacman was not found."
}

print_missing_package_command() {
  local packages=("$@")

  log "Missing system packages: ${packages[*]}"
  log "Install them with the following command, then run this installer again:"
  printf '\n  sudo pacman -S --needed'
  printf ' %q' "${packages[@]}"
  printf '\n\n'
  exit 2
}

require_system_packages() {
  local required_packages=(
    git
    nodejs-lts-krypton
    npm
    base-devel
    python
    fuse2
    libnotify
    gtk3
    nss
    alsa-lib
    libxss
    libxtst
    libxkbfile
    libdrm
    mesa
    libglvnd
    xdg-utils
  )
  local missing_packages=()
  local package

  for package in "${required_packages[@]}"; do
    if ! pacman -Qq "$package" >/dev/null 2>&1; then
      missing_packages+=("$package")
    fi
  done

  if [[ "${#missing_packages[@]}" -gt 0 ]]; then
    print_missing_package_command "${missing_packages[@]}"
  fi
}

require_node_24() {
  command -v node >/dev/null 2>&1 || fail "Node.js was not found after checking system packages."
  command -v npm >/dev/null 2>&1 || fail "npm was not found after checking system packages."

  local node_version
  node_version="$(node --version)"
  [[ "$node_version" == v24.* ]] || fail "Node.js 24 is required (detected: $node_version). Install the Arch package nodejs-lts-krypton."

  log "Using Node.js $node_version and npm $(npm --version)."
}

run() {
  log "$ $*"
  "$@"
}

main() {
  local root
  root="$(project_dir)"

  is_project_dir "$root" || fail "Run this command from the mermaid-mermaid-mermaid repository. No source code was cloned or changed."
  cd -- "$root"

  log "Preparing $APP_NAME from $root."
  require_supported_system
  require_system_packages
  require_node_24

  run npm ci
  run npm run lint
  run npm test
  run npm run desktop:ship

  log "$APP_NAME is installed and has been launched."
  log "Keep developing in: $root"
}

main "$@"
