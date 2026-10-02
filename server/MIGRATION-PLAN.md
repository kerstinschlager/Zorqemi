# Zorqemi – eigener Online-Server

## Ziel
Zorqemi wird schrittweise aus der heutigen Supabase/GitHub-Struktur in eine selbst verwaltete Server-Infrastruktur überführt. Der bestehende Live-Betrieb bleibt während der Migration erhalten.

## Reihenfolge
1. **Server-Basis:** Docker, Nginx, HTTPS, Firewall, Monitoring und Backups.
2. **Web:** Zorqemi-Frontend als Container auf dem eigenen Server.
3. **Datenbank:** PostgreSQL auf dem eigenen Server; Schema und Daten aus Supabase übernehmen.
4. **Authentifizierung:** eigene Auth-Schicht mit sicheren Sessions und Passwort-Reset.
5. **API:** bestehende Datenzugriffe kontrolliert auf eine eigene API umstellen.
6. **Zahlungen:** Stripe bleibt zunächst externer Zahlungsdienst; Webhooks laufen über die eigene API.
7. **Integrationen:** Printify und Spreadconnect über die eigene Server-API anbinden.
8. **Analytics:** Checkout-, Besucher- und Händlerstatistiken auf die eigene Datenhaltung umstellen.
9. **Parallelbetrieb:** jede Komponente erst testen, dann umschalten.
10. **Abschaltung Supabase:** erst nach erfolgreicher Abnahme aller Funktionen.

## Grundregel
Keine Big-Bang-Migration. Bestehende Zorqemi-Funktionen, Daten und Sicherheitsregeln werden vor jedem Umschalten geprüft.

## Aktueller Stand

### Erledigt / vorbereitet
- Docker/Nginx-Webcontainer mit Healthcheck vorbereitet.
- Eigene PostgreSQL-Datenbankstruktur und Migrationsrunner vorbereitet.
- ZorqemiShop-Domainrouting vorbereitet, inklusive `*.zorqemishop.de` und verifizierbaren Custom-Domains.
- Eigene Merchant-Authentifizierung mit scrypt-Passworthashes und HttpOnly-Sessions vorbereitet.
- Eigenes Kundenkonto mit Registrierung, Login, Logout und Session-Cookie vorbereitet.
- Eigener Warenkorb mit serverseitiger Preis-/Bestandsprüfung vorbereitet.
- Checkout auf eigener API umgesetzt.
- Lagerreservierungen während des Stripe-Checkouts umgesetzt.
- Stripe Checkout Session-Erstellung auf der eigenen API umgesetzt.
- Stripe-Webhooks auf der eigenen API umgesetzt; Signaturprüfung und idempotente Payment-Events sind vorgesehen.
- Bestellungen werden nach bestätigter Stripe-Zahlung serverseitig erzeugt und reservierter Bestand wird endgültig abgebucht.
- Checkout-Zugriff wird für Gäste über ein zeitlich begrenztes HttpOnly Token abgesichert.

### Noch erforderlich
- Echter eigener Online-Server/Root-Server mit öffentlicher IP.
- DNS für `zorqemi.de`, `zorqemishop.de`, `*.zorqemishop.de` und `api.zorqemi.de`.
- TLS/HTTPS und Reverse-Proxy im echten Serverbetrieb.
- PostgreSQL-Datenexport aus Supabase und Import in den eigenen PostgreSQL-Server.
- Bestehende Merchant-Daten auf `merchant_users` abbilden.
- Frontend vollständig von den verbleibenden Supabase-Pfaden lösen.
- Printify und Spreadconnect vollständig auf die eigene API umstellen.
- Automatisierte Tests und echter Staging-/Produktivtest auf dem Server.
- Erst danach kontrollierte Abschaltung der bisherigen Supabase-Pfade.

## Sicherheitsregel
Keine Server-, Datenbank-, Stripe- oder Provider-Secrets in GitHub. Zugangsdaten gehören ausschließlich in Server-Umgebungsvariablen bzw. einen Secret-Store.
