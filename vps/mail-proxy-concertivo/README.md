# Mail Proxy — instancja Concertivo

Druga instancja `mail-proxy` na tym samym VPS, obok istniejącej instancji CRM Hub.
Reużywa kontenera Caddy z `/opt/mail-proxy/` (CRM Hub) — Caddy obsługuje oba
serwisy w jednym procesie, każdy ma swoją subdomenę i swój kontener Deno.

## Architektura na VPS po wdrożeniu

```
                      ┌─────────────────────────────────┐
   Internet (443) ──► │  caddy (z /opt/mail-proxy/)     │
                      │                                 │
                      │  mail-proxy.i-future.pl         │──► mail-proxy            (CRM Hub)
                      │  mail.concertivo.eu             │──► mail-proxy-concertivo (Concertivo)
                      └─────────────────────────────────┘
```

- **Caddy** zostaje tam gdzie jest (`/opt/mail-proxy/`). Nie ruszamy go, tylko
  dopisujemy 4 linijki do jego `Caddyfile`.
- **Druga instancja proxy** stoi w `/opt/mail-proxy-concertivo/`, na tej samej
  sieci dockerowej (`mail-proxy_proxy-net`), bez własnego Caddy i bez
  wystawiania portów na host.
- **Baza** — osobna, Supabase Concertivo (`oksqkuhqsewjptcicvqs.supabase.co`
  lub jak masz w `VITE_SUPABASE_URL`).
- **Klucz szyfrowania** — **inny** niż w CRM Hubie. Wyciek jednego nie
  kompromituje drugiego.

## Co masz zrobić (jak klepniesz, że gotowe — przeprowadzę Cię przez to)

### 0. Wstępne wymagania
- Rekord A `mail.concertivo.eu → 82.198.225.166` w Cloudflare (DNS only —
  szara chmurka). Sprawdź: `dig +short mail.concertivo.eu` powinno zwrócić
  `82.198.225.166`.
- Działająca instancja `/opt/mail-proxy/` (CRM Hub) — bo z niej kopiujemy
  źródła `src/`.

### 1. Wgraj te pliki na VPS
Skopiuj zawartość folderu `vps/mail-proxy-concertivo/` (ten katalog) do
`/opt/mail-proxy-concertivo/` na VPS. Możesz przez `scp`, `rsync` albo po
prostu `git clone` i `cp -r`.

### 2. Skopiuj kod proxy z instancji CRM Hub
```bash
sudo mkdir -p /opt/mail-proxy-concertivo
sudo cp -r /opt/mail-proxy/src /opt/mail-proxy-concertivo/
sudo cp /opt/mail-proxy/Dockerfile /opt/mail-proxy-concertivo/
sudo cp /opt/mail-proxy/deno.json /opt/mail-proxy-concertivo/
```
Kod proxy jest identyczny — różni się tylko `.env` (inna baza, inny token,
inny klucz szyfrowania).

### 3. Skonfiguruj `.env`
Skopiuj `.env.example` na `.env` i wypełnij **trzema sekretami**:
```bash
sudo cp /opt/mail-proxy-concertivo/.env.example /opt/mail-proxy-concertivo/.env
sudo nano /opt/mail-proxy-concertivo/.env
```

Wypełnij:
- `SUPABASE_URL` — adres bazy Concertivo (z `.env` projektu Lovable,
  zmienna `VITE_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY` — service role key bazy Concertivo (z panelu
  Supabase → Settings → API → `service_role` `secret`)
- `MAIL_ENCRYPTION_KEY` — wygeneruj **NOWY** 32-bajtowy klucz hex:
  `openssl rand -hex 32`
- `PROXY_TOKEN` — wygeneruj **NOWY** długi losowy token:
  `openssl rand -hex 32`

⚠️ **Zapisz `MAIL_ENCRYPTION_KEY` i `PROXY_TOKEN` w bezpiecznym miejscu** —
będziesz je też wrzucał do Lovable secrets w projekcie Concertivo.

### 4. Dopisz subdomenę do Caddy (istniejący Caddyfile w CRM Hub)
```bash
sudo nano /opt/mail-proxy/Caddyfile
```
Na końcu pliku dopisz **dokładnie** zawartość pliku `Caddyfile.snippet` z
tego folderu (4 linie). Nie usuwaj istniejącego bloku `mail-proxy.i-future.pl`!

### 5. Podnieś drugą instancję
```bash
cd /opt/mail-proxy-concertivo
sudo docker compose up -d --build
```

### 6. Przeładuj Caddy (żeby zobaczył nową subdomenę)
```bash
sudo docker exec mail-proxy-caddy caddy reload --config /etc/caddy/Caddyfile
```

### 7. Test
```bash
# Lokalny health (wewnątrz VPS)
curl -H "X-Proxy-Token: $(grep PROXY_TOKEN /opt/mail-proxy-concertivo/.env | cut -d= -f2)" \
  http://localhost:3001/health

# Publiczny health (z internetu, po wystawieniu HTTPS przez Caddy — daj 30s na cert)
curl https://mail.concertivo.eu/health -H "X-Proxy-Token: TWOJ_TOKEN"
```
Oba powinny zwrócić `{"status":"ok","time":"..."}`.

### 8. Wróć do mnie z wynikiem
Napisz "działa" + wklej wartości `MAIL_ENCRYPTION_KEY` i `PROXY_TOKEN` (przez
add_secret w Lovable, nie tu w czacie!) — wtedy dopnę kawałek po stronie
Concertivo (migracja tabeli `email_skrzynki` + server function do wysyłki).
