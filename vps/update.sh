#!/usr/bin/env bash
# Concertivo — bezpieczna aktualizacja na VPS Hostinger
# Użycie:  cd /var/www/concertivo && bash update.sh
# To jest jedyna zalecana komenda deployu VPS. Nie używaj `git pull` ani `bun run build` ręcznie.

set -Eeuo pipefail

APP_DIR="/var/www/concertivo"
PM2_NAME="concertivo"
BRANCH="${BRANCH:-main}"
CLI_PORT="${PORT:-}"
PORT="${PORT:-3001}"
ENV_FILE="$APP_DIR/.env.production"
STAMP="$(date +%Y%m%d-%H%M%S)"
ENV_BACKUP="/tmp/concertivo.env.production.${STAMP}.bak"
LOCAL_CHANGES_BACKUP="/tmp/concertivo-local-changes.${STAMP}.patch"

log()  { printf "\033[1;34m[update]\033[0m %s\n" "$*"; }
ok()   { printf "\033[1;32m[ ok ]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[warn]\033[0m %s\n" "$*"; }
err()  { printf "\033[1;31m[err ]\033[0m %s\n" "$*" >&2; }

print_env_help() {
  cat >&2 <<'EOF'

Utwórz plik sekretów na VPS jednorazowo:

  cd /var/www/concertivo
  nano .env.production

Minimalna zawartość:

  VITE_SUPABASE_URL=https://...
  VITE_SUPABASE_PUBLISHABLE_KEY=...
  EXT_SUPABASE_SERVICE_ROLE_KEY=...
  EXT_PII_ENCRYPTION_KEY=...
  PORT=3001
  APP_PUBLIC_URL=https://app.concertivo.eu
  SITE_URL=https://app.concertivo.eu
  CRON_SECRET=...

Jeśli używasz modułu Poczta/Autokorespondencja na VPS, dopisz też:

  MAIL_PROXY_URL=...
  MAIL_PROXY_TOKEN=...
  MAIL_ENCRYPTION_KEY=...

Jeśli używasz AI na VPS, dopisz też:

  OPENAI_API_KEY=...

Jeśli używasz integracji GUS na VPS, dopisz też:

  GUS_API_KEY=...
  GUS_ENV=prod   # albo test, jeśli używasz klucza testowego GUS

Potem zabezpiecz plik i uruchom update:

  chmod 600 .env.production
  bash update.sh

EOF
}

trap 'err "Krok nieudany w linii $LINENO. Aktualizacja PRZERWANA — stara wersja nadal działa."' ERR

cd "$APP_DIR"

# .env.production zawiera sekrety runtime VPS i NIE jest w Git.
# Jeśli użytkownik tworzy go tuż przed aktualizacją, git stash -u usunąłby plik.
if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "$ENV_BACKUP"
fi

# 1) Git: deterministyczna synchronizacja z GitHub.
# Celowo NIE używamy `git pull`, bo wcześniej blokował deploy przez lokalnie wygenerowany routeTree.gen.ts.
log "Pobieram zmiany z GitHub (branch: $BRANCH)..."
git fetch origin "$BRANCH"

if ! git diff --quiet || ! git diff --cached --quiet; then
  warn "Wykryto lokalne zmiany — zapisuję patch do $LOCAL_CHANGES_BACKUP i nadpisuję kod wersją z GitHub"
  git diff > "$LOCAL_CHANGES_BACKUP" || true
  git diff --cached >> "$LOCAL_CHANGES_BACKUP" || true
fi

git reset --hard "origin/$BRANCH"
git clean -fd -e .env -e .env.production
ok "Kod zsynchronizowany: $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"

if [ -f "$ENV_BACKUP" ]; then
  cp "$ENV_BACKUP" "$ENV_FILE"
  chmod 600 "$ENV_FILE" || true
fi

# Akceptuj zarówno .env.production jak i zwykły .env (fallback dla starszych instalacji)
if [ ! -f "$ENV_FILE" ] && [ -f "$APP_DIR/.env" ]; then
  warn "Brak .env.production — używam istniejącego .env (fallback)"
  ENV_FILE="$APP_DIR/.env"
fi

if [ ! -f "$ENV_FILE" ]; then
  err "Brak $APP_DIR/.env.production ani $APP_DIR/.env — utwórz jeden z nich przed aktualizacją."
  print_env_help
  exit 1
fi

log "Ładuję zmienne środowiskowe z $(basename "$ENV_FILE")..."
set -a
source "$ENV_FILE"
set +a
if [ -n "$CLI_PORT" ]; then PORT="$CLI_PORT"; fi
export PORT

