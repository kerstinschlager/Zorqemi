# Zorqemi Produktionsserver

## Architektur

Die Produktionsumgebung besteht aus:

- PostgreSQL als eigener Datenbank-Container
- Zorqemi API als Node.js-Container
- Nginx als Web-/Reverse-Proxy-Container
- HTTPS/TLS davor bzw. auf dem Reverse Proxy
- Stripe ausschließlich serverseitig

Die GitHub-Pages-Seite bleibt eine Vorschau/Testoberfläche. Für den echten Marktplatz müssen Frontend und API auf derselben Produktionsdomain bzw. hinter demselben Reverse Proxy laufen, damit `/api/v1/*` erreichbar ist.

## Erforderliche Server-Umgebung

Auf einem Linux-VPS/Server:

1. Docker + Docker Compose installieren.
2. Repository nach z. B. `/opt/zorqemi` auschecken.
3. `.env.example` nach `.env` kopieren.
4. Einen langen zufälligen PostgreSQL- und Maintenance-Token setzen.
5. Stripe-Live-Schlüssel setzen.
6. DNS:
   - `zorqemi.de` → Server
   - `www.zorqemi.de` → Server
   - `*.zorqemishop.de` → Server
   - optional `zorqemishop.de` → Server
7. TLS-Zertifikate für die Domains/Wildcard bereitstellen.
8. `docker compose up -d --build`.
9. `/healthz` und `/api/v1/status` prüfen.

## GitHub-Deployment

Der Workflow `.github/workflows/server-deploy.yml` kann den Server automatisch aktualisieren.

Dafür müssen im GitHub-Repository diese Secrets hinterlegt werden:

- `ZQ_SERVER_HOST`
- `ZQ_SERVER_USER`
- `ZQ_SERVER_PATH`
- `ZQ_SERVER_SSH_KEY`

Die Produktions-`.env` bleibt ausschließlich auf dem Server und wird nicht nach GitHub übertragen.

## Stripe

Benötigt werden serverseitig:

- `STRIPE_SECRET_KEY=sk_live_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...`

Der Stripe-Webhook muss auf

`https://<produktive-domain>/api/v1/payments/stripe/webhook`

zeigen.

## Erstbetrieb

Nach dem Deployment:

1. Händlerkonto registrieren/anmelden.
2. Händlerprofil und VAT ID eintragen.
3. Stripe Connect verbinden.
4. Produkt anlegen.
5. Shop veröffentlichen.
6. Kundenkonto registrieren.
7. Produkt in den Warenkorb legen.
8. Stripe-Zahlung durchführen.
9. Webhook-Eingang prüfen.
10. Bestellung im Händlerbereich prüfen.
11. Test-Rückerstattung durchführen und Status prüfen.

## Wichtiger Sicherheitsgrundsatz

Keine Stripe-Live-Schlüssel, Datenbankpasswörter, SSH-Schlüssel oder Maintenance-Tokens in GitHub-Dateien, Frontend-JavaScript oder Supabase-Tabellen speichern.
