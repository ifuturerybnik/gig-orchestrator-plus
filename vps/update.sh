#!/usr/bin/env bash
# Concertivo — bezpieczna aktualizacja na VPS Hostinger
# Użycie:  cd /var/www/concertivo && ./update.sh
# Lub jako jedna komenda (patrz README poniżej skryptu)

set -Eeuo pipefail

APP_DIR="/var/www/concertivo"
PM2_NAME="concertivo"
BRANCH="${BRANCH:-main}"
CLI_PORT="${PORT:-}"
PORT="${PORT:-3001}"
ENV_FILE="$APP_DIR/.env.production"
ENV_BACKUP="/tmp/concertivo.env.production.$(date +%Y%m%d-%H%M%S).bak"

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

# 1) Git: zabezpieczenie przed lokalnymi zmianami
log "Pobieram zmiany z GitHub (branch: $BRANCH)..."
git fetch origin "$BRANCH"

if ! git diff --quiet || ! git diff --cached --quiet; then
  warn "Wykryto lokalne zmiany — robię stash (auto-backup)"
  git stash push -u -m "auto-update-$(date +%Y%m%d-%H%M%S)" || true
fi

git reset --hard "origin/$BRANCH"
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
for REQUIRED_ENV in VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY; do
  if [ -z "${!REQUIRED_ENV:-}" ]; then
    err "Brak zmiennej $REQUIRED_ENV — wymagana do buildu. Dopisz ją do $(basename "$ENV_FILE")."
    print_env_help
    exit 1
  fi
done

# Runtime sekrety (EXT_*) — ostrzegamy, ale nie blokujemy: mogą siedzieć w env procesu PM2
for RUNTIME_ENV in EXT_SUPABASE_SERVICE_ROLE_KEY EXT_PII_ENCRYPTION_KEY; do
  if [ -z "${!RUNTIME_ENV:-}" ]; then
    warn "$RUNTIME_ENV nie ma w pliku env — zakładam, że PM2 ma to w swoim środowisku (działająca instalacja)"
  fi
done

ok "Env OK — kontynuuję build"

# 2) Dependencies
log "Instaluję zależności (bun install --frozen-lockfile)..."
bun install --frozen-lockfile

# 3) Build — WAŻNE: używamy vite.vps.config.ts (bez Cloudflare plugin)
log "Czyszczę stary build..."
rm -rf dist .output .vinxi node_modules/.vite || true

log "Buduję aplikację (config: vite.vps.config.ts)..."
if [ -f "vite.vps.config.ts" ]; then
  bunx vite build --config vite.vps.config.ts
else
  warn "Brak vite.vps.config.ts — używam domyślnego configa"
  bun run build
fi

# Sanity check — czy build coś wyprodukował
if [ ! -d "dist" ] && [ ! -d ".output" ]; then
  err "Build nie utworzył katalogu dist/ ani .output/ — przerywam, NIE restartuję PM2"
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
