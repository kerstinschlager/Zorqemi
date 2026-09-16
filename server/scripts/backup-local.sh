#!/usr/bin/env bash
set -euo pipefail

: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}"
BACKUP_DIR="${BACKUP_DIR:-./server/backups}"
mkdir -p "$BACKUP_DIR"

DUMP_FILE="${BACKUP_DIR}/zorqemi-local-$(date +%Y%m%d-%H%M%S).dump"

docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" zorqemi-db \
  pg_dump --format=custom --no-owner --no-privileges \
  -U "${POSTGRES_USER:-zorqemi}" \
  -d "${POSTGRES_DB:-zorqemi}" > "$DUMP_FILE"

printf 'Backup created: %s\n' "$DUMP_FILE"
