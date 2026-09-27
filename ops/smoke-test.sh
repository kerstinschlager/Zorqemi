#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${1:-https://zorqemi.de}"

check() {
  local path="$1"
  echo "GET $BASE_URL$path"
  curl --fail --silent --show-error --location "$BASE_URL$path" >/dev/null
}

check "/healthz"
check "/api/v1/status"

echo "Zorqemi Smoke-Test: OK"
