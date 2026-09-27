#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
docker compose exec -T zorqemi-db pg_dump -U "${POSTGRES_USER:-zorqemi}" -d "${POSTGRES_DB:-zorqemi}" --format=custom > "backups/zorqemi-${STAMP}.dump"
find backups -type f -name 'zorqemi-*.dump' -mtime +14 -delete
echo "Backup erstellt: backups/zorqemi-${STAMP}.dump"
