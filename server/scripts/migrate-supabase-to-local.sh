#!/usr/bin/env bash
set -euo pipefail

# Migrates a PostgreSQL database into the local Zorqemi PostgreSQL service.
# Secrets are supplied through environment variables and are never committed.
# Requires: pg_dump, pg_restore, psql, and docker compose.

: "${SOURCE_DATABASE_URL:?SOURCE_DATABASE_URL must be set}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}"

BACKUP_DIR="${BACKUP_DIR:-./server/backups}"
DUMP_FILE="${BACKUP_DIR}/zorqemi-supabase-$(date +%Y%m%d-%H%M%S).dump"
mkdir -p "$BACKUP_DIR"

printf '%s\n' '==> Creating source backup'
pg_dump --format=custom --no-owner --no-privileges "$SOURCE_DATABASE_URL" > "$DUMP_FILE"

printf '%s\n' '==> Starting local PostgreSQL'
docker compose up -d zorqemi-db
until docker compose exec -T zorqemi-db pg_isready -U "${POSTGRES_USER:-zorqemi}" -d "${POSTGRES_DB:-zorqemi}" >/dev/null 2>&1; do
  sleep 2
done

printf '%s\n' '==> Restoring dump into local PostgreSQL'
docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" zorqemi-db \
  pg_restore \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    --exit-on-error \
    -U "${POSTGRES_USER:-zorqemi}" \
    -d "${POSTGRES_DB:-zorqemi}" < "$DUMP_FILE"

printf '%s\n' '==> Running statistics refresh'
docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" zorqemi-db \
  psql -X -U "${POSTGRES_USER:-zorqemi}" -d "${POSTGRES_DB:-zorqemi}" -c 'ANALYZE;'

printf 'Migration finished. Backup: %s\n' "$DUMP_FILE"
