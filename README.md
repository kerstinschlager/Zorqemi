# Zorqemi

Zorqemi ist ein neutraler Marktplatz für unabhängige Händler, physische und digitale Produkte.

## Aktueller Stand

- Responsive Marketplace-Oberfläche
- Produktsuche, Kategorien und Sortierung
- Warenkorb mit Bestandsprüfung
- Kundenkonto und Bestellübersicht
- Händler-Dashboard mit Kennzahlen
- Produkte anlegen, bearbeiten und löschen
- Händlerprofil, Shop-URL und Veröffentlichung
- Öffentliche Händler-Shops
- Händler-Bestellungen und Statusverwaltung
- Versanddienstleister, Tracking und Kundenbenachrichtigungen
- Plattform-Admin mit Provisionen und Auszahlungsübersicht
- eigener Node.js-/PostgreSQL-Server mit HTTP-only Sessions
- Stripe Connect Händler-Onboarding
- Stripe Checkout mit serverseitiger Preis- und Bestandsprüfung
- serverseitiger Stripe-Webhook für bezahlt, fehlgeschlagen, abgelaufen und erstattet
- Gehärtete Zahlungsstatus- und Provisionsgrenzen in der Datenbank
- Händler-FAQ, Checklisten und Marketing-Bereich

## Produktionsserver

Die produktive Backend-Logik läuft im eigenen Zorqemi-Server-Stack (`server/`) mit PostgreSQL, Node.js und Nginx. Produktionsgeheimnisse bleiben ausschließlich auf dem Server.

Siehe `server/DEPLOY.md` und `.env.example` für die Produktionskonfiguration.

## Entwicklung

Frontend-Dateien liegen im Repository-Root. Backend-Logik, Datenbankmigrationen und Checkout liegen im `server/`-Bereich. Die `supabase/`-Struktur bleibt derzeit als Migrations-/Bestandskompatibilität erhalten; sie ist nicht die produktive Checkout-Laufzeit.

## Wichtige Dateien

- `index.html` – Plattformoberfläche
- `app.js` – Shop- und Grundfunktionen
- `stripe.js` – Stripe-Connect-/Checkout-Frontend-Anbindung
- `merchant-profile-v2.js` – Händlerprofil
- `merchant-directory.js` – öffentliche Händlerübersicht
- `merchant-shop.js` – öffentlicher Händler-Shop
- `dashboard-overview.js` – Händler-Dashboard
- `order-management.js` – Händler-Bestellungen und Versand
- `customer-account.js` – Kundenkonto und Bestellungen
- `shop-settings.js` – Shop- und Rechtseinstellungen
- `merchant-marketing.js` – Marketing-Bereich
- `merchant-support.js` – FAQ und Support
- `checklist-repair.js` – Händler-Checkliste
- `marketplace-home.js` – Zorqemi Marken- und Marketplace-Startseite
- `supabase/migrations/` – Datenbankmigrationen