# Sprawdzamy tylko zmienne potrzebne do BUILDU (reszta — runtime z PM2 env)
# URL/publishable key Supabase są zaszyte w kodzie (src/integrations/supabase/config.ts),
# więc VITE_SUPABASE_* nie są już wymagane do buildu.


# Runtime sekrety (EXT_*) — ostrzegamy, ale nie blokujemy: mogą siedzieć w env procesu PM2
for RUNTIME_ENV in EXT_SUPABASE_SERVICE_ROLE_KEY EXT_PII_ENCRYPTION_KEY; do
  if [ -z "${!RUNTIME_ENV:-}" ]; then
    warn "$RUNTIME_ENV nie ma w pliku env — zakładam, że PM2 ma to w swoim środowisku (działająca instalacja)"
  fi
done

if [ -z "${MAIL_ENCRYPTION_KEY:-}" ] && [ -z "${EXT_MAIL_ENCRYPTION_KEY:-}" ] && [ -f "/opt/mail-proxy-concertivo/.env" ]; then
  warn "MAIL_ENCRYPTION_KEY nie ma w $(basename "$ENV_FILE") — aplikacja spróbuje użyć /opt/mail-proxy-concertivo/.env"
fi
if [ -z "${MAIL_ENCRYPTION_KEY:-}" ] && [ -z "${EXT_MAIL_ENCRYPTION_KEY:-}" ] && [ ! -f "/opt/mail-proxy-concertivo/.env" ]; then
  warn "Brak MAIL_ENCRYPTION_KEY/EXT_MAIL_ENCRYPTION_KEY w env aplikacji; zapis skrzynek pocztowych będzie niedostępny do czasu dodania klucza"
fi

ok "Env OK — kontynuuję build"

# 2) Dependencies
log "Instaluję zależności (bun install --frozen-lockfile)..."
bun install --frozen-lockfile

# 3) Build — WAŻNE: używamy vite.vps.config.ts (bez Cloudflare plugin)
log "Czyszczę stary build..."
rm -rf dist .output .vinxi node_modules/.vite || true

log "Buduję aplikację (config: vite.vps.config.ts)..."
if bun run | grep -q "build:vps"; then
  bun run build:vps
elif [ -f "vite.vps.config.ts" ]; then
  bunx vite build --config vite.vps.config.ts
else
  err "Brak build:vps i vite.vps.config.ts — nie uruchamiam zwykłego builda, bo VPS serwuje wyłącznie build z dist/client + dist/server"
  exit 1
fi

# Sanity check — VPS server.mjs serwuje dist/client i dist/server.
if [ ! -d "dist/client" ] || [ ! -f "dist/server/server.js" ]; then
  err "Build VPS nie utworzył dist/client albo dist/server/server.js — przerywam, NIE restartuję PM2"
  exit 1
fi
ok "Build OK"

# 4) PM2: restart lub start jeśli nie istnieje
log "Restartuję PM2 ($PM2_NAME)..."
if pm2 describe "$PM2_NAME" > /dev/null 2>&1; then
  pm2 reload "$PM2_NAME" --update-env
  ok "PM2 reload OK"
else
  warn "Proces PM2 '$PM2_NAME' nie istnieje — startuję od zera na porcie $PORT"
  pm2 start vps/server.mjs --name "$PM2_NAME" --update-env
  pm2 save
  ok "PM2 start OK"
fi

# 5) Healthcheck
log "Sprawdzam czy aplikacja odpowiada..."
sleep 2
for i in 1 2 3 4 5; do
  CODE=$(curl -sS -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}/" || echo "000")
  # 2xx/3xx/401/403 = serwer działa. 5xx oznacza błąd aplikacji i NIE jest OK.
  if [ "$CODE" != "000" ] && { [ "$CODE" -lt 400 ] || [ "$CODE" = "401" ] || [ "$CODE" = "403" ]; }; then
    ok "Aplikacja odpowiada (HTTP $CODE, próba $i)"
    pm2 status "$PM2_NAME"
    echo
    ok "✅ Aktualizacja zakończona pomyślnie"
    exit 0
  fi
  warn "Próba $i/5 — brak odpowiedzi (kod: $CODE), czekam 2s..."
  sleep 2
done

err "Aplikacja NIE odpowiada na http://127.0.0.1:${PORT} po 5 próbach"
err "Sprawdź logi:  pm2 logs $PM2_NAME --lines 50"
exit 1
