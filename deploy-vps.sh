#!/bin/bash
set -e

# ============================================================
# Concertivo — deploy script for Hostinger VPS (Ubuntu 22+)
# ============================================================
# 1. Run this script on your VPS as root or with sudo
# 2. Update REPO_URL, DOMAIN, and EMAIL below first
# ============================================================

REPO_URL="https://github.com/TWOJ_USERNAME/TWOJE_REPO.git"  # <-- CHANGE THIS
DOMAIN="twojadomena.pl"                                      # <-- CHANGE THIS
EMAIL="twoj@email.pl"                                        # <-- CHANGE THIS (for SSL)
APP_DIR="/var/www/concertivo"
PORT="3001"

# --------------- 1. System update & dependencies ------------
echo "==> Updating system..."
apt-get update && apt-get upgrade -y

# Node.js 20 + npm
echo "==> Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Bun
echo "==> Installing Bun..."
npm install -g bun

# PM2 + Nginx + Certbot
echo "==> Installing PM2, Nginx, Certbot..."
npm install -g pm2
apt-get install -y nginx certbot python3-certbot-nginx

# --------------- 2. Clone repo & build ----------------------
echo "==> Cloning repo..."
mkdir -p /var/www
cd /var/www
if [ -d "$APP_DIR" ]; then rm -rf "$APP_DIR"; fi
git clone "$REPO_URL" "$APP_DIR"
cd "$APP_DIR"

echo "==> Installing dependencies..."
bun install

echo "==> Building for VPS (Node.js mode)..."
bun run build --config vite.vps.config.ts

# --------------- 3. Create .env.production ----------------
echo "==> Creating .env.production..."
cat > .env.production <<EOF
VITE_SUPABASE_URL=https://rpnucwqjtnxfflwqpcgg.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_WE3e-T23sCNbMkCR0VrTlw_wdHzGzb-
EOF
# Copy env into dist so the server can read it if needed
cp .env.production dist/.env

# --------------- 4. Start with PM2 -------------------------
echo "==> Starting with PM2..."
pm2 delete concertivo 2>/dev/null || true
pm2 start vps/server.mjs --name "concertivo" --interpreter="node" --env PORT="$PORT"
pm2 save
pm2 startup systemd

# --------------- 5. Nginx config --------------------------
echo "==> Configuring Nginx..."
cat > /etc/nginx/sites-available/concertivo <<'NGINX'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /assets/ {
        proxy_pass http://127.0.0.1:3000/assets/;
        proxy_cache_valid 200 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINX

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/concertivo /etc/nginx/sites-enabled/concertivo
nginx -t && systemctl restart nginx

# --------------- 6. SSL (Let's Encrypt) --------------------
echo "==> Setting up SSL..."
certbot --nginx -d "$DOMAIN" --agree-tos --non-interactive --email "$EMAIL" || true

# --------------- 7. Done ----------------------------------
echo ""
echo "============================================================"
echo "✅ Concertivo deployed successfully!"
echo "   App dir : $APP_DIR"
echo "   PM2 name: concertivo"
echo "   URL     : https://$DOMAIN"
echo ""
echo "Useful commands:"
echo "   pm2 logs concertivo       # view logs"
echo "   pm2 restart concertivo    # restart app"
echo "   pm2 stop concertivo      # stop app"
echo "============================================================"
