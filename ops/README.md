# Zorqemi Produktionsbetrieb

Diese Dateien führen die letzten Schritte für den eigenen Server aus.

## Voraussetzungen
- Ubuntu/Debian Root-Server mit öffentlicher IPv4/IPv6
- DNS-Zugriff für `zorqemi.de` und `zorqemishop.de`
- Docker Engine + Compose Plugin
- Git
- TLS-Zertifikate für die öffentlichen Domains
- Stripe Live API-Key und Webhook Secret

## Deployment
1. Repository auf den Server klonen.
2. `.env.example` nach `.env` kopieren und alle Secrets ersetzen.
3. `ops/deploy.sh` ausführen.
4. `ops/backup.sh` für Datenbank-Backups einrichten.
5. Den externen Reverse Proxy/Host-Nginx auf `127.0.0.1:8080` zeigen lassen.
6. Stripe Webhook auf `https://zorqemi.de/api/v1/payments/stripe/webhook` setzen.
7. Danach den Smoke-Test gegen HTTPS ausführen.

PostgreSQL wird nicht nach außen veröffentlicht. Nur der Web-Container ist auf localhost:8080 gebunden; der öffentliche TLS-Reverse-Proxy sollte ausschließlich 80/443 nach außen öffnen.
