#!/usr/bin/env bash
# Redeploy Kopra dari tarball CI: /tmp/kopra-deploy.tar.gz
# .env root/apps TIDAK tersentuh (tidak ada di tarball).
set -euo pipefail
cd /home/kopra/app
echo "== extract =="
tar xzf /tmp/kopra-deploy.tar.gz -C /home/kopra/app
echo "== install =="
pnpm install --prefer-offline 2>&1 | tail -2
echo "== prisma generate + db push =="
set -a; source .env; set +a
pnpm --filter @kopra/db generate 2>&1 | tail -1
(cd packages/db && npx prisma db push --skip-generate --accept-data-loss 2>&1 | tail -1)
psql "$DATABASE_URL" -f /home/kopra/app/packages/db/sql/rag_fts.sql >/dev/null && echo "FTS re-applied"
echo "== build =="
pnpm --filter api build 2>&1 | tail -1
pnpm --filter agent build 2>&1 | tail -1
pnpm --filter web build 2>&1 | tail -2
echo "== prisma client -> mastra bundle =="
SRC_JS=$(find /home/kopra/app/node_modules/.pnpm -path "*@prisma+client*/.prisma/client/default.js" 2>/dev/null | head -1 || true)
if [ -z "$SRC_JS" ]; then
  echo "FATAL: generated prisma client tidak ketemu di root node_modules (sudah jalankan generate?)"; exit 1
fi
SRC=$(dirname "$SRC_JS")
OUT=/home/kopra/app/apps/agent/.mastra/output
if [ ! -d "$OUT/node_modules" ]; then
  echo "FATAL: $OUT/node_modules tidak ada — layout output mastra berubah lagi?"; exit 1
fi
# layout flat npm: @prisma/client me-require '.prisma/client' sebagai sibling
DST="$OUT/node_modules/.prisma/client"
mkdir -p "$DST"
cp -r "$SRC/." "$DST/"
echo "prisma client -> $DST"
echo "== restart =="
pm2 restart api agent web --update-env
sleep 6
pm2 status | grep -E "api|agent|web|gowa"
if pm2 jlist 2>/dev/null | grep -q '"status":"errored"'; then
  echo "FATAL: ada proses pm2 errored"; exit 1
fi
curl -sf -o /dev/null "http://localhost:3001/api/v1/registration/koperasi?q=a" && echo "API HEALTH OK"
curl -sf -o /dev/null http://localhost:3000/login && echo "WEB HEALTH OK"
rm -f /tmp/kopra-deploy.tar.gz
echo "REDEPLOY SELESAI"
