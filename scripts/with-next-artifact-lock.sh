#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
LOCK_DIR="$PROJECT_DIR/.next-artifact.lock"

if [[ "$#" -eq 0 ]]; then
  printf '[next-artifact-lock] Missing command.\n' >&2
  exit 2
fi

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  printf '[next-artifact-lock] Another command is using .next artifacts. Try again after it finishes.\n' >&2
  exit 1
fi

cleanup() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

cd "$PROJECT_DIR"
"$@"
