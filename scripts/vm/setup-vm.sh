#!/usr/bin/env bash
# Setup VM Kopra (Ubuntu 24.04) — idempotent, jalankan sebagai user kopra (sudo-capable)
set -euo pipefail

echo "== [1/6] swap 2G =="
if ! sudo swapon --show | grep -q swapfile; then
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
  sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "== [2/6] Node 22 + pnpm + pm2 =="
if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
sudo corepack enable
corepack prepare pnpm@9.15.0 --activate
command -v pm2 >/dev/null || sudo npm install -g pm2

echo "== [3/6] PostgreSQL =="
sudo apt-get install -y postgresql
sudo systemctl enable --now postgresql
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='kopra'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE ROLE kopra LOGIN PASSWORD '${PG_PASSWORD:?set PG_PASSWORD}' CREATEDB"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='kopra'" | grep -q 1 || \
  sudo -u postgres createdb -O kopra kopra

echo "== [4/6] Caddy =="
if ! command -v caddy >/dev/null; then
  sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update && sudo apt-get install -y caddy
fi

echo "== [5/6] GoWA v8.6.0 linux-amd64 =="
mkdir -p ~/gowa
if [ ! -x ~/gowa/whatsapp ]; then
  curl -fsSL -o /tmp/gowa.zip https://github.com/aldinokemal/go-whatsapp-web-multidevice/releases/download/v8.6.0/whatsapp_8.6.0_linux_amd64.zip
  sudo apt-get install -y unzip
  unzip -o /tmp/gowa.zip -d ~/gowa
  # nama binary di zip bisa "whatsapp" atau ber-suffix — normalisasi
  BIN=$(find ~/gowa -maxdepth 1 -type f -name "*whatsapp*" ! -name "*.zip" | head -1)
  [ "$BIN" != "$HOME/gowa/whatsapp" ] && mv "$BIN" ~/gowa/whatsapp
  chmod +x ~/gowa/whatsapp
fi
~/gowa/whatsapp --version || true

echo "== [6/6] pm2 startup =="
sudo env PATH=$PATH pm2 startup systemd -u kopra --hp /home/kopra >/dev/null || true

echo "SETUP SELESAI"
