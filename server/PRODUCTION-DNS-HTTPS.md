# Zorqemi – DNS & HTTPS für eigene Händler-Adressen

## Ziel

Jeder veröffentlichte Händler kann unter

`<shop-slug>.zorqemishop.de`

erreichbar sein. Zusätzlich kann später eine eigene Domain wie

`www.meinshop.de`

verbunden werden.

## DNS auf dem eigenen Server

Nach Bereitstellung der festen öffentlichen Server-IP werden beim DNS-Anbieter diese Einträge angelegt:

- `A` → `zorqemi.de` → `<SERVER_IP>`
- `A` → `www.zorqemi.de` → `<SERVER_IP>`
- `A` → `zorqemishop.de` → `<SERVER_IP>`
- `A` → `*.zorqemishop.de` → `<SERVER_IP>`
- `A` → `api.zorqemi.de` → `<SERVER_IP>`

Der Wildcard-Eintrag `*.zorqemishop.de` ist der wichtige Teil für die Händler-Shops. Dadurch muss nicht für jeden Händler ein neuer DNS-Eintrag angelegt werden.

## HTTPS

Für Produktion müssen `zorqemi.de`, `www.zorqemi.de`, `zorqemishop.de`, `*.zorqemishop.de` und `api.zorqemi.de` per HTTPS erreichbar sein.

Für `*.zorqemishop.de` wird ein Wildcard-Zertifikat benötigt. Dieses wird bei Let's Encrypt über DNS-01 ausgestellt. Die Zugangsdaten zum DNS-Anbieter gehören ausschließlich auf den Server und niemals in GitHub.

## Reverse Proxy

Nginx nimmt die HTTPS-Anfrage entgegen und leitet `/api/` an `zorqemi-api:3000` weiter. Der ursprüngliche `Host` wird an die API weitergegeben. Die API verwendet den Hostnamen anschließend zur Händlerauflösung.

Beispielablauf:

`meinshop.zorqemishop.de` → HTTPS/Nginx → Zorqemi API → Händler `meinshop` → Produkte

## Eigene Händler-Domain

Eine individuelle Domain wird erst als aktiv behandelt, wenn sie:

1. auf den Zorqemi-Server zeigt,
2. in `shop_domains` hinterlegt ist,
3. verifiziert wurde und
4. `ssl_status = active` besitzt.

Damit kann ein fremder Host nicht einfach einen Händler-Shop vortäuschen.

## Wichtig

Der Server selbst wird erst in Betrieb genommen, wenn eine feste öffentliche IP und ein DNS-Zugang vorhanden sind. Passwörter, API-Schlüssel, Stripe-Secrets und DNS-Tokens werden nicht in das Repository geschrieben.
