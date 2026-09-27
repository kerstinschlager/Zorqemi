#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

test -f .env || { echo "FEHLER: .env fehlt. cp .env.example .env und Secrets setzen."; exit 1; }
grep -q '^POSTGRES_PASSWORD=' .env || { echo "FEHLER: POSTGRES_PASSWORD fehlt."; exit 1; }
grep -q '^STRIPE_SECRET_KEY=' .env || { echo "FEHLER: STRIPE_SECRET_KEY fehlt."; exit 1; }
grep -q '^STRIPE_WEBHOOK_SECRET=' .env || { echo "FEHLER: STRIPE_WEBHOOK_SECRET fehlt."; exit 1; }
grep -q '^INTERNAL_MAINTENANCE_TOKEN=' .env || { echo "FEHLER: INTERNAL_MAINTENANCE_TOKEN fehlt."; exit 1; }

docker compose pull zorqemi-db
docker compose build --pull
docker compose up -d
docker compose ps

echo "Warte auf API..."
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8080/healthz >/dev/null; then
    echo "Zorqemi ist intern gesund."
    exit 0
  fi
  sleep 2
done

echo "FEHLER: Healthcheck nicht erfolgreich."
docker compose logs --tail=100 zorqemi-api zorqemi-web
exit 1
