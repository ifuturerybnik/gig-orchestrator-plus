---
name: VPS server details
description: Concertivo VPS (Hostinger) — OS, OpenSSL, reverse proxy, porty, ścieżki
type: reference
---
- Host: srv1656499 (Hostinger), IP 82.198.225.166
- OS: Ubuntu 24.04.4 LTS (Noble Numbat)
- OpenSSL: 3.0.13
- Node/PM2: aplikacja `concertivo` nasłuchuje na 127.0.0.1:3001
- Reverse proxy: **Caddy w kontenerze `mail-proxy-caddy`** (caddy:2-alpine), Caddyfile: `/opt/mail-proxy/Caddyfile`
  - `concertivo.eu, www.concertivo.eu → 172.17.0.1:3001` (docker bridge gateway do PM2 na hoście)
  - `mail.concertivo.eu → mail-proxy-concertivo:3000`
  - `mail-proxy.i-future.pl → mail-proxy:3000` (CRM Hub, nie ruszać)
- TLS dla `concertivo.eu` = Let's Encrypt zarządzany automatycznie przez Caddy. **QWAC do e-Doręczeń jest osobny** — używany jako client cert (mTLS) w kodzie server fn, NIE w Caddy.
- Inne kontenery: `n8n-mhga-n8n-1` (port 32768), backupy `mail-proxy.backup-*`
- Ścieżki dla certyfikatów aplikacyjnych (QWAC do ADE): `/etc/ssl/concertivo/` (utworzyć, chmod 700, owner root). Klucz prywatny `.key` chmod 600. Node proces czyta plik przy starcie server fn.
